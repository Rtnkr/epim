"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, BookOpen } from "lucide-react";

const navLinks = [
  { href: "/analyze", label: "AI Assistant" },
  { href: "/sops", label: "Rules" },
  { href: "/ntc", label: "NTC Lookup" },
  { href: "/rules", label: "Manage Docs" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#e5e5e3] bg-white/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-md bg-[#1a1a18] flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-white" strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold text-[#1a1a18] tracking-tight">
            Process Hub
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150",
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "bg-[#f0f0ee] text-[#1a1a18]"
                  : "text-[#6b6b66] hover:text-[#1a1a18] hover:bg-[#f9f9f8]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#e5e5e3] text-sm text-[#9c9c96] hover:border-[#c9c9c5] hover:text-[#6b6b66] transition-colors duration-150 cursor-pointer"
            aria-label="Search SOPs"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline ml-1 text-[10px] px-1.5 py-0.5 bg-[#f0f0ee] rounded text-[#9c9c96] font-mono">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
