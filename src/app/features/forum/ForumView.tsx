import { useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, Heart, MessageSquare, Plus, Send, Share2, Star, X, Eye } from "lucide-react";
import { addDoc, arrayRemove, arrayUnion, collection, doc, increment, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";

import { auth, db } from "../../lib/firebase";
import type { ForumComment, ForumRoleLabel, ForumThread, PQFile, User } from "../../types";
import { cn } from "../../utils/cn";

export function ForumView({ user, allPqFilesList }: { user: User; allPqFilesList: PQFile[] }) {
  const pqFiles = allPqFilesList;
  const [selCourse, setSelCourse] = useState("CPE 508");
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [commentsByThread, setCommentsByThread] = useState<Record<string, ForumComment[]>>({});
  const [selThread, setSelThread] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [comment, setComment] = useState("");
  const viewedThreadsRef = useRef<Set<string>>(new Set());

  const initials = (name: string) => (name || "AN").substring(0, 2).toUpperCase();
  const roleLabel = (role: string): ForumRoleLabel =>
    role === "admin" || role === "Admin" ? "Admin"
    : role === "lecturer" || role === "Lecturer" ? "Lecturer"
    : "Student";
  const dateLabel = (value: any) => {
    const ms = typeof value === "number" ? value : value?.toMillis?.() || Date.now();
    return new Date(ms).toISOString().split("T")[0];
  };
  const mapComment = (id: string, data: any, legacy = false): ForumComment => {
    const likes = data.likes || [];
    const author = data.authorName || data.author || "Anonymous";
    return {
      id,
      author,
      role: roleLabel(data.role),
      avatar: initials(author),
      date: dateLabel(data.createdAt),
      text: data.content || data.text || "",
      likes: likes.length,
      rawLikes: likes,
      isLiked: likes.includes(auth.currentUser?.uid || ""),
      legacy
    };
  };

  useEffect(() => {
    const q = query(collection(db, 'threads'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const fetched = snapshot.docs.map(threadDoc => {
        const data = threadDoc.data();
        const legacyComments = (data.comments || []).map((c: any, index: number) =>
          mapComment(c.id || `legacy_${index}`, c, true)
        );
        const rawLikes = data.likes || [];
        return {
          id: threadDoc.id,
          courseId: data.courseCode || data.courseId || "General",
          title: data.title || "",
          author: data.authorName || "Anonymous",
          authorAvatar: initials(data.authorName || "Anonymous"),
          date: dateLabel(data.createdAt),
          views: data.views || 0,
          likes: rawLikes.length,
          replies: Math.max(data.replyCount || 0, legacyComments.length),
          pinned: data.pinned || false,
          flagged: data.flagged || false,
          body: data.content || "",
          legacyComments,
          rawLikes
        };
      });
      setThreads(fetched);
    }, err => {
      console.error("Error streaming forum threads:", err);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selThread) return;
    const q = query(collection(db, 'threads', selThread, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, snapshot => {
      setCommentsByThread(prev => ({
        ...prev,
        [selThread]: snapshot.docs.map(commentDoc => mapComment(commentDoc.id, commentDoc.data()))
      }));
    }, err => {
      console.error("Error streaming forum comments:", err);
    });

    return () => unsubscribe();
  }, [selThread]);

  useEffect(() => {
    if (selThread && threads.length > 0 && !threads.some(t => t.id === selThread)) {
      setSelThread(null);
    }
  }, [selThread, threads]);

  const openThread = (tid: string) => {
    setSelThread(tid);
    setComment("");
    if (viewedThreadsRef.current.has(tid)) return;
    viewedThreadsRef.current.add(tid);
    updateDoc(doc(db, 'threads', tid), { views: increment(1) })
      .catch(err => {
        viewedThreadsRef.current.delete(tid);
        console.error("Error incrementing forum thread views:", err);
      });
  };

  // Course tabs come from both approved papers and existing forum threads. That keeps
  // discussions reachable even if the repository is empty or a paper is unapproved.
  const courses = [...new Set([
    ...pqFiles.map(p => p.courseCode),
    ...threads.map(t => t.courseId)
  ])];
  const activeCourse = courses.includes(selCourse) ? selCourse : courses[0] || "General";

  // "CPE 508" is only the initial guess — fall back to a course that actually exists.
  useEffect(() => {
    if (courses.length > 0 && !courses.includes(selCourse)) setSelCourse(courses[0]);
  }, [courses.join(","), selCourse]);
  const courseThreads = threads.filter(t => t.courseId === activeCourse);
  const thread = threads.find(t => t.id === selThread);
  const streamedComments = selThread ? commentsByThread[selThread] : undefined;
  const visibleComments = streamedComments && streamedComments.length > 0
    ? streamedComments
    : thread?.legacyComments || [];

  const postThread = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !newTitle.trim() || !newBody.trim()) return;
    try {
      await addDoc(collection(db, 'threads'), {
        courseCode: activeCourse.toUpperCase(),
        title: newTitle.trim(),
        content: newBody.trim(),
        authorId: uid,
        authorName: user.name,
        createdAt: Date.now(),
        views: 0,
        replyCount: 0,
        likes: [],
        flagged: false
      });
      setNewTitle(""); setNewBody(""); setNewOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const postComment = async (tid: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid || !comment.trim()) return;
    try {
      const threadRef = doc(db, 'threads', tid);
      const commentRef = doc(collection(db, 'threads', tid, 'comments'));
      const batch = writeBatch(db);
      batch.set(commentRef, {
        authorId: uid,
        authorName: user.name,
        role: roleLabel(user.role),
        content: comment.trim(),
        createdAt: Date.now(),
        likes: []
      });
      batch.update(threadRef, { replyCount: increment(1) });
      await batch.commit();
      setComment("");
    } catch (err) {
      console.error(err);
    }
  };

  const toggleThreadLike = async (tid: string) => {
    const uid = auth.currentUser?.uid;
    const th = threads.find(t => t.id === tid);
    if (!uid || !th) return;
    const hasLiked = th.rawLikes.includes(uid);
    const threadRef = doc(db, 'threads', tid);
    try {
      await updateDoc(threadRef, {
        likes: hasLiked ? arrayRemove(uid) : arrayUnion(uid)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleCommentLike = async (tid: string, cid: string) => {
    const uid = auth.currentUser?.uid;
    const selectedComment = visibleComments.find(c => c.id === cid);
    if (!uid || !selectedComment || selectedComment.legacy) return;
    const hasLiked = selectedComment.rawLikes.includes(uid);
    try {
      await updateDoc(doc(db, 'threads', tid, 'comments', cid), {
        likes: hasLiked ? arrayRemove(uid) : arrayUnion(uid)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const roleBadge = (role: string) => {
    if (role === "Admin" || role === "Lecturer") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-500";
  };

  // Reporting writes onto the thread itself, so admins can review it without a second
  // moderation collection.
  const reportThread = async (tid: string) => {
    const reason = prompt("What is wrong with this post? (optional)") ?? undefined;
    if (reason === undefined) return; // cancelled
    try {
      await updateDoc(doc(db, 'threads', tid), {
        flagged: true,
        flagReason: reason.trim() || "No reason given",
        flaggedBy: user.name,
        flaggedAt: Date.now(),
      });
      alert("Reported. An administrator will review this post.");
    } catch (err: any) {
      alert(`Could not report this post: ${err.message || err}`);
    }
  };

  if (selThread && thread) return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <button onClick={() => setSelThread(null)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#0F2340] mb-5 transition-colors">
        <ChevronLeft size={15} /> Back to forum
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <h1 className="text-xl font-bold text-[#0F2340] mb-3">{thread.title}</h1>
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-[#0F2340] flex items-center justify-center text-white text-[10px] font-bold">{thread.authorAvatar}</div>
            <span className="font-semibold text-gray-600">{thread.author}</span>
          </div>
          <span>·</span><span>{thread.date}</span><span>·</span>
          <span className="flex items-center gap-1"><Eye size={11} />{thread.views}</span>
          <button onClick={() => reportThread(thread.id)}
            disabled={thread.flagged}
            title={thread.flagged ? "Already reported" : "Report this post to an administrator"}
            className="ml-auto flex items-center gap-1 text-gray-300 hover:text-red-500 transition-colors disabled:text-amber-500 disabled:cursor-default">
            <AlertCircle size={12} />{thread.flagged ? "Reported" : "Report"}
          </button>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{thread.body}</p>
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-50">
          <button onClick={() => toggleThreadLike(thread.id)}
            className={cn("flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl transition-all",
              thread.rawLikes?.includes(auth.currentUser?.uid || "") ? "bg-red-50 text-red-500" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600")}>
            <Heart size={14} fill={thread.rawLikes?.includes(auth.currentUser?.uid || "") ? "currentColor" : "none"} /> {thread.likes}
          </button>
          <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-xl hover:bg-gray-50">
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {visibleComments.length === 0 && <p className="text-sm text-gray-300 text-center py-4">No replies yet — be the first!</p>}
        {visibleComments.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-full bg-[#E8A020] flex items-center justify-center text-[10px] font-bold text-[#0F2340]">{c.avatar}</div>
              <span className="text-sm font-bold text-gray-800">{c.author}</span>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wide", roleBadge(c.role))}>{c.role}</span>
              <span className="text-xs text-gray-300 ml-auto">{c.date}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{c.text}</p>
            <button onClick={() => toggleCommentLike(thread.id, c.id)}
              disabled={c.legacy}
              title={c.legacy ? "Legacy embedded replies are read-only after the forum migration" : "Like this reply"}
              className={cn("flex items-center gap-1.5 text-xs font-semibold mt-2.5 px-2 py-1 rounded-lg transition-all",
                c.isLiked ? "text-red-500 bg-red-50" : "text-gray-300 hover:bg-gray-50 hover:text-gray-500",
                c.legacy && "opacity-50 cursor-not-allowed hover:bg-transparent")}>
              <Heart size={11} fill={c.isLiked ? "currentColor" : "none"} /> {c.likes}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <textarea rows={3} placeholder="Write a reply..." value={comment} onChange={e => setComment(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 focus:border-[#0F2340] mb-3 transition-all" />
        <div className="flex justify-end">
          <button onClick={() => postComment(thread.id)}
            className="bg-[#0F2340] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#1a3a6b] flex items-center gap-1.5">
            <Send size={13} /> Reply
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2340]">Discussion Forum</h1>
          <p className="text-gray-500 text-sm mt-1">Course-specific threads — discuss questions and share solutions.</p>
        </div>
        <button onClick={() => setNewOpen(true)}
          className="bg-[#E8A020] text-[#0F2340] px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#d49018] flex items-center gap-2 shrink-0">
          <Plus size={15} /> New Thread
        </button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {courses.map(c => (
          <button key={c} onClick={() => setSelCourse(c)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
              activeCourse === c ? "bg-[#0F2340] text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-[#0F2340] hover:text-[#0F2340]")}>
            {c}
          </button>
        ))}
      </div>

      {newOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-[#0F2340]">New Thread — {activeCourse}</h2>
              <button onClick={() => setNewOpen(false)} className="text-gray-300 hover:text-gray-600"><X size={18} /></button>
            </div>
            <input placeholder="Thread title..." value={newTitle} onChange={e => setNewTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20" />
            <textarea rows={5} placeholder="Describe your question or topic in detail..." value={newBody} onChange={e => setNewBody(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none mb-5 focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNewOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={postThread} className="px-4 py-2 text-sm bg-[#0F2340] text-white rounded-xl font-bold hover:bg-[#1a3a6b]">Post Thread</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {courseThreads.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <MessageSquare size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No threads yet for {activeCourse}.</p>
            <button onClick={() => setNewOpen(true)} className="mt-3 text-sm text-[#E8A020] font-semibold hover:underline">Start one →</button>
          </div>
        )}
        {courseThreads.map(t => (
          <div key={t.id} onClick={() => openThread(t.id)}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md cursor-pointer transition-all group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {t.pinned && <Star size={12} className="text-[#E8A020] shrink-0" fill="currentColor" />}
                  <h3 className="font-bold text-gray-800 text-sm group-hover:text-[#0F2340] line-clamp-1">{t.title}</h3>
                </div>
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">{t.body}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-5 h-5 rounded-full bg-[#0F2340] flex items-center justify-center text-white text-[9px] font-bold">{t.authorAvatar}</div>
                  <span>{t.author}</span><span>·</span><span>{t.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-300 shrink-0">
                <span className="flex items-center gap-1"><Eye size={11} />{t.views}</span>
                <span className="flex items-center gap-1"><Heart size={11} />{t.likes}</span>
                <span className="flex items-center gap-1"><MessageSquare size={11} />{t.replies}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
