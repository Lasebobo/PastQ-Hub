import { useEffect, useState } from "react";
import { BookMarked, ChevronDown, ChevronRight } from "lucide-react";
import { arrayRemove, doc, updateDoc } from "firebase/firestore";

import { db } from "../../lib/firebase";
import type { UserProfile } from "../../lib/AuthContext";
import type { PQFile } from "../../types";
import { cn } from "../../utils/cn";
import { deptColor } from "../../utils/departments";

export function BookmarksView({ allPqFilesList, userProfile, onOpenPQ }: {
  allPqFilesList: PQFile[];
  userProfile: UserProfile;
  onOpenPQ: (pq: PQFile) => void;
}) {
  // Kept locally so removing a bookmark updates immediately — AuthContext only
  // refetches the profile on an auth state change, not after a write.
  const [saved, setSaved] = useState<Set<string>>(new Set(userProfile?.bookmarkedQuestions || []));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    if (userProfile?.bookmarkedQuestions) setSaved(new Set(userProfile.bookmarkedQuestions));
  }, [userProfile]);

  const remove = async (qId: string) => {
    setError("");
    const next = new Set(saved); next.delete(qId);
    setSaved(next);
    try {
      await updateDoc(doc(db, 'users', userProfile.id), { bookmarkedQuestions: arrayRemove(qId) });
    } catch (err: any) {
      setSaved(prev => new Set(prev).add(qId));
      setError(err.message || "Could not remove that bookmark.");
    }
  };

  const toggle = (id: string) =>
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Group saved questions under the paper they came from, so the list stays readable.
  const groups = allPqFilesList
    .map(pq => ({ pq, questions: pq.questions.filter(q => saved.has(q.id)) }))
    .filter(g => g.questions.length > 0);

  const totalSaved = groups.reduce((s, g) => s + g.questions.length, 0);
  // A bookmark can outlive its question — an admin can delete or un-approve it.
  const orphaned = saved.size - totalSaved;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">Bookmarks</h1>
        <p className="text-gray-500 text-sm mt-1">
          Questions you saved for later review{totalSaved > 0 ? ` — ${totalSaved} saved` : ""}.
        </p>
        {error && <p className="text-red-600 text-xs mt-2 font-semibold">{error}</p>}
        {orphaned > 0 && (
          <p className="text-gray-400 text-xs mt-2">
            {orphaned} saved question{orphaned !== 1 ? "s are" : " is"} no longer in the repository and cannot be shown.
          </p>
        )}
      </div>

      {groups.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <BookMarked size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Nothing saved yet.</p>
          <p className="text-gray-300 text-xs mt-1">
            Open any paper in the Library and tap the bookmark icon on a question to save it here.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map(({ pq, questions }) => (
          <div key={pq.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0", deptColor(pq.department))}>
                {pq.courseCode.split(" ")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{pq.courseCode} — {pq.session}</p>
                <p className="text-xs text-gray-400 truncate">{pq.courseTitle} · {questions.length} saved</p>
              </div>
              <button onClick={() => onOpenPQ(pq)}
                className="text-xs border border-gray-200 px-3 py-1.5 rounded-xl text-gray-600 hover:bg-gray-50 font-semibold shrink-0">
                Open paper
              </button>
            </div>

            <div className="divide-y divide-gray-50">
              {questions.map(q => {
                const open = expanded.has(q.id);
                return (
                  <div key={q.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold text-gray-400 mt-0.5 shrink-0">{q.number}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{q.text}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg">{q.topic}</span>
                          <span className="text-[10px] text-gray-400">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                          <button onClick={() => toggle(q.id)}
                            className="text-[11px] font-semibold text-[#E8A020] hover:underline flex items-center gap-0.5">
                            {open ? <><ChevronDown size={11} /> Hide answer</> : <><ChevronRight size={11} /> Show answer</>}
                          </button>
                        </div>
                      </div>
                      <button onClick={() => remove(q.id)} title="Remove bookmark"
                        className="text-[#E8A020] hover:text-gray-400 transition-colors shrink-0">
                        <BookMarked size={15} />
                      </button>
                    </div>

                    {open && (
                      <div className="mt-3 ml-6 space-y-2">
                        {q.options && (
                          <div className="space-y-1">
                            {q.options.map(opt => (
                              <p key={opt} className="text-xs text-gray-500">{opt}</p>
                            ))}
                          </div>
                        )}
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                            {q.type === "fillblank" ? "Answer" : "Model Answer"}
                          </p>
                          <p className="text-sm text-emerald-900 font-semibold">{q.answer}</p>
                        </div>
                        {q.solution && (
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Solution</p>
                            <p className="text-xs text-gray-600 whitespace-pre-line">{q.solution}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
