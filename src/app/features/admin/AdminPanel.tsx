import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";

import { samplePqFiles } from "../../data/samplePapers";
import { useAuth } from "../../lib/AuthContext";
import { db } from "../../lib/firebase";
import { deleteThreadAndComments } from "../../services";
import type { FlaggedThreadRecord, QuestionRecord, QuestionWriteRecord, Role, UserRecord } from "../../types";
import { cn } from "../../utils";

type StatCard = { label: string; val: string; c: string };

export function AdminPanel() {
  const [stats, setStats] = useState<StatCard[]>([
    { label: "Total Papers", val: "0", c: "text-blue-600" },
    { label: "Pending Review", val: "0", c: "text-amber-600" },
    { label: "Registered Users", val: "1", c: "text-emerald-600" },
    { label: "Flagged Posts", val: "0", c: "text-red-500" },
  ]);
  const [flagged, setFlagged] = useState<FlaggedThreadRecord[]>([]);
  const [modBusy, setModBusy] = useState<string | null>(null);
  const [modMsg, setModMsg] = useState("");

  // Moderation used to be entirely decorative: `flagged` was a state array nothing
  // ever filled, and the buttons only hid rows locally. These act on Firestore.
  const resolveFlag = async (tid: string, action: "dismiss" | "remove") => {
    if (action === "remove" && !confirm("Delete this post permanently? This cannot be undone.")) return;
    setModBusy(tid); setModMsg("");
    try {
      if (action === "remove") {
        await deleteThreadAndComments(tid);
      } else {
        await updateDoc(doc(db, 'threads', tid), { flagged: false, flagReason: "", flaggedBy: "" });
      }
      setFlagged(prev => prev.filter(f => f.id !== tid));
    } catch (err: any) {
      setModMsg(`Could not ${action === "remove" ? "delete" : "dismiss"} that post: ${err.message || err}`);
    } finally {
      setModBusy(null);
    }
  };
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roleSaving, setRoleSaving] = useState<string | null>(null);
  const [roleMsg, setRoleMsg] = useState("");
  const { user: authUser } = useAuth();

  // Derived from `users` rather than stored, so the counts stay honest the moment a
  // role is changed below, instead of waiting for a refetch.
  const userCounts = {
    Students: users.filter(u => u.role === "student").length,
    Lecturers: users.filter(u => u.role === "lecturer").length,
    Admins: users.filter(u => u.role === "admin").length,
  };

  // Granting a role is the one privileged action firestore.rules reserves for admins.
  // Without this, promoting a lecturer would mean editing Firestore by hand.
  const changeRole = async (uid: string, nextRole: Role) => {
    if (uid === authUser?.uid) {
      setRoleMsg("You cannot change your own role — ask another admin.");
      return;
    }
    setRoleSaving(uid); setRoleMsg("");
    const previous = users.find(u => u.id === uid)?.role || "student";
    setUsers(prev => prev.map(u => (u.id === uid ? { ...u, role: nextRole } : u)));
    try {
      await updateDoc(doc(db, 'users', uid), { role: nextRole });
      setRoleMsg(`Role updated. It takes effect the next time they load the app.`);
    } catch (err: any) {
      setUsers(prev => prev.map(u => (u.id === uid ? { ...u, role: previous } : u)));
      setRoleMsg(`Could not update role: ${err.message || err}`);
    } finally {
      setRoleSaving(null);
    }
  };

  // Publishes the bundled sample papers into Firestore. Field names here must match
  // what reconstructPQFiles() reads back — questionText/solutionText, not text/solution.
  const seedDemoData = async () => {
    setSeeding(true); setSeedMsg("");
    try {
      const existing = await getDocs(query(collection(db, 'questions'), where('createdBy', '==', 'system')));
      if (!existing.empty) {
        setSeedMsg(`Already seeded — ${existing.size} sample questions are in the database.`);
        return;
      }

      const toInsert = samplePqFiles.flatMap(pq => pq.questions.map(q => {
        const row: QuestionWriteRecord = {
          courseCode: pq.courseCode,
          courseTitle: pq.courseTitle,
          department: pq.department,
          faculty: pq.faculty,
          session: pq.session,
          semester: pq.semester,
          year: pq.year,
          instructions: pq.instructions,
          section: q.section,
          number: q.number,
          marks: q.marks,
          topic: q.topic,
          frequency: q.frequency,
          questionText: q.text,
          solutionText: q.solution,
          answer: q.answer,
          type: q.type,
          status: "approved",
          createdAt: Date.now(),
          createdBy: "system",
        };
        // Firestore rejects undefined — only include options when the question has them.
        if (q.options) row.options = q.options;
        return row;
      }));

      await Promise.all(toInsert.map(row => addDoc(collection(db, 'questions'), row)));
      setSeedMsg(`Published ${toInsert.length} questions across ${samplePqFiles.length} papers. Reloading…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      setSeedMsg(`Seeding failed: ${err.message || err}`);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersList = usersSnap.docs.map(userDoc => (
          { ...userDoc.data(), id: userDoc.id } as UserRecord
        ));
        setUsers(usersList.sort((a, b) => (a.name || "").localeCompare(b.name || "")));

        const pendingSnap = await getDocs(query(collection(db, 'questions'), where('status', '==', 'pending')));
        const pendingCount = pendingSnap.docs.length;

        const approvedSnap = await getDocs(query(collection(db, 'questions'), where('status', '==', 'approved')));
        
        const paperKeys = new Set<string>();
        approvedSnap.docs.forEach(questionDoc => {
          const d = questionDoc.data() as QuestionRecord;
          paperKeys.add(`${d.courseCode}_${d.session}_${d.semester}`);
        });
        const papersCount = paperKeys.size;

        const flaggedSnap = await getDocs(query(collection(db, 'threads'), where('flagged', '==', true)));
        const flaggedList = flaggedSnap.docs.map(threadDoc => (
          { id: threadDoc.id, ...threadDoc.data() } as FlaggedThreadRecord
        ));
        setFlagged(flaggedList);

        setStats([
          { label: "Total Papers", val: String(papersCount), c: "text-blue-600" },
          { label: "Pending Review", val: String(pendingCount), c: "text-amber-600" },
          { label: "Registered Users", val: String(usersList.length), c: "text-emerald-600" },
          { label: "Flagged Posts", val: String(flaggedList.length), c: "text-red-500" },
        ]);

      } catch (err) {
        console.error(err);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">Admin Panel</h1>
        <p className="text-gray-500 text-sm mt-1">System overview, user management, and content moderation.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, val, c }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className={cn("text-2xl font-bold", c)}>{val}</p>
            <p className="text-xs text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
        <div className="p-5 border-b border-gray-50">
          <h2 className="font-bold text-[#0F2340] text-sm">Flagged Forum Posts ({flagged.length})</h2>
          <p className="text-gray-400 text-xs mt-0.5">Posts reported by students and lecturers.</p>
          {modMsg && <p className="text-red-600 text-xs mt-2 font-semibold">{modMsg}</p>}
        </div>
        <div className="divide-y divide-gray-50">
          {flagged.map(f => (
            <div key={f.id} className="p-4">
              <p className="text-sm font-semibold text-gray-800 mb-0.5">"{f.title}"</p>
              <p className="text-xs text-gray-400 mb-1">
                By {f.authorName || "Unknown"} · reported by {f.flaggedBy || "someone"}
              </p>
              <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg mb-3">{f.flagReason}</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => resolveFlag(f.id, "dismiss")} disabled={modBusy === f.id}
                  className="px-3 py-1.5 text-xs border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 font-semibold disabled:opacity-50">
                  Dismiss report
                </button>
                <button onClick={() => resolveFlag(f.id, "remove")} disabled={modBusy === f.id}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold disabled:opacity-50">
                  Delete post
                </button>
                {modBusy === f.id && <Loader2 size={13} className="animate-spin text-gray-400 self-center" />}
              </div>
            </div>
          ))}
          {flagged.length === 0 && (
            <p className="p-4 text-sm text-gray-300 text-center">No flagged posts — all clear!</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-50"><h2 className="font-bold text-[#0F2340] text-sm">User Roles Overview</h2></div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { role: "Students", count: userCounts.Students, desc: "Browse library, take quizzes, join forums", color: "bg-blue-50 text-blue-700" },
              { role: "Lecturers", count: userCounts.Lecturers, desc: "All student features + suggest uploads", color: "bg-purple-50 text-purple-700" },
              { role: "Admins", count: userCounts.Admins, desc: "Full system access — upload, approve, moderate", color: "bg-amber-50 text-amber-700" },
            ].map(({ role, count, desc, color }) => (
              <div key={role} className="bg-gray-50 rounded-2xl p-4">
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-lg", color)}>{role}</span>
                <p className="text-2xl font-bold text-[#0F2340] mt-2">{count}</p>
                <p className="text-xs text-gray-400 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Role management — the only way to grant a role once firestore.rules is live,
          since self-registration can only ever produce a student. */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-50">
          <h2 className="font-bold text-[#0F2340] text-sm">Manage Roles</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            People can only sign up as students. Promote lecturers and admins here.
          </p>
          {roleMsg && (
            <p className={cn("text-xs mt-2 font-semibold",
              roleMsg.startsWith("Role updated") ? "text-emerald-600" : "text-red-600")}>
              {roleMsg}
            </p>
          )}
        </div>
        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {users.map(u => {
            const isSelf = u.id === authUser?.uid;
            return (
              <div key={u.id} className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-[#0F2340] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {(u.name || u.email || "?").substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {u.name || "Unnamed"}
                    {isSelf && <span className="text-[10px] text-gray-400 font-normal ml-1.5">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                {roleSaving === u.id && <Loader2 size={13} className="animate-spin text-gray-400 shrink-0" />}
                <select
                  value={u.role || "student"}
                  disabled={isSelf || roleSaving === u.id}
                  onChange={e => changeRole(u.id, e.target.value as Role)}
                  title={isSelf ? "You cannot change your own role" : "Change this person's role"}
                  className="border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-gray-600 bg-white shrink-0 focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            );
          })}
          {users.length === 0 && (
            <p className="text-sm text-gray-300 text-center py-6">No registered users yet.</p>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-[#0F2340] font-bold text-sm">Demo Data</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            Publish the {samplePqFiles.length} bundled sample papers ({samplePqFiles.reduce((s, p) => s + p.questions.length, 0)} questions)
            to Firestore so the Library, Quiz and Trends screens have content to show.
          </p>
          {seedMsg && (
            <p className={cn("text-xs mt-1.5 font-semibold",
              seedMsg.startsWith("Seeding failed") ? "text-red-600" : "text-emerald-600")}>
              {seedMsg}
            </p>
          )}
        </div>
        <button onClick={seedDemoData} disabled={seeding}
          className="px-4 py-2.5 bg-[#0F2340] text-white rounded-xl font-bold text-xs hover:bg-[#1a3a6b] transition-colors shrink-0 disabled:opacity-60 flex items-center gap-2">
          {seeding && <Loader2 size={12} className="animate-spin" />}
          {seeding ? "Seeding…" : "Seed demo data"}
        </button>
      </div>

      <div className="mt-4 bg-red-50 border border-red-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-red-800 font-bold text-sm">Dangerous Zone</h3>
          <p className="text-red-600 text-xs mt-0.5">Wipe the Firestore database to remove all demo data and start with a fresh website.</p>
        </div>
        <button onClick={async () => {
          if (confirm("Are you sure you want to completely wipe all past questions, forum threads, and user bookmarks from the database? This action is irreversible.")) {
            try {
              const qsSnap = await getDocs(collection(db, 'questions'));
              await Promise.all(qsSnap.docs.map(doc => deleteDoc(doc.ref)));

              const thSnap = await getDocs(collection(db, 'threads'));
              await Promise.all(thSnap.docs.map(threadDoc => deleteThreadAndComments(threadDoc.id)));

              alert("Database successfully wiped! Refresh the page to see the fresh slate.");
              window.location.reload();
            } catch (err: any) {
              alert("Error wiping database: " + err.message);
            }
          }
        }} className="px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition-colors shrink-0">
          Reset Database
        </button>
      </div>
    </div>
  );
}
