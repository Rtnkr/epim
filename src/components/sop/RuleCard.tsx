import Link from "next/link";
import { SOP } from "@/types/sop";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/utils";
import { ArrowRight, Calendar, User } from "lucide-react";

interface RuleCardProps {
  sop: SOP;
}

export function RuleCard({ sop }: RuleCardProps) {
  return (
    <Link
      href={`/sops/${sop.category}/${sop.slug}`}
      className="group block rounded-lg border border-[#e5e5e3] bg-white p-5 shadow-[0_1px_3px_0_rgb(0_0_0/0.06)] hover:shadow-[0_4px_12px_0_rgb(0_0_0/0.08)] hover:border-[#c9c9c5] transition-all duration-200"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96]">
              {sop.id}
            </span>
            <span className="text-[#e5e5e3]">·</span>
            <span className="text-[10px] font-medium text-[#9c9c96]">
              v{sop.version}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-[#1a1a18] leading-snug group-hover:text-[#3d3d3a] transition-colors">
            {sop.title}
          </h3>
        </div>
        <StatusBadge status={sop.status} size="sm" />
      </div>

      {/* Description */}
      <p className="text-sm text-[#6b6b66] leading-relaxed line-clamp-2 mb-4">
        {sop.description}
      </p>

      {/* Meta row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-[#9c9c96]">
            <User className="w-3 h-3" />
            {sop.owner}
          </span>
          <span className="flex items-center gap-1 text-xs text-[#9c9c96]">
            <Calendar className="w-3 h-3" />
            {formatDate(sop.lastReviewed)}
          </span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-[#c9c9c5] group-hover:text-[#6b6b66] group-hover:translate-x-0.5 transition-all duration-150" />
      </div>

      {/* Tags */}
      {sop.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#f0f0ee]">
          {sop.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[#f0f0ee] text-[#9c9c96] font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
