import { useState } from "react";
import { BookOpen, FileText, GraduationCap, Search, TrendingUp, X } from "lucide-react";

import { PQCard } from "../../components";
import type { PQFile, User } from "../../types";
import { cn } from "../../utils";

export function LibraryView({ onOpenPQ, user, allPqFilesList }: {
  onOpenPQ: (pq: PQFile) => void;
  user: User;
  allPqFilesList: PQFile[];
}) {
  const pqFiles = allPqFilesList;
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterYear, setFilterYear] = useState("");

  const depts = [...new Set(pqFiles.map(p => p.department))];
  const years = [...new Set(pqFiles.map(p => p.session))];

  const filtered = pqFiles.filter(p => {
    if (filterDept && p.department !== filterDept) return false;
    if (filterYear && p.session !== filterYear) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.courseCode.toLowerCase().includes(s) || p.courseTitle.toLowerCase().includes(s) ||
        p.department.toLowerCase().includes(s) || p.session.includes(s);
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F2340]">PQ Library</h1>
        <p className="text-gray-500 text-sm mt-1">Browse past question papers. Click any paper to view questions and solutions.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Papers Available", value: pqFiles.length, icon: FileText, bg: "bg-blue-50", fg: "text-blue-600" },
          { label: "Total Questions", value: pqFiles.reduce((s, p) => s + p.questions.length, 0), icon: BookOpen, bg: "bg-amber-50", fg: "text-amber-600" },
          { label: "Departments", value: depts.length, icon: GraduationCap, bg: "bg-purple-50", fg: "text-purple-600" },
          { label: "Sessions Covered", value: years.length, icon: TrendingUp, bg: "bg-emerald-50", fg: "text-emerald-600" },
        ].map(({ label, value, icon: Icon, bg, fg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2.5", bg)}>
              <Icon size={17} className={fg} />
            </div>
            <p className="text-xl font-bold text-[#0F2340]">{value}</p>
            <p className="text-gray-400 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search papers, courses, departments..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 focus:border-[#0F2340] transition-all" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 bg-white text-gray-600">
          <option value="">All Departments</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20 bg-white text-gray-600">
          <option value="">All Sessions</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {(search || filterDept || filterYear) && (
          <button onClick={() => { setSearch(""); setFilterDept(""); setFilterYear(""); }}
            className="text-xs text-[#E8A020] font-semibold hover:underline flex items-center gap-1">
            <X size={11} /> Clear
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">{filtered.length} paper{filtered.length !== 1 ? "s" : ""} found</p>

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <FileText size={40} className="text-gray-200 mx-auto mb-3" />
          {pqFiles.length === 0 ? (
            <>
              <p className="text-gray-400 text-sm">No papers in the repository yet.</p>
              <p className="text-gray-300 text-xs mt-1">
                {user.role === "student"
                  ? "Approved papers will appear here once a lecturer uploads them."
                  : "Upload a paper, then approve it in the Repository to publish it here."}
              </p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">No papers match your search.</p>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(pq => (
          <PQCard key={pq.id} pq={pq} onOpen={() => onOpenPQ(pq)} />
        ))}
      </div>
    </div>
  );
}
