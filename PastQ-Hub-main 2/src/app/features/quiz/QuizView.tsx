import { useEffect, useRef, useState } from "react";
import { Award, Check, CheckCircle, ChevronRight, Clock, Eye, Loader2, Play, X, XCircle } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import type { PQFile, PQQuestion, QuizStep } from "../../types";
import { cn } from "../../utils/cn";
import { freqMeta, FreqIcon } from "../../utils/frequency";

export function QuizView({ preloadPQ, allPqFilesList }: { preloadPQ?: PQFile | null; allPqFilesList: PQFile[] }) {
  const pqFiles = allPqFilesList;
  const [step, setStep] = useState<QuizStep>(preloadPQ ? "setup" : "setup");
  const [selPQ, setSelPQ] = useState<string>(preloadPQ?.id || pqFiles[0]?.id || "pq_cpe508_2223");
  const [selTopics, setSelTopics] = useState<string[]>([]);
  const [numQ, setNumQ] = useState(5);
  const [timed, setTimed] = useState(false);
  const [limitMin, setLimitMin] = useState(10);
  const [immediate, setImmediate] = useState(true);
  const [questions, setQuestions] = useState<PQQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionScores, setQuestionScores] = useState<Record<string, number>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [gradingLoading, setGradingLoading] = useState(false);
  const [showSol, setShowSol] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [theoryInput, setTheoryInput] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Leaving the Quiz mid-countdown used to leave the interval running, which then
  // called setStep on an unmounted component every second.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (pqFiles.length > 0 && !pqFiles.find(p => p.id === selPQ)) {
      setSelPQ(pqFiles[0].id);
    }
  }, [pqFiles, selPQ]);

  const pqFile = pqFiles.find(p => p.id === selPQ);
  const topics = [...new Set((pqFile?.questions || []).map(q => q.topic))];

  const start = () => {
    let pool = (pqFile?.questions || []).filter(q =>
      selTopics.length === 0 || selTopics.includes(q.topic));
    if (!pool.length) pool = pqFile?.questions || [];
    if (!pool.length) pool = pqFiles.flatMap(p => p.questions);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, numQ);
    setQuestions(shuffled);
    setIdx(0); setAnswers({}); setQuestionScores({}); setFeedbacks({}); setShowSol(false); setTheoryInput("");
    if (timed) {
      setTimeLeft(limitMin * 60);
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current!); setStep("results"); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    setStep("taking");
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const q = questions[idx];

  const totalMarksEarned = Object.values(questionScores).reduce((a, b) => a + b, 0);
  const totalPossibleMarks = questions.reduce((sum, qx) => sum + (qx.marks || 5), 0);
  const percentage = totalPossibleMarks > 0 ? Math.round((totalMarksEarned / totalPossibleMarks) * 100) : 0;

  const userAns = q && answers[q.id];

  const answer = (a: string) => {
    if (answers[q.id]) return;
    setAnswers(p => ({ ...p, [q.id]: a }));
    const isCorrect = a === q.answer;
    setQuestionScores(p => ({ ...p, [q.id]: isCorrect ? (q.marks || 5) : 0 }));
    setFeedbacks(p => ({ ...p, [q.id]: isCorrect ? "Correct!" : `Incorrect. The correct answer is: ${q.answer}` }));
    if (immediate) setShowSol(true);
  };

  const submitTheory = async () => {
    if (!theoryInput.trim()) return;
    setGradingLoading(true);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: q.text,
          solution: q.solution,
          studentAnswer: theoryInput,
          marks: q.marks || 5
        })
      });
      const gradeResult = await res.json();
      setQuestionScores(p => ({ ...p, [q.id]: gradeResult.score ?? 0 }));
      setFeedbacks(p => ({ ...p, [q.id]: gradeResult.feedback || "Answer submitted." }));
    } catch (err) {
      console.error(err);
      setQuestionScores(p => ({ ...p, [q.id]: 0 }));
      setFeedbacks(p => ({ ...p, [q.id]: "Failed to grade theory answer." }));
    } finally {
      setAnswers(p => ({ ...p, [q.id]: theoryInput }));
      setGradingLoading(false);
      if (immediate) setShowSol(true);
    }
  };

  const next = () => {
    if (idx < questions.length - 1) { setIdx(i => i + 1); setShowSol(false); setTheoryInput(""); }
    else { if (timerRef.current) clearInterval(timerRef.current!); setStep("results"); }
  };

  const Toggle = ({ on, toggle, label, sub }: { on: boolean; toggle: () => void; label: string; sub: string }) => (
    <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl">
      <div><p className="text-sm font-semibold text-gray-700">{label}</p><p className="text-xs text-gray-400">{sub}</p></div>
      <button onClick={toggle} className={cn("w-11 h-6 rounded-full transition-all relative shrink-0", on ? "bg-[#0F2340]" : "bg-gray-200")}>
        <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );

  if (step === "setup") return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">Generate Quiz</h1>
        <p className="text-gray-500 text-sm mt-1">Build a custom quiz from any past question paper.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Question Paper</label>
          <select value={selPQ} onChange={e => { setSelPQ(e.target.value); setSelTopics([]); }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 focus:border-[#0F2340]">
            {pqFiles.map(p => <option key={p.id} value={p.id}>{p.courseCode} — {p.session} ({p.semester})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Topics <span className="font-normal text-gray-300 normal-case">(empty = all)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {topics.map(t => (
              <button key={t} onClick={() => setSelTopics(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
                className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                  selTopics.includes(t) ? "bg-[#0F2340] text-white border-[#0F2340]" : "border-gray-200 text-gray-500 hover:border-[#0F2340] hover:text-[#0F2340]")}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Questions: <span className="text-[#E8A020] text-sm font-bold">{numQ}</span>
          </label>
          <input type="range" min={3} max={Math.min(20, pqFile?.questions.length || 20)} value={numQ}
            onChange={e => setNumQ(Number(e.target.value))} className="w-full accent-[#E8A020]" />
          <div className="flex justify-between text-[10px] text-gray-300 mt-1"><span>3</span><span>20</span></div>
        </div>
        <div className="space-y-2">
          <Toggle on={timed} toggle={() => setTimed(p => !p)} label="Timed Quiz" sub="Adds a countdown timer" />
          {timed && (
            <div className="px-4">
              <label className="block text-xs text-gray-500 mb-1">Time: <span className="text-[#E8A020] font-bold">{limitMin} min</span></label>
              <input type="range" min={5} max={60} step={5} value={limitMin} onChange={e => setLimitMin(Number(e.target.value))} className="w-full accent-[#E8A020]" />
            </div>
          )}
          <Toggle on={immediate} toggle={() => setImmediate(p => !p)} label="Immediate Feedback" sub="Show answer after each question" />
        </div>
        <button onClick={start}
          className="w-full bg-[#E8A020] text-[#0F2340] font-bold py-3.5 rounded-2xl hover:bg-[#d49018] transition-colors flex items-center justify-center gap-2">
          <Play size={16} fill="currentColor" /> Start Quiz
        </button>
      </div>
    </div>
  );

  if (step === "results") return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
          percentage >= 70 ? "bg-emerald-100" : "bg-amber-100")}>
          <Award size={36} className={percentage >= 70 ? "text-emerald-600" : "text-amber-600"} />
        </div>
        <h2 className="text-2xl font-bold text-[#0F2340]">Quiz Complete!</h2>
        <p className="text-gray-400 text-sm mt-1 mb-6">
          {percentage >= 70 ? "Excellent work — keep this up!" : "Good effort — review the solutions below."}
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { l: "Marks Earned", v: `${totalMarksEarned}/${totalPossibleMarks}`, c: "text-[#0F2340]" },
            { l: "Accuracy Rating", v: `${percentage}%`, c: "text-emerald-600" },
          ].map(({ l, v, c }) => (
            <div key={l} className="bg-gray-50 rounded-2xl p-4">
              <p className={cn("text-2xl font-bold", c)}>{v}</p>
              <p className="text-xs text-gray-400 mt-1">{l}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3 mb-6 text-left max-h-60 overflow-y-auto">
          {questions.map(qx => {
            const earned = questionScores[qx.id] || 0;
            const possible = qx.marks || 5;
            const ok = earned >= possible * 0.6;
            const fb = feedbacks[qx.id] || "";
            return (
              <div key={qx.id} className={cn("p-3.5 rounded-xl border text-sm", ok ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100")}>
                <div className="flex items-start gap-2.5">
                  {ok ? <CheckCircle size={15} className="text-emerald-500 shrink-0 mt-0.5" /> : <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 text-xs font-semibold">Question {questions.indexOf(qx) + 1}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{qx.text}</p>
                    <div className="mt-2 text-xs">
                      <span className="font-semibold text-gray-700">Your Answer: </span>
                      <span className="text-gray-600 italic">"{answers[qx.id] || "No answer"}"</span>
                    </div>
                    {fb && (
                      <div className="mt-1.5 text-xs text-[#0F2340]">
                        <span className="font-semibold">Grading Feedback: </span>
                        <span>{fb} ({earned}/{possible} Marks)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setStep("setup"); if (timerRef.current) clearInterval(timerRef.current!); }}
            className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">New Quiz</button>
          <button onClick={start}
            className="flex-1 bg-[#0F2340] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#1a3a6b]">Retry</button>
        </div>
      </div>
    </div>
  );

  if (!q) return null;
  const fm = freqMeta(q.frequency);

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">Question {idx + 1} of {questions.length}</p>
          <div className="w-48 h-1.5 bg-gray-100 rounded-full mt-2">
            <div className="h-full bg-[#E8A020] rounded-full transition-all" style={{ width: `${(idx / questions.length) * 100}%` }} />
          </div>
        </div>
        {timed && (
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono font-bold text-sm",
            timeLeft < 60 ? "bg-red-100 text-red-600 animate-pulse" : "bg-gray-100 text-gray-700")}>
            <Clock size={14} /> {fmt(timeLeft)}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs font-bold text-[#0F2340] bg-blue-50 px-2.5 py-0.5 rounded-lg">{q.section === "A" ? "Section A" : "Section B"}</span>
          <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-lg">{q.topic}</span>
          <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg", fm.cls)}>
            <FreqIcon type={fm.icon} /> {fm.label}
          </span>
        </div>

        <div className="text-sm text-gray-800 leading-relaxed mb-5 whitespace-pre-wrap">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.text}</ReactMarkdown>
        </div>

        {q.options ? (
          <div className="space-y-2">
            {q.options.map(opt => (
              <button key={opt} onClick={() => answer(opt)} disabled={!!userAns}
                className={cn("w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all",
                  !userAns && "border-gray-200 text-gray-700 hover:border-[#0F2340] hover:bg-blue-50",
                  userAns && opt === q.answer && "bg-emerald-100 border-emerald-300 text-emerald-800",
                  userAns && opt === userAns && opt !== q.answer && "bg-red-100 border-red-300 text-red-700",
                  userAns && opt !== userAns && opt !== q.answer && "border-gray-100 text-gray-400 opacity-50",
                )}>
                <span className="flex items-center gap-2">
                  {userAns && opt === q.answer && <Check size={13} className="text-emerald-600 shrink-0" />}
                  {userAns && opt === userAns && opt !== q.answer && <X size={13} className="text-red-500 shrink-0" />}
                  <div className="inline-flex items-center"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p: ({node, ...props}) => <span {...props} />}}>{opt}</ReactMarkdown></div>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <textarea rows={4} placeholder="Write your answer here..."
              value={theoryInput} onChange={e => !userAns && setTheoryInput(e.target.value)} disabled={!!userAns || gradingLoading}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 resize-none mb-2 disabled:bg-gray-50" />
            {!userAns && (
              <button onClick={submitTheory} disabled={gradingLoading || !theoryInput.trim()}
                className="bg-[#0F2340] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#1a3a6b] transition-colors flex items-center gap-2 disabled:opacity-40">
                {gradingLoading ? <><Loader2 size={13} className="animate-spin" /> Grading Answer...</> : "Submit"}
              </button>
            )}
          </div>
        )}

        {(showSol || (userAns && immediate)) && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-2">Solution</p>
            <div className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed font-mono">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{q.solution}</ReactMarkdown>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-5">
          <button onClick={() => setShowSol(p => !p)} disabled={!userAns || gradingLoading}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 disabled:opacity-40">
            <Eye size={13} /> {showSol ? "Hide" : "Reveal"} solution
          </button>
          <button onClick={next} disabled={!userAns || gradingLoading}
            className="bg-[#E8A020] text-[#0F2340] px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#d49018] disabled:opacity-40 flex items-center gap-2">
            {idx < questions.length - 1 ? "Next" : "Finish"} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
