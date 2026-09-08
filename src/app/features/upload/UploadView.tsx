import { useRef, useState } from "react";
import { AlertCircle, Camera, Check, CheckCircle, Download, FileText, Loader2, Sparkles } from "lucide-react";
import { addDoc, collection } from "firebase/firestore";

import { auth, db } from "../../lib/firebase";
import type { QuestionWriteRecord } from "../../types";
import { cn } from "../../utils/cn";

export function UploadView({ fetchQuestions }: { fetchQuestions: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [autoTitle, setAutoTitle] = useState("");
  const [selCourse, setSelCourse] = useState("");
  const [selSession, setSelSession] = useState("");
  const [selSem, setSelSem] = useState("First");
  const [submitted, setSubmitted] = useState(false);
  const [cleaningText, setCleaningText] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cleanOCRText = async () => {
    if (!ocrText) return;
    setCleaningText(true);
    try {
      const res = await fetch("/api/clean-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: ocrText })
      });
      const data = await res.json();
      if (data.cleanedText) {
        setOcrText(data.cleanedText);
      }
    } catch (err) {
      console.error("AI Cleaning failed:", err);
    } finally {
      setCleaningText(false);
    }
  };

  const detectMeta = (filename: string) => {
    const codeMatch = filename.match(/CPE[_\s]?(\d+)/i) ||
      filename.match(/MTH[_\s]?(\d+)/i) || filename.match(/PHY[_\s]?(\d+)/i) ||
      filename.match(/CSC[_\s]?(\d+)/i) || filename.match(/CHE[_\s]?(\d+)/i);
    const yearMatch = filename.match(/(\d{2})(\d{2})/) || filename.match(/(\d{4})/);

    if (codeMatch) {
      const prefix = filename.match(/^([A-Z]+)/i)?.[1]?.toUpperCase() || "CPE";
      const code = `${prefix} ${codeMatch[1]}`;
      setSelCourse(code);
      const year1 = yearMatch ? `20${yearMatch[1]}` : "2022";
      const year2 = yearMatch ? `20${yearMatch[2]}` : "2023";
      const session = `${year1}/${year2}`;
      setSelSession(session);
      setAutoTitle(`${code} Exam Question ${session}`);
    }
  };

  const load = (f: File) => {
    setFile(f); setOcrText(""); setOcrDone(false); setSubmitted(false);
    detectMeta(f.name);
    if (f.type.startsWith("image/")) {
      const r = new FileReader();
      r.onload = e => setPreview(e.target?.result as string);
      r.readAsDataURL(f);
    } else setPreview(null);
  };

  const runOCR = async () => {
    if (!file) return;
    setOcrLoading(true); setOcrText("");
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        // Gemini's inlineData.data wants raw base64, not the "data:<mime>;base64," prefix.
        const [meta, rawBase64] = dataUrl.split(",");
        const mimeType = meta?.match(/^data:([^;]+)/)?.[1] || file.type || "image/jpeg";
        try {
          const res = await fetch("/api/ocr", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              imageBase64: rawBase64,
              mimeType,
              filename: file.name
            })
          });
          const data = await res.json();
          if (data.text) {
            setOcrText(data.text);
            setOcrDone(true);
          } else {
            setOcrText(data.error || "OCR Extraction failed.");
          }
        } catch (err: any) {
          setOcrText(err.message || "Failed to contact OCR API.");
        } finally {
          setOcrLoading(false);
        }
      };
      reader.onerror = () => {
        setOcrText("Could not read that file. Try a different image or PDF.");
        setOcrLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setOcrLoading(false);
    }
  };

  const submitForReview = async () => {
    const submitterId = auth.currentUser?.uid;
    if (!submitterId || !selCourse || !selSession || !ocrText) return;
    try {
      const qRegex = /(?:Question|Q|QUESTION)\s*\d+[:\.\s]*/gi;
      const parts = ocrText.split(qRegex);
      const matches = ocrText.match(qRegex);
      
      const toInsert: QuestionWriteRecord[] = [];
      if (parts.length > 1) {
        parts.forEach((content, idx) => {
          if (idx === 0) return;
          const qNum = matches ? matches[idx - 1].replace(/[^0-9]/g, '') : String(idx);
          toInsert.push({
            courseCode: selCourse.toUpperCase(),
            courseTitle: selCourse.toUpperCase(),
            department: "General",
            faculty: "Technology",
            session: selSession,
            semester: selSem,
            year: Number(selSession.split('/')[0]) || 2024,
            instructions: parts[0].trim().substring(0, 200) || "Attempt all questions.",
            section: "A",
            number: qNum || String(idx),
            marks: 20,
            topic: "General",
            frequency: 5,
            questionText: content.trim(),
            solutionText: "Awaiting lecturer/admin solution.",
            type: "theory",
            status: "pending",
            createdAt: Date.now(),
            createdBy: submitterId
          });
        });
      } else {
        toInsert.push({
          courseCode: selCourse.toUpperCase(),
          courseTitle: selCourse.toUpperCase(),
          department: "General",
          faculty: "Technology",
          session: selSession,
          semester: selSem,
          year: Number(selSession.split('/')[0]) || 2024,
          instructions: "Attempt all questions.",
          section: "A",
          number: "1",
          marks: 100,
          topic: "General",
          frequency: 5,
          questionText: ocrText,
          solutionText: "Awaiting lecturer/admin solution.",
          type: "theory",
          status: "pending",
          createdAt: Date.now(),
          createdBy: submitterId
        });
      }
      
      await Promise.all(toInsert.map(item => addDoc(collection(db, 'questions'), item)));
      setSubmitted(true);
      fetchQuestions();
    } catch (err) {
      console.error("Error submitting paper for review:", err);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">Upload Question Paper</h1>
        <p className="text-gray-500 text-sm mt-1">Upload an image or PDF — metadata is auto-detected from the filename, and OCR extracts the full text.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}
            onClick={() => fileRef.current?.click()}
            className={cn("border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all min-h-[160px] flex flex-col items-center justify-center",
              dragging ? "border-[#E8A020] bg-amber-50" : "border-gray-200 hover:border-[#0F2340] hover:bg-blue-50/20")}>
            {preview
              ? <img src={preview} alt="Preview" className="w-full h-36 object-contain rounded-xl mb-2" />
              : <><Camera size={32} className="text-gray-200 mb-3" /><p className="text-sm font-semibold text-gray-500">Drop image or PDF here</p><p className="text-xs text-gray-300 mt-1">PNG · JPG · PDF · HEIC</p></>
            }
            {file && <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1"><Check size={11} />{file.name}</p>}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => { if (e.target.files?.[0]) load(e.target.files[0]); }} />

          {autoTitle && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Auto-detected</p>
              <p className="text-sm font-bold text-emerald-800">{autoTitle}</p>
            </div>
          )}

          <div className="space-y-2">
            <input value={selCourse} onChange={e => setSelCourse(e.target.value)}
              placeholder="Course Code (e.g. CPE 508)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20" />
            <input value={selSession} onChange={e => setSelSession(e.target.value)}
              placeholder="Session (e.g. 2022/2023)"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20" />
            <select value={selSem} onChange={e => setSelSem(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20">
              <option value="First">First Semester</option>
              <option value="Second">Second Semester</option>
              <option value="Rain">Rain Semester</option>
              <option value="Harmattan">Harmattan Semester</option>
            </select>
          </div>

          {file && !ocrDone && (
            <button onClick={runOCR} disabled={ocrLoading}
              className="w-full bg-[#0F2340] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#1a3a6b] disabled:opacity-60 flex items-center justify-center gap-2">
              {ocrLoading ? <><Loader2 size={15} className="animate-spin" /> Extracting text...</> : <><FileText size={15} /> Extract Text (OCR)</>}
            </button>
          )}

          {!file && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5"><AlertCircle size={13} /> How it works</p>
              <ol className="text-xs text-blue-600 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Upload a photo or PDF of any past question paper</li>
                <li>Metadata (course, session) is auto-detected from the filename</li>
                <li>Click "Extract Text" — OCR reads and transcribes the paper</li>
                <li>Review and edit the extracted text, then submit for admin review</li>
              </ol>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Extracted Text</label>
            {ocrDone && (
              <div className="flex items-center gap-3">
                <button onClick={cleanOCRText} disabled={cleaningText}
                  className="flex items-center gap-1 text-xs text-purple-600 hover:underline font-semibold disabled:opacity-50">
                  {cleaningText ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Clean with AI
                </button>
                <button onClick={() => {
                  const blob = new Blob([ocrText], { type: "text/plain" });
                  const url = URL.createObjectURL(blob); const a = document.createElement("a");
                  a.href = url; a.download = `${(selCourse || "paper").replace(" ", "_")}_${selSession?.replace("/", "_")}.txt`; a.click();
                  URL.revokeObjectURL(url);
                }} className="flex items-center gap-1 text-xs text-blue-500 hover:underline font-semibold">
                  <Download size={12} /> Save
                </button>
              </div>
            )}
          </div>
          <textarea value={ocrText} onChange={e => setOcrText(e.target.value)}
            placeholder="Extracted text will appear here after OCR..."
            rows={18}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-xs leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 bg-gray-50 font-mono" />
          {ocrDone && !submitted && (
            <button onClick={submitForReview}
              className="mt-3 w-full bg-[#E8A020] text-[#0F2340] rounded-xl py-3 text-sm font-bold hover:bg-[#d49018] flex items-center justify-center gap-2">
              <CheckCircle size={15} /> Submit for Admin Review
            </button>
          )}
          {submitted && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-sm text-emerald-700 font-semibold">
              <CheckCircle size={15} /> Submitted! Awaiting admin approval.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
