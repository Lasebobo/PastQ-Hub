import { useEffect, useState, useRef } from "react";
import { BookMarked, Bookmark, Check, ChevronDown, ChevronLeft, Download, Play, Loader2, UploadCloud, Maximize, Trash2 } from "lucide-react";
import { arrayRemove, arrayUnion, doc, updateDoc, deleteDoc } from "firebase/firestore";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { db } from "../../lib/firebase";
import type { UserProfile } from "../../lib/AuthContext";
import type { PQFile } from "../../types";
import { cn } from "../../utils/cn";
import { deptColor } from "../../utils/departments";
import { freqMeta, FreqIcon } from "../../utils/frequency";
import { encodeImageForOcr } from "../../utils/downscale";

export function PQViewer({ pq, onBack, onStartQuiz, userProfile, fetchQuestions }: {
  pq: PQFile;
  onBack: () => void;
  onStartQuiz: (pq: PQFile) => void;
  userProfile: UserProfile | null;
  fetchQuestions: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set(userProfile?.bookmarkedQuestions || []));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ text: "", answer: "", solution: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingGuide, setIsUploadingGuide] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    if (userProfile?.bookmarkedQuestions) {
      setBookmarked(new Set(userProfile.bookmarkedQuestions));
    }
  }, [userProfile]);

  const toggleBookmark = async (qId: string) => {
    if (!userProfile) return;
    const isBookmarked = bookmarked.has(qId);
    const userRef = doc(db, 'users', userProfile.id);
    try {
      if (isBookmarked) {
        await updateDoc(userRef, { bookmarkedQuestions: arrayRemove(qId) });
        setBookmarked(prev => { const next = new Set(prev); next.delete(qId); return next; });
      } else {
        await updateDoc(userRef, { bookmarkedQuestions: arrayUnion(qId) });
        setBookmarked(prev => { const next = new Set(prev); next.add(qId); return next; });
      }
      fetchQuestions();
    } catch (err) {
      console.error("Error toggling bookmark:", err);
    }
  };

  const toggle = (id: string) =>
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const startEdit = (q: any) => {
    setEditingId(q.id);
    setEditForm({ text: q.text || "", answer: q.answer || "", solution: q.solution || "" });
  };

  const saveEdit = async (qId: string) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "questions", qId), {
        questionText: editForm.text,
        text: editForm.text,
        answer: editForm.answer,
        solutionText: editForm.solution,
        solution: editForm.solution
      });
      setEditingId(null);
      fetchQuestions();
    } catch (e) {
      console.error("Error saving:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePaper = async () => {
    if (!confirm(`Are you sure you want to completely delete ${pq.courseCode} ${pq.session}? This will permanently remove all its questions from the database.`)) return;
    
    setIsDeleting(true);
    try {
      await Promise.all(pq.questions.map(q => deleteDoc(doc(db, 'questions', q.id))));
      alert(`Deleted ${pq.courseCode} ${pq.session} successfully.`);
      fetchQuestions();
      onBack();
    } catch (err) {
      console.error("Error deleting paper:", err);
      alert("Failed to delete paper.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingGuide(true);
    try {
      const { base64, mimeType } = await encodeImageForOcr(file);
      const res = await fetch("/api/extract-bulk-solutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          questions: pq.questions.map(q => ({ id: q.id, number: q.number, text: q.text }))
        })
      });
      const data = await res.json();
      if (data.solutions && Array.isArray(data.solutions)) {
        let count = 0;
        await Promise.all(data.solutions.map(async (sol: any) => {
          if (sol.questionId && sol.solutionText) {
            await updateDoc(doc(db, "questions", sol.questionId), {
              solution: sol.solutionText,
              solutionText: sol.solutionText
            });
            count++;
          }
        }));
        alert(`Successfully matched and updated solutions for ${count} questions!`);
        fetchQuestions();
      } else {
        alert(data.error || "Failed to extract solutions.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setIsUploadingGuide(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const sections = [...new Set(pq.questions.map(q => q.section))];

  // Downloads the exact file the lecturer/admin uploaded — same fonts,
  // letterhead, diagrams, formatting. This is what "Download" should mean
  // whenever a paper has one on file.
  const downloadOriginal = async () => {
    if (!pq.originalFileUrl) return;
    setIsDownloading(true);
    try {
      const res = await fetch(pq.originalFileUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pq.originalFileName || `${pq.courseCode.replace(/ /g, "_")}_${pq.session.replace(/\//g, "_")}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading original paper:", err);
      // Fall back to opening it directly if the fetch/blob path fails
      // (e.g. a CORS quirk) — the file itself is still real, just opened
      // in a new tab instead of saved straight to disk.
      window.open(pq.originalFileUrl, "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  // Fallback only, for papers uploaded before the original file was kept.
  // Rebuilds a plain document from the extracted text — it will never match
  // the real paper's layout, so it's offered only when no original exists.
  const downloadReconstructed = async () => {
    setIsDownloading(true);
    try {
      // Create an invisible iframe. This isolates the PDF generation from the main document,
      // preventing html2canvas from crashing when it tries to parse Tailwind v4's oklch() 
      // colors in the global stylesheets.
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.width = "700px";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow!.document;
      iframeDoc.head.innerHTML = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">`;

      const container = iframeDoc.createElement("div");
      container.style.width = "700px";
      container.style.backgroundColor = "white";
      container.style.color = "black";
      container.style.padding = "20px";
      container.style.fontFamily = "sans-serif";
      
      iframeDoc.body.appendChild(container);

      const { createRoot } = await import("react-dom/client");
      const root = createRoot(container);

      const PdfContent = () => (
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#0F2340', margin: '0 0 10px 0' }}>{(pq.faculty || "").toUpperCase()}</h1>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#0F2340', margin: '0 0 15px 0' }}>DEPARTMENT OF {(pq.department || "").toUpperCase()}</h2>
          <h3 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 10px 0' }}>{pq.courseCode} - {pq.courseTitle}</h3>
          <p style={{ fontSize: 14, color: '#4b5563', margin: '0 0 15px 0' }}>{pq.semester} Semester Examination, {pq.session} Academic Session</p>
          <hr style={{ borderTop: '2px solid #e5e7eb', margin: '15px 0' }} />
          <p style={{ fontSize: 13, margin: '0 0 5px 0' }}><strong>INSTRUCTIONS:</strong> {pq.instructions}</p>
          <p style={{ fontSize: 13, margin: '0 0 15px 0' }}><strong>Total Marks:</strong> {pq.totalMarks} | <strong>Questions:</strong> {pq.questions?.length || 0}</p>
          <hr style={{ borderTop: '2px solid #e5e7eb', margin: '15px 0 25px 0' }} />

          {sections.map(sec => (
            <div key={sec}>
              <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#0F2340', margin: '20px 0 15px 0' }}>SECTION {sec}</h2>
              {pq.questions.filter(q => q.section === sec).map(q => (
                <div key={q.id} style={{ marginBottom: 25, pageBreakInside: 'avoid' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 8 }}>
                    {q.number}. ({q.marks} marks) [{q.topic}]
                  </div>
                  <div style={{ fontSize: 14, lineHeight: '1.6', marginBottom: 10 }}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {q.type === "fillblank" ? q.text.replace(/__+/g, "______") : q.text}
                    </ReactMarkdown>
                  </div>
                  {q.options && q.options.length > 0 && (
                    <div style={{ marginLeft: 20, marginBottom: 10 }}>
                      {q.options.map(opt => (
                        <div key={opt} style={{ fontSize: 13, marginBottom: 4 }}>
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</ReactMarkdown>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div style={{ color: '#047857', fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
                      ANSWER:
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 12 }}>
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.answer || ""}</ReactMarkdown>
                    </div>
                    <div style={{ color: '#334155', fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
                      SOLUTION:
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.solution || ""}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      );

      root.render(<PdfContent />);

      // Wait a moment for KaTeX CSS and fonts to apply to the DOM
      await new Promise(r => setTimeout(r, 1500));

      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      
      // jsPDF requires html2canvas to be available globally in some environments
      if (typeof window !== "undefined") {
        (window as any).html2canvas = html2canvas;
      }

      const pdf = new jsPDF("p", "pt", "a4");

      await pdf.html(container, {
        margin: [40, 40, 40, 40],
        autoPaging: "text",
        width: 515,
        windowWidth: 700
      });

      pdf.save(`${pq.courseCode.replace(/ /g, "_")}_Exam_${pq.session.replace(/\//g, "_")}.pdf`);
      
      root.unmount();
      document.body.removeChild(iframe);
    } catch (err: any) {
      console.error("Failed to generate PDF:", err);
      alert(`Failed to generate the PDF. Error: ${err?.message || err}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#0F2340] mb-5 transition-colors">
        <ChevronLeft size={15} /> Back to Library
      </button>

      {/* Paper header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("text-xs font-bold text-white px-2.5 py-1 rounded-lg", deptColor(pq.department))}>
                {pq.courseCode}
              </span>
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Check size={10} /> Verified
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#0F2340]">{pq.courseCode} Exam Question {pq.session}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{pq.courseTitle}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
              <span>{pq.faculty}</span><span>·</span>
              <span>{pq.department}</span><span>·</span>
              <span>{pq.semester} Semester</span><span>·</span>
              <span>{pq.session} Session</span><span>·</span>
              <span>{pq.totalMarks} marks</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end mt-3 lg:mt-0">
            {(userProfile?.role === "admin" || userProfile?.role === "lecturer") && (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBulkUpload} />
                <button onClick={() => fileRef.current?.click()} disabled={isUploadingGuide}
                  className="flex items-center gap-2 border border-purple-200 bg-purple-50 rounded-xl px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50">
                  {isUploadingGuide ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} 
                  {isUploadingGuide ? "Extracting..." : "Upload Marking Guide"}
                </button>
                {userProfile?.role === "admin" && (
                  <button onClick={handleDeletePaper} disabled={isDeleting}
                    className="flex items-center gap-2 border border-red-200 bg-red-50 rounded-xl px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50">
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} 
                    {isDeleting ? "Deleting..." : "Delete Paper"}
                  </button>
                )}
              </>
            )}
            <div className="relative">
              <button 
                onClick={() => setShowDownloadMenu(!showDownloadMenu)} 
                onBlur={() => setTimeout(() => setShowDownloadMenu(false), 200)}
                disabled={isDownloading}
                className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {isDownloading ? "Preparing..." : "Download"}
                <ChevronDown size={14} />
              </button>
              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg z-10 py-1">
                  {pq.originalFileUrl && (
                    <button 
                      onClick={() => { downloadOriginal(); setShowDownloadMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Download size={14} /> Original Format
                    </button>
                  )}
                  <button 
                    onClick={() => { downloadReconstructed(); setShowDownloadMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                  >
                    <Download size={14} /> Reconstructed PDF
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => onStartQuiz(pq)}
              className="flex items-center gap-2 bg-[#E8A020] text-[#0F2340] rounded-xl px-4 py-2 text-sm font-bold hover:bg-[#d49018] transition-colors">
              <Play size={14} fill="currentColor" /> Practice Quiz
            </button>
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
          <strong>Instructions:</strong> {pq.instructions}
        </div>
      </div>

      {pq.originalFileUrl && (
        <div ref={containerRef} className={cn("bg-white shadow-sm flex flex-col transition-all relative group", 
          isFullscreen ? "w-screen h-screen m-0 p-0 rounded-none border-0" : "rounded-2xl border border-gray-100 p-3 mb-6")}>
          
          <div className={cn("flex justify-between items-center", isFullscreen ? "bg-[#0F2340] text-white p-4" : "mb-2 px-2")}>
            <span className={cn("text-xs font-bold", isFullscreen ? "text-white" : "text-gray-500")}>
              Document Viewer
            </span>
            <button onClick={toggleFullscreen} 
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2", 
                isFullscreen ? "bg-white/10 hover:bg-white/20 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700")}>
              <Maximize size={14} /> {isFullscreen ? "Exit Fullscreen" : "Expand Fullscreen"}
            </button>
          </div>

          {pq.originalFileType?.startsWith("image/") ? (
            <img src={pq.originalFileUrl} alt={`${pq.courseCode} ${pq.session} original paper`}
              className={cn("w-full object-contain bg-gray-50", isFullscreen ? "flex-1 h-0" : "rounded-xl border border-gray-100")} />
          ) : (
            <iframe src={`${pq.originalFileUrl}#toolbar=0&navpanes=0&scrollbar=0`} title={`${pq.courseCode} ${pq.session} original paper`}
              className={cn("w-full", isFullscreen ? "flex-1 h-0 bg-white" : "h-[85vh] rounded-xl border border-gray-100")} />
          )}
        </div>
      )}

      {/* Questions by section (only shown if there is no PDF uploaded, e.g. legacy or seed data) */}
      {!pq.originalFileUrl && sections.map(sec => {
        const qs = pq.questions.filter(q => q.section === sec);
        return (
          <div key={sec} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest px-3">
                Section {sec} {sec === "A" ? "— Fill in the Blank" : "— Essay / Theory"}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="space-y-3">
              {qs.map(q => {
                const open = expanded.has(q.id);
                const saved = bookmarked.has(q.id);
                const fm = freqMeta(q.frequency);
                return (
                  <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    {editingId === q.id ? (
                      <div className="p-5 bg-blue-50/30">
                        <label className="text-xs font-bold text-gray-600 block mb-1">Question Text (Markdown & LaTeX supported)</label>
                        <textarea className="w-full text-xs p-3 rounded-xl border border-gray-200 mb-4 min-h-[100px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20" value={editForm.text} onChange={e => setEditForm({...editForm, text: e.target.value})} />
                        
                        <label className="text-xs font-bold text-gray-600 block mb-1">Model Answer</label>
                        <input className="w-full text-xs p-3 rounded-xl border border-gray-200 mb-4 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20" value={editForm.answer} onChange={e => setEditForm({...editForm, answer: e.target.value})} />
                        
                        <label className="text-xs font-bold text-gray-600 block mb-1">Detailed Solution (Markdown & LaTeX supported)</label>
                        <textarea className="w-full text-xs p-3 rounded-xl border border-gray-200 mb-4 min-h-[120px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20" value={editForm.solution} onChange={e => setEditForm({...editForm, solution: e.target.value})} />
                        
                        <div className="flex gap-2 justify-end">
                           <button onClick={() => setEditingId(null)} className="px-4 py-2 border border-gray-200 bg-white rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                           <button onClick={() => saveEdit(q.id)} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                             {isSaving && <Loader2 size={12} className="animate-spin" />} Save Changes
                           </button>
                        </div>
                      </div>
                    ) : (
                      <>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-bold text-gray-300 w-8 shrink-0 mt-0.5">{q.number}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <span className="text-xs font-semibold bg-[#0F2340]/10 text-[#0F2340] px-2 py-0.5 rounded-lg">
                              {q.marks} mk{q.marks !== 1 ? "s" : ""}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg">{q.topic}</span>
                            <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg", fm.cls)}
                              title={`${q.topic} appeared ${q.frequency} times in past exams`}>
                              <FreqIcon type={fm.icon} /> {fm.label}
                            </span>
                          </div>
                          <div className="text-sm text-gray-800 leading-relaxed [&>p]:mb-2 overflow-x-auto">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {q.type === "fillblank"
                                ? q.text.replace(/__+/g, "______")
                                : q.text}
                            </ReactMarkdown>
                          </div>
                          {q.options && !open && (
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                              {q.options.map(opt => (
                                <span key={opt} className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">{opt}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => toggleBookmark(q.id)}
                            className={cn("p-1.5 rounded-lg transition-all", saved ? "text-[#E8A020]" : "text-gray-200 hover:text-[#E8A020]")}>
                            {saved ? <BookMarked size={15} /> : <Bookmark size={15} />}
                          </button>
                          <button onClick={() => toggle(q.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 transition-all">
                            <ChevronDown size={15} className={cn("transition-transform duration-200", open && "rotate-180")} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {open && (
                      <div className="border-t border-gray-50 bg-[#F7F8FA] p-4">
                        {q.options && (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {q.options.map(opt => (
                              <div key={opt} className={cn("text-xs px-3 py-2 rounded-xl border font-medium",
                                opt === q.answer ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-gray-100 text-gray-500")}>
                                {opt === q.answer && <Check size={11} className="inline mr-1 text-emerald-600" />}{opt}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                          {q.type === "fillblank" ? "Answer" : "Model Answer"}
                        </p>
                        <div className="bg-white border border-gray-100 rounded-xl p-3 mb-2 overflow-x-auto">
                          <div className="text-sm font-semibold text-emerald-700 [&>p]:mb-2">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {q.answer || ""}
                            </ReactMarkdown>
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Detailed Solution</p>
                        <div className="bg-white border border-gray-100 rounded-xl p-3 overflow-x-auto">
                          <div className="text-xs text-gray-700 leading-relaxed [&>p]:mb-2">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {q.solution || ""}
                            </ReactMarkdown>
                          </div>
                        </div>
                        {(userProfile?.role === "admin" || userProfile?.role === "lecturer") && (
                          <div className="mt-4 flex justify-end">
                            <button onClick={() => startEdit(q)} className="text-[11px] bg-white border border-gray-200 px-3 py-1.5 rounded-lg font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                              Edit Question & Solution
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
