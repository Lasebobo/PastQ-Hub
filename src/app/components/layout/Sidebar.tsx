import { BookMarked, FolderOpen, GraduationCap, Library, LogOut, MessageSquare, Play, ShieldCheck, TrendingUp, Upload, X } from "lucide-react";

import type { User, View } from "../../types";
import { cn } from "../../utils/cn";

export function Sidebar({ view, setView, user, onLogout, mobile, onClose }: {
  view: View; setView: (v: View) => void; user: User; onLogout: () => void;
  mobile?: boolean; onClose?: () => void;
}) {
  const nav = [
    { id: "library" as View, icon: Library, label: "PQ Library" },
    { id: "quiz" as View, icon: Play, label: "Quiz" },
    { id: "bookmarks" as View, icon: BookMarked, label: "Bookmarks" },
    { id: "forum" as View, icon: MessageSquare, label: "Forum" },
    { id: "trends" as View, icon: TrendingUp, label: "Trends" },
    ...(user.role !== "student" ? [{ id: "upload" as View, icon: Upload, label: "Upload" }] : []),
    ...(user.role === "admin" ? [
      { id: "repository" as View, icon: FolderOpen, label: "Repository" },
      { id: "admin" as View, icon: ShieldCheck, label: "Admin Panel" },
    ] : []),
  ];

  const go = (v: View) => { setView(v); onClose?.(); };

  return (
    <aside className="bg-[#0F2340] flex flex-col h-full w-60">
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#E8A020] flex items-center justify-center shrink-0">
            <GraduationCap size={18} className="text-[#0F2340]" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">PastQ Hub</p>
            <p className="text-white/40 text-[10px] mt-0.5">OAU Science Repository</p>
          </div>
        </div>
        {mobile && <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={18} /></button>}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => go(id)}
            className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
              view === id ? "bg-[#E8A020] text-[#0F2340]" : "text-white/60 hover:bg-white/10 hover:text-white")}>
            <Icon size={17} className="shrink-0" />{label}
          </button>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#E8A020] flex items-center justify-center text-xs font-bold text-[#0F2340] shrink-0">
            {user.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user.name}</p>
            <p className="text-white/40 text-[10px] capitalize">{user.role}</p>
          </div>
          <button onClick={onLogout} className="text-white/30 hover:text-white/80 transition-colors" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
