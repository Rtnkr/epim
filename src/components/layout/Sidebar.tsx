"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CATEGORY_META } from "@/lib/sop";
import {
  Users,
  Settings,
  Shield,
  Heart,
  DollarSign,
  Scale,
  LayoutGrid,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  Users,
  Settings,
  Shield,
  Heart,
  DollarSign,
  Scale,
};

export function Sidebar() {
  const pathname = usePathname();
  const categories = Object.values(CATEGORY_META);

  return (
    <aside className="w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-[#e5e5e3] bg-white py-6 px-3">
      <div className="mb-4 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96]">
          Categories
        </p>
      </div>

      <nav className="space-y-0.5">
        <Link
          href="/sops"
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150",
            pathname === "/sops"
              ? "bg-[#f0f0ee] text-[#1a1a18]"
              : "text-[#6b6b66] hover:text-[#1a1a18] hover:bg-[#f9f9f8]"
          )}
        >
          <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
          <span>All SOPs</span>
        </Link>

        <div className="my-2 mx-3 h-px bg-[#e5e5e3]" />

        {categories.map((cat) => {
          const Icon = iconMap[cat.icon] ?? Settings;
          const isActive = pathname.startsWith(`/sops/${cat.id}`);
          return (
            <Link
              key={cat.id}
              href={`/sops/${cat.id}`}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-[#f0f0ee] text-[#1a1a18]"
                  : "text-[#6b6b66] hover:text-[#1a1a18] hover:bg-[#f9f9f8]"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">{cat.label}</span>
              {cat.count > 0 && (
                <span className="text-[10px] tabular-nums text-[#9c9c96]">
                  {cat.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
