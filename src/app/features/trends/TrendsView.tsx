import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

import type { PQFile } from "../../types";
import { cn } from "../../utils/cn";
import { freqMeta, FreqIcon } from "../../utils/frequency";

export function TrendsView({ allPqFilesList }: { allPqFilesList: PQFile[] }) {
  const pqFiles = allPqFilesList;
  const [selPQ, setSelPQ] = useState<string>(pqFiles[0]?.id || "");

  useEffect(() => {
    if (pqFiles.length > 0 && !pqFiles.find(p => p.id === selPQ)) {
      setSelPQ(pqFiles[0].id);
    }
  }, [pqFiles, selPQ]);

  const pq = pqFiles.find(p => p.id === selPQ);

  const header = (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-[#0F2340]">Trend Analysis</h1>
      <p className="text-gray-500 text-sm mt-1">
        See which topics appear most frequently across every paper in the repository.
      </p>
    </div>
  );

  if (!pq) return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {header}
      <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
        <TrendingUp size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No papers in the repository yet.</p>
        <p className="text-gray-300 text-xs mt-1">Approve at least one paper to see topic trends.</p>
      </div>
    </div>
  );

  // Frequency = how many times a topic is actually asked across every paper in
  // the repository, counted here rather than read from a stored field.
  const globalTopicCounts = new Map<string, number>();
  pqFiles.forEach(p =>
    p.questions.forEach(q => globalTopicCounts.set(q.topic, (globalTopicCounts.get(q.topic) || 0) + 1)));

  const topicMap = new Map<string, number>();
  pq.questions.forEach(q => topicMap.set(q.topic, globalTopicCounts.get(q.topic) || 1));
  const topicStats = [...topicMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxFreq = topicStats[0]?.[1] || 1;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {header}
      <div className="mb-6">
        <select value={selPQ} onChange={e => setSelPQ(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2340]/20">
          {pqFiles.map(p => <option key={p.id} value={p.id}>{p.courseCode} — {p.session}</option>)}
        </select>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">Topic Frequency Ranking</h2>
          <div className="space-y-4">
            {topicStats.map(([topic, freq], i) => {
              const fm = freqMeta(freq);
              return (
                <div key={topic}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-bold w-5 h-5 rounded-md flex items-center justify-center",
                        i === 0 ? "bg-[#E8A020] text-[#0F2340]" : i <= 2 ? "bg-gray-200 text-gray-600" : "bg-gray-100 text-gray-400")}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">{topic}</span>
                      {i === 0 && <span className="text-[10px] font-bold bg-red-100 text-red-500 px-1.5 py-0.5 rounded-lg uppercase">HOT</span>}
                    </div>
                    <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg", fm.cls)}>
                      <FreqIcon type={fm.icon} /> {freq}×
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700",
                      freq >= 10 ? "bg-red-400" : freq >= 7 ? "bg-[#E8A020]" : "bg-[#0F2340]")}
                      style={{ width: `${(freq / maxFreq) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#0F2340] rounded-2xl p-6">
            <h2 className="font-bold text-[#E8A020] text-xs uppercase tracking-widest mb-4">Study Priority Guide</h2>
            <div className="space-y-3">
              {[
                { label: "🔥 Must Revise", topics: topicStats.filter(([, f]) => f >= 10).map(([t]) => t), cls: "border-red-400 text-red-300" },
                { label: "⚡ Important", topics: topicStats.filter(([, f]) => f >= 7 && f < 10).map(([t]) => t), cls: "border-[#E8A020] text-[#E8A020]" },
                { label: "📌 Supplementary", topics: topicStats.filter(([, f]) => f < 7).map(([t]) => t).slice(0, 3), cls: "border-white/20 text-white/50" },
              ].filter(g => g.topics.length > 0).map(({ label, topics, cls }) => (
                <div key={label} className={cn("border rounded-xl p-3", cls.split(" ")[0])}>
                  <p className={cn("text-xs font-bold mb-1.5", cls.split(" ")[1])}>{label}</p>
                  {topics.map(t => <p key={t} className="text-white/70 text-xs">{t}</p>)}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Paper Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: "Course", v: pq.courseCode },
                { l: "Session", v: pq.session },
                { l: "Semester", v: pq.semester },
                { l: "Total Qs", v: String(pq.questions.length) },
                { l: "Total Marks", v: `${pq.totalMarks} marks` },
                { l: "Sections", v: [...new Set(pq.questions.map(q => q.section))].join(", ") },
              ].map(({ l, v }) => (
                <div key={l} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">{l}</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
