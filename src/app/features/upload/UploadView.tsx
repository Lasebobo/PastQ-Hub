import { useRef, useState } from "react";
import { AlertCircle, Camera, Check, CheckCircle, Loader2 } from "lucide-react";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "../../lib/firebase";

import type { QuestionWriteRecord } from "../../types";
import { cn } from "../../utils/cn";
import { encodeImageForOcr } from "../../utils/downscale";

export function UploadView({ fetchQuestions }: { fetchQuestions: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [autoTitle, setAutoTitle] = useState("");
  const [selCourse, setSelCourse] = useState("");
  const [selSession, setSelSession] = useState("");
  const [selLevel, setSelLevel] = useState("100");
  const [selSem, setSelSem] = useState("First");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseMetaFromFilename = (filename: string) => {
    const codeMatch = filename.match(/([A-Z]{3,4})[_\s]?(\d{3})/i);
    let session = "2023/2024";
    let courseCode = "";
    let level = "100";
    let semester = "First";
    
    if (codeMatch) {
      const prefix = codeMatch[1].toUpperCase();
      const numStr = codeMatch[2];
      courseCode = `${prefix} ${numStr}`;
      
      const firstDigit = numStr[0];
      if (firstDigit >= '1' && firstDigit <= '5') level = `${firstDigit}00`;
      
      const lastDigit = parseInt(numStr[2], 10);
      if (!isNaN(lastDigit)) semester = (lastDigit % 2 !== 0) ? "First" : "Second";
    }

    const yearMatch = filename.match(/(\d{4})[_\-\/]?(\d{2,4})/) || filename.match(/(\d{4})/);
    if (yearMatch) {
      if (yearMatch[2]) {
        const year1 = yearMatch[1];
        const year2 = yearMatch[2].length === 2 ? `20${yearMatch[2]}` : yearMatch[2];
        session = `${year1}/${year2}`;
      } else {
        const year1 = yearMatch[1];
        session = `${year1}/${parseInt(year1) + 1}`;
      }
    }
    return { courseCode, session, level, semester };
  };

  const detectMeta = (filename: string) => {
    const { courseCode, session, level, semester } = parseMetaFromFilename(filename);
    if (courseCode) setSelCourse(courseCode);
    setSelLevel(level);
    setSelSem(semester);
    setSelSession(session);
    if (courseCode) {
      setAutoTitle(`${courseCode} Exam Question ${session}`);
    }
  };

  const loadFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    
    setFiles(arr);
    setSubmitted(false);
    detectMeta(arr[0].name); // Use the first file to detect meta
    
    // Generate preview URLs for images
    const urls = arr.filter(f => f.type.startsWith("image/")).map(f => URL.createObjectURL(f));
    setPreviews(urls);
  };

  const submitForReview = async () => {
    const submitterId = auth.currentUser?.uid;
    if (!submitterId || !selCourse || !selSession || files.length === 0) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const pdfFiles = files.filter(f => f.type === "application/pdf");
      const imageFiles = files.filter(f => f.type.startsWith("image/"));
      
      const itemsToProcess: { file: File | Blob, filename: string, type: string, meta: any }[] = [];

      // If there are images, merge them all into a single PDF
      if (imageFiles.length > 0) {
        const { default: jsPDF } = await import("jspdf");
        const pdf = new jsPDF("p", "pt", "a4");
        
        for (let i = 0; i < imageFiles.length; i++) {
          const f = imageFiles[i];
          const imgUrl = URL.createObjectURL(f);
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgUrl;
          });
          
          if (i > 0) pdf.addPage();
          
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
          const imgW = img.width * ratio;
          const imgH = img.height * ratio;
          const x = (pageWidth - imgW) / 2;
          const y = 20;
          
          const MAX_EDGE = 1500;
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressedData = canvas.toDataURL("image/jpeg", 0.7);
            pdf.addImage(compressedData, "JPEG", x, y, imgW, imgH, undefined, "FAST");
          } else {
            pdf.addImage(img, "JPEG", x, y, imgW, imgH, undefined, "FAST");
          }
          
          URL.revokeObjectURL(imgUrl);
        }
        
        itemsToProcess.push({
          file: pdf.output("blob"),
          filename: `${selCourse.replace(/\s+/g, "_")}_${selSession.replace("/", "_")}.pdf`,
          type: "application/pdf",
          meta: { courseCode: selCourse.toUpperCase(), session: selSession, semester: selSem, level: selLevel }
        });
      }

      // Add all standalone PDFs to the processing queue
      const isSingleUpload = pdfFiles.length === 1 && imageFiles.length === 0;
      for (const pdf of pdfFiles) {
        let finalPdfFile: File = pdf;

        const parsed = parseMetaFromFilename(pdf.name);
        itemsToProcess.push({
          file: finalPdfFile,
          filename: pdf.name,
          type: pdf.type || "application/pdf",
          meta: {
            courseCode: isSingleUpload ? selCourse.toUpperCase() : (parsed.courseCode || selCourse.toUpperCase()),
            session: isSingleUpload ? selSession : (parsed.session || selSession),
            semester: isSingleUpload ? selSem : (parsed.semester || selSem),
            level: isSingleUpload ? selLevel : (parsed.level || selLevel)
          }
        });
      }

      const allInserts: QuestionWriteRecord[] = [];
      const cloudName = "m75ty0r1"; 
      const uploadPreset = "PastQ_Hub"; 

      // Process each file sequentially
      for (const item of itemsToProcess) {
        const fileForCloudinary = item.file instanceof File ? item.file : new File([item.file], item.filename, { type: item.type });
        const formData = new FormData();
        formData.append("file", fileForCloudinary);
        formData.append("upload_preset", uploadPreset);

        // Upload to Cloudinary securely
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
          method: "POST",
          body: formData
        });
        
        const cloudinaryData = await res.json();
        if (!res.ok) throw new Error(`Cloudinary Error: ${cloudinaryData.error?.message || "Failed to upload"}`);
        
        const originalFileUrl = cloudinaryData.secure_url;
        let extractedText = "OCR processing failed or skipped.";
        let extractedMeta = null;
        try {
          const { base64, mimeType } = await encodeImageForOcr(fileForCloudinary);
          const ocrRes = await fetch("/api/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64, mimeType, filename: item.filename })
          });
          const ocrData = await ocrRes.json();
          if (ocrData.text) extractedText = ocrData.text;
          if (ocrData.meta) extractedMeta = ocrData.meta;
        } catch (err) {
          console.error(`Silent OCR failed for ${item.filename}:`, err);
        }

        const finalCourseCode = extractedMeta?.courseCode || item.meta.courseCode;
        const finalSession = extractedMeta?.session || item.meta.session;
        const finalSemester = extractedMeta?.semester || item.meta.semester;
        const finalLevel = extractedMeta?.level || item.meta.level;
        const finalYear = extractedMeta?.year || Number(finalSession.split('/')[0]) || 2024;

        // Duplicate check
        const existingDocs = await getDocs(
          query(
            collection(db, 'questions'),
            where('courseCode', '==', finalCourseCode),
            where('session', '==', finalSession)
          )
        );
        
        if (!existingDocs.empty) {
          console.warn(`Duplicate found for ${finalCourseCode} ${finalSession}. Skipping...`);
          setSubmitError(prev => (prev ? prev + "\n" : "") + `Duplicate avoided: ${finalCourseCode} ${finalSession} is already in the database.`);
          continue; // Skip inserting this paper
        }

        allInserts.push({
          courseCode: finalCourseCode,
          courseTitle: finalCourseCode,
          department: "General",
          faculty: "Technology",
          session: finalSession,
          semester: finalSemester,
          year: finalYear,
          level: finalLevel,
          instructions: "Attempt all questions.",
          section: "A",
          number: "1",
          marks: 100,
          topic: "General",
          frequency: 5,
          questionText: extractedText,
          solutionText: "Awaiting lecturer/admin solution.",
          type: "theory",
          status: "pending",
          createdAt: Date.now(),
          createdBy: submitterId,
          originalFileUrl,
          originalFileName: item.filename,
          originalFileType: item.type
        });
      }

      await Promise.all(allInserts.map(rec => addDoc(collection(db, 'questions'), rec)));
      setSubmitted(true);
      fetchQuestions();
    } catch (err: any) {
      console.error("Error submitting paper for review:", err);
      setSubmitError(err?.message || "Could not submit this paper. Check your connection and try again.");
    } finally {
      setSubmitting(false);
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
            onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length > 0) loadFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={cn("border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all min-h-[160px] flex flex-col items-center justify-center",
              dragging ? "border-[#E8A020] bg-amber-50" : "border-gray-200 hover:border-[#0F2340] hover:bg-blue-50/20")}>
            
            {previews.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2 mb-3">
                {previews.slice(0, 3).map((src, idx) => (
                  <img key={idx} src={src} alt="Preview" className="w-16 h-20 object-cover rounded-lg shadow-sm border border-gray-200" />
                ))}
                {previews.length > 3 && (
                  <div className="w-16 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-200">
                    +{previews.length - 3}
                  </div>
                )}
              </div>
            ) : (
              <><Camera size={32} className="text-gray-200 mb-3" /><p className="text-sm font-semibold text-gray-500">Drop images or PDF here</p><p className="text-xs text-gray-300 mt-1">Select multiple images to combine into one PDF</p></>
            )}
            
            {files.length > 0 && (
              <p className="text-xs text-emerald-600 mt-2 flex flex-col items-center gap-1 font-medium">
                <span className="flex items-center gap-1"><Check size={12} /> {files.length} file{files.length !== 1 ? 's' : ''} selected</span>
                <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{files.map(f => f.name).join(', ')}</span>
              </p>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) loadFiles(e.target.files); }} />

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
              <option value="First">First semester/Harmattan semester</option>
              <option value="Second">Second semester/Rain semester</option>
            </select>
            <select value={selLevel} onChange={e => setSelLevel(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20">
              <option value="100">100 Level</option>
              <option value="200">200 Level</option>
              <option value="300">300 Level</option>
              <option value="400">400 Level</option>
              <option value="500">500 Level</option>
            </select>
          </div>

          <div className="flex gap-4 mt-6">
            <button onClick={() => { setFiles([]); setPreviews([]); }}
              className="flex-1 bg-white border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-bold hover:bg-gray-50">
              Clear
            </button>
            <button onClick={submitForReview} disabled={submitting || files.length === 0}
              className="flex-[2] bg-[#E8A020] text-[#0F2340] rounded-xl py-3 text-sm font-bold hover:bg-[#d49018] flex items-center justify-center gap-2 disabled:opacity-60 relative overflow-hidden">
              <div className="relative z-10 flex items-center gap-2">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                {submitting ? "Uploading..." : "Submit Paper"}
              </div>
            </button>
          </div>
          
          {submitError && (
            <p className="mt-3 text-xs text-red-600 font-medium flex items-center gap-1">
              <AlertCircle size={12} /> {submitError}
            </p>
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
