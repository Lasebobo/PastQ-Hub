import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Menu } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";

import { PQViewer, Sidebar } from "./components";
import { AdminPanel, AuthModal, BookmarksView, ForumView, LibraryView, QuizView, RepositoryView, TrendsView, UploadView } from "./features";
import { useAuth } from "./lib/AuthContext";
import { db } from "./lib/firebase";
import { reconstructPQFiles } from "./services";
import type { PQFile, QuestionRecord, View } from "./types";

export function MainApp() {
  const { user, profile, loading, logout } = useAuth();
  const [view, setView] = useState<View>("library");
  const [selectedPQ, setSelectedPQ] = useState<PQFile | null>(null);
  const [quizPQ, setQuizPQ] = useState<PQFile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dbQuestions, setDbQuestions] = useState<QuestionRecord[]>([]);
  const [allPqFiles, setAllPqFiles] = useState<PQFile[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  const fetchQuestions = async () => {
    try {
      const q = query(collection(db, 'questions'), where('status', '==', 'approved'));
      const querySnapshot = await getDocs(q);
      const fetched = querySnapshot.docs.map(questionDoc => (
        { id: questionDoc.id, ...questionDoc.data() } as QuestionRecord
      ));
      setDbQuestions(fetched);
    } catch (err) {
      console.error("Error fetching questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchQuestions();
    }
  }, [user]);

  // Rebuild unconditionally: guarding on length > 0 left stale papers on screen after
  // the database was emptied (the Admin Panel's reset, or every question un-approved).
  useEffect(() => {
    setAllPqFiles(reconstructPQFiles(dbQuestions));
  }, [dbQuestions]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA]">
        <Loader2 className="w-8 h-8 text-[#0F2340] animate-spin" />
      </div>
    );
  }

  if (!user || !profile) return <AuthModal />;

  const currentUser = {
    name: profile.name,
    email: profile.email,
    role: profile.role,
    avatar: profile.name.substring(0, 2).toUpperCase()
  };

  const handleOpenPQ = (pq: PQFile) => { setSelectedPQ(pq); setView("library"); };
  const handleStartQuiz = (pq: PQFile) => { setQuizPQ(pq); setSelectedPQ(null); setView("quiz"); };

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden" style={{ fontFamily: "Outfit, sans-serif" }}>
      <div className="hidden lg:flex shrink-0">
        <Sidebar view={view} setView={v => { setView(v); setSelectedPQ(null); }} user={currentUser} onLogout={logout} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-pointer" onClick={() => setMobileOpen(false)} />
          <div className="relative w-60 h-full">
            <Sidebar view={view} setView={v => { setView(v); setSelectedPQ(null); setMobileOpen(false); }}
              user={currentUser} onLogout={logout}
              mobile onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0F2340] shrink-0">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-[#E8A020]" />
            <span className="text-white font-bold text-sm">PastQ Hub</span>
          </div>
          <button onClick={() => setMobileOpen(true)} className="text-white/60 hover:text-white"><Menu size={20} /></button>
        </header>

        <main className="flex-1 overflow-y-auto relative" style={{ scrollbarWidth: "none" }}>
          <AnimatePresence mode="wait">
            {loadingQuestions && view !== "upload" && view !== "admin" ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-16 flex flex-col items-center justify-center gap-3 h-full">
                <Loader2 className="w-6 h-6 text-[#0F2340] animate-spin" />
                <p className="text-gray-400 text-sm">Loading past questions…</p>
              </motion.div>
            ) : (
              <motion.div
                key={view === "library" && selectedPQ ? "pqviewer" : view}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="min-h-full"
              >
                {view === "library" && !selectedPQ && <LibraryView onOpenPQ={handleOpenPQ} user={currentUser} allPqFilesList={allPqFiles} />}
                {view === "library" && selectedPQ && <PQViewer pq={selectedPQ} onBack={() => setSelectedPQ(null)} onStartQuiz={handleStartQuiz} userProfile={profile} fetchQuestions={fetchQuestions} />}
                {view === "quiz" && <QuizView preloadPQ={quizPQ} allPqFilesList={allPqFiles} />}
                {view === "bookmarks" && <BookmarksView allPqFilesList={allPqFiles} userProfile={profile} onOpenPQ={handleOpenPQ} />}
                {view === "forum" && <ForumView user={currentUser} allPqFilesList={allPqFiles} />}
                {view === "trends" && <TrendsView allPqFilesList={allPqFiles} />}
                {view === "repository" && currentUser.role === "admin" && <RepositoryView onOpenPQ={handleOpenPQ} allPqFilesList={allPqFiles} fetchQuestions={fetchQuestions} />}
                {view === "upload" && currentUser.role !== "student" && <UploadView fetchQuestions={fetchQuestions} />}
                {view === "admin" && currentUser.role === "admin" && <AdminPanel />}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
