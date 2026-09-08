import { useEffect, useState } from "react";
import { BookMarked, Bookmark, Check, ChevronDown, ChevronLeft, Download, Play } from "lucide-react";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import type { UserProfile } from "../../lib/AuthContext";
import type { PQFile } from "../../types";
import { cn } from "../../utils/cn";
import { deptColor } from "../../utils/departments";
import { freqMeta, FreqIcon } from "../../utils/frequency";

export function PQViewer({ pq, onBack, onStartQuiz, userProfile, fetchQuestions }: {
  pq: PQFile;
  onBack: () => void;
  onStartQuiz: (pq: PQFile) => void;
  userProfile: UserProfile | null;
  fetchQuestions: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set(userProfile?.bookmarkedQuestions || []));

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

  const sections = [...new Set(pq.questions.map(q => q.section))];

  const downloadPaper = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const M = 18;                    // margin
    const W = PAGE_W - M * 2;        // usable width
    let y = M;

    // jsPDF's built-in fonts are Latin-1, so characters like — and ₦ would render
    // as mojibake. Fold the ones our content actually uses down to ASCII.
    const ascii = (s: string) => (s || "")
      .replace(/[—–]/g, "-").replace(/[""]/g, '"').replace(/['']/g, "'")
      .replace(/[─│]/g, "-").replace(/…/g, "...").replace(/×/g, "x")
      .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/[^\x00-\xFF]/g, "");

    const room = (needed: number) => {
      if (y + needed > PAGE_H - M) { doc.addPage(); y = M; return true; }
      return false;
    };

    const write = (
      text: string,
      { size = 10, style = "normal", gap = 4, indent = 0 } = {}
    ) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      const lines: string[] = doc.splitTextToSize(ascii(text), W - indent);
      for (const line of lines) {
        room(size * 0.45);
        doc.text(line, M + indent, y);
        y += size * 0.45;
      }
      y += gap;
    };

    const rule = () => {
      room(3);
      doc.setDrawColor(180).setLineWidth(0.3).line(M, y, PAGE_W - M, y);
      y += 5;
    };

    // ── Cover block ──────────────────────────────────────────────────────────
    doc.setTextColor(15, 35, 64);
    write(pq.faculty.toUpperCase(), { size: 11, style: "bold", gap: 1 });
    write(`DEPARTMENT OF ${pq.department.toUpperCase()}`, { size: 11, style: "bold", gap: 3 });
    write(`${pq.courseCode} - ${pq.courseTitle}`, { size: 15, style: "bold", gap: 2 });
    doc.setTextColor(60);
    write(`${pq.semester} Semester Examination, ${pq.session} Academic Session`, { size: 10, gap: 3 });
    rule();
    doc.setTextColor(0);
    write(`INSTRUCTIONS: ${pq.instructions}`, { size: 9.5, gap: 2 });
    write(`Total Marks: ${pq.totalMarks}   |   Questions: ${pq.questions.length}`, { size: 9.5, style: "bold", gap: 3 });
    rule();

    // ── Questions, by section ────────────────────────────────────────────────
    sections.forEach(sec => {
      room(14);
      doc.setTextColor(15, 35, 64);
      write(`SECTION ${sec}`, { size: 12, style: "bold", gap: 3 });
      doc.setTextColor(0);

      pq.questions.filter(q => q.section === sec).forEach(q => {
        room(24); // keep a question's header with at least some of its body
        write(`${q.number}.  (${q.marks} mark${q.marks !== 1 ? "s" : ""})   [${q.topic}]`,
          { size: 10, style: "bold", gap: 1.5 });
        write(q.text, { size: 10, gap: 2 });

        if (q.options) {
          q.options.forEach(o => write(o, { size: 9.5, gap: 0.5, indent: 6 }));
          y += 1.5;
        }

        doc.setTextColor(11, 122, 91);
        write(`ANSWER: ${q.answer}`, { size: 9.5, style: "bold", gap: 1.5, indent: 4 });
        doc.setTextColor(70);
        write(`SOLUTION: ${q.solution}`, { size: 9, gap: 5, indent: 4 });
        doc.setTextColor(0);
      });
    });

    // ── Page numbers ─────────────────────────────────────────────────────────
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150);
      doc.text(`${pq.courseCode} - ${pq.session}`, M, PAGE_H - 10);
      doc.text(`Page ${p} of ${total}`, PAGE_W - M, PAGE_H - 10, { align: "right" });
    }

    doc.save(`${pq.courseCode.replace(/ /g, "_")}_Exam_${pq.session.replace(/\//g, "_")}.pdf`);
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
          <div className="flex gap-2 shrink-0">
            <button onClick={downloadPaper} title="Download this paper with answers and solutions as a PDF"
              className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <Download size={14} /> Download PDF
            </button>
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

      {/* Questions by section */}
      {sections.map(sec => {
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
                          <p className="text-sm text-gray-800 leading-relaxed">
                            {q.type === "fillblank"
                              ? q.text.replace(/__+/g, "______")
                              : q.text}
                          </p>
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
                        <div className="bg-white border border-gray-100 rounded-xl p-3 mb-2">
                          <p className="text-sm font-semibold text-emerald-700">{q.answer}</p>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Detailed Solution</p>
                        <div className="bg-white border border-gray-100 rounded-xl p-3">
                          <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed font-mono">{q.solution}</p>
                        </div>
                      </div>
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
