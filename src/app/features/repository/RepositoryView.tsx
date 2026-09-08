import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";

import { db } from "../../lib/firebase";
import type { GeneratedQuizRecord, PQFile, QuestionRecord, QuestionWriteRecord } from "../../types";
import { cn } from "../../utils/cn";
import { deptColor } from "../../utils/departments";

export function RepositoryView({ onOpenPQ, allPqFilesList, fetchQuestions }: {
  onOpenPQ: (pq: PQFile) => void;
  allPqFilesList: PQFile[];
  fetchQuestions: () => void;
}) {
  const pqFiles = allPqFilesList;
  const [pendingQs, setPendingQs] = useState<QuestionRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<string, "approved" | "rejected">>({});
  const [, setLoading] = useState(true);

  const fetchPending = async () => {
    try {
      const q = query(collection(db, 'questions'), where('status', '==', 'pending'));
      const qSnap = await getDocs(q);
      setPendingQs(qSnap.docs.map(questionDoc => (
        { id: questionDoc.id, ...questionDoc.data() } as QuestionRecord
      )));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAction = async (qId: string, status: "approved" | "rejected") => {
    try {
      const qRef = doc(db, 'questions', qId);
      await updateDoc(qRef, { status });
      setStatuses(p => ({ ...p, [qId]: status }));
      
      if (status === "approved") {
        const docSnap = await getDoc(qRef);
        if (docSnap.exists()) {
          const qData = docSnap.data() as QuestionRecord;
          const courseCode = qData.courseCode || "General";
          const session = qData.session || "2024/2025";
          const semester = qData.semester || "First";
          const questionText = qData.questionText || "";
          
          const mcqQuery = query(
            collection(db, 'questions'), 
            where('courseCode', '==', courseCode),
            where('session', '==', session),
            where('type', '==', 'mcq')
          );
          const mcqSnap = await getDocs(mcqQuery);
          if (mcqSnap.empty) {
            console.log(`Generating automated MCQs for ${courseCode} (${session})...`);
            fetch("/api/generate-quizzes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                courseCode,
                session,
                semester,
                paperText: questionText
              })
            }).then(res => res.json())
              .then(async (data: { quizzes?: GeneratedQuizRecord[] }) => {
                if (data.quizzes && data.quizzes.length > 0) {
                  const toInsert: QuestionWriteRecord[] = data.quizzes.map(item => {
                    const row: QuestionWriteRecord = {
                      courseCode: courseCode.toUpperCase(),
                      courseTitle: courseCode.toUpperCase(),
                      department: qData.department || "General",
                      faculty: qData.faculty || "Technology",
                      session,
                      semester,
                      year: qData.year || 2024,
                      instructions: "Choose the correct option.",
                      section: "A",
                      number: "MCQ",
                      marks: item.marks || 5,
                      topic: item.topic || "General",
                      frequency: 5,
                      questionText: item.questionText || "",
                      solutionText: item.solution || "",
                      answer: item.answer || "",
                      type: "mcq",
                      status: "approved",
                      createdAt: Date.now(),
                      createdBy: "auto-quiz-generator"
                    };
                    if (item.options) row.options = item.options;
                    return row;
                  });
                  await Promise.all(toInsert.map(item => addDoc(collection(db, 'questions'), item)));
                  console.log(`Auto-generated and saved ${toInsert.length} MCQs for ${courseCode}.`);
                  fetchQuestions();
                }
              }).catch(err => console.error("Auto quiz generation failed:", err));
          }
        }
      }
      
      fetchQuestions();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">Repository</h1>
        <p className="text-gray-500 text-sm mt-1">All uploaded past question papers — approve, reject, or manage submissions.</p>
      </div>

      <div className="grid gap-6">
        {/* Published papers */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-[#0F2340] text-sm">Published Papers ({pqFiles.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pqFiles.map(pq => (
              <div key={pq.id} className="p-4 flex items-center gap-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0", deptColor(pq.department))}>
                  {pq.courseCode.split(" ")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">{pq.courseCode} Exam Question {pq.session}</p>
                  <p className="text-xs text-gray-400">{pq.courseTitle} · {pq.semester} Sem · {pq.questions.length} questions · {pq.totalMarks} marks</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <Check size={10} /> Published
                  </span>
                  <button onClick={() => onOpenPQ(pq)}
                    className="text-xs border border-gray-200 px-3 py-1.5 rounded-xl text-gray-600 hover:bg-gray-50 font-semibold">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending approval */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50">
            <h2 className="font-bold text-[#0F2340] text-sm">Pending Approval ({pendingQs.filter(p => !statuses[p.id]).length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingQs.map(item => {
              const s = statuses[item.id];
              const courseCode = item.courseCode || "General";
              return (
                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-bold shrink-0">
                      {courseCode.split(" ")[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800">{courseCode} Question {item.number || "1"} ({item.session || "Unknown session"})</p>
                      <p className="text-xs text-gray-400">Semester: {item.semester} · Topic: {item.topic} · Marks: {item.marks}</p>
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg mt-1 font-mono">{item.questionText?.substring(0, 150)}...</p>
                    </div>
                  </div>
                  {s ? (
                    <span className={cn("text-xs font-bold px-2.5 py-1 rounded-xl shrink-0 self-start md:self-center",
                      s === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                      {s === "approved" ? "Approved" : "Rejected"}
                    </span>
                  ) : (
                    <div className="flex gap-2 shrink-0 self-start md:self-center">
                      <button onClick={() => handleAction(item.id, "rejected")}
                        className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-semibold">Reject</button>
                      <button onClick={() => handleAction(item.id, "approved")}
                        className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold">Approve</button>
                    </div>
                  )}
                </div>
              );
            })}
            {pendingQs.length === 0 && (
              <p className="text-sm text-gray-300 text-center py-6">No pending questions — everything is reviewed!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
