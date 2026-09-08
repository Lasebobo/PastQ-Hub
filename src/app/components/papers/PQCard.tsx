import { Check, ChevronRight } from "lucide-react";

import type { PQFile } from "../../types";
import { cn } from "../../utils/cn";
import { deptColor } from "../../utils/departments";
import { freqMeta, FreqIcon } from "../../utils/frequency";

export function PQCard({ pq, onOpen }: { pq: PQFile; onOpen: () => void }) {
  const topTopics = [...new Map(pq.questions.map(q => [q.topic, q.frequency])).entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all group cursor-pointer flex flex-col"
      onClick={onOpen}>
      <div className={cn("h-2 rounded-t-2xl", deptColor(pq.department))} />
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className={cn("text-xs font-bold text-white px-2.5 py-1 rounded-lg shrink-0", deptColor(pq.department))}>
            {pq.courseCode}
          </span>
          {pq.approved && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
              <Check size={9} /> Verified
            </span>
          )}
        </div>

        <h3 className="font-bold text-[#0F2340] text-sm leading-snug mb-1 group-hover:text-blue-700 transition-colors">
          {pq.courseCode} Exam Question {pq.session}
        </h3>
        <p className="text-xs text-gray-500 mb-1">{pq.courseTitle}</p>
        <p className="text-xs text-gray-400 mb-3">{pq.department}</p>

        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          <span className="bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">{pq.session}</span>
          <span className="bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">{pq.semester} Sem</span>
          <span className="bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">{pq.questions.length} Qs</span>
        </div>

        <div className="flex-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Top Topics</p>
          <div className="space-y-1">
            {topTopics.map(([topic, freq]) => {
              const { cls, icon } = freqMeta(freq);
              return (
                <div key={topic} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 truncate">{topic}</span>
                  <span className={cn("flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ml-2 shrink-0", cls)}>
                    <FreqIcon type={icon} />{freq}×
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">by {pq.uploadedBy.split(" ").slice(-1)[0]}</span>
          <span className="text-xs font-bold text-[#0F2340] group-hover:text-[#E8A020] flex items-center gap-1 transition-colors">
            View Paper <ChevronRight size={12} />
          </span>
        </div>
      </div>
    </div>
  );
}
