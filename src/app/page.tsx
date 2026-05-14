import Link from "next/link";
import { ArrowRight, FileSearch, BookOpen, Layers } from "lucide-react";
import { SOPS } from "@/lib/sop";

const features = [
  {
    icon: FileSearch,
    title: "AI Assistant",
    description:
      "Paste a product description, URL, or image — get instant field attributions from your rules.",
    href: "/analyze",
    cta: "Open Assistant",
  },
  {
    icon: BookOpen,
    title: "Rules Reference",
    description:
      "Browse all your SOP documents in one place. Search, verify, and clarify any rule instantly.",
    href: "/sops",
    cta: "Browse Rules",
  },
  {
    icon: Layers,
    title: "NTC Lookup",
    description:
      "Give product info or a URL — get the most suitable Noun / Type / Category combination.",
    href: "/ntc",
    cta: "Find NTC",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Hero */}
      <section className="border-b border-[#e5e5e3] bg-white">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#e5e5e3] bg-[#f9f9f8] text-xs font-medium text-[#6b6b66] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            AI-powered process intelligence
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1a1a18] tracking-tight leading-tight mb-5">
            Your process rules,
            <br />
            <span className="text-[#6b6b66]">instantly accessible.</span>
          </h1>
          <p className="text-base text-[#6b6b66] leading-relaxed mb-8 max-w-xl mx-auto">
            Ask any product question, look up an NTC, or verify a rule — all
            powered by your uploaded SOP documents.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1a1a18] text-white text-sm font-semibold hover:bg-[#3d3d3a] transition-colors shadow-sm"
            >
              Ask AI Assistant
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/ntc"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#e5e5e3] bg-white text-sm font-medium text-[#3d3d3a] hover:border-[#c9c9c5] transition-colors"
            >
              NTC Lookup
            </Link>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Link
                key={f.href}
                href={f.href}
                className="group flex flex-col gap-4 p-6 rounded-xl border border-[#e5e5e3] bg-white hover:border-[#c9c9c5] hover:shadow-[0_4px_16px_0_rgb(0_0_0/0.07)] transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-[#f0f0ee] flex items-center justify-center group-hover:bg-[#e5e5e3] transition-colors">
                  <Icon className="w-5 h-5 text-[#1a1a18]" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1a1a18] mb-1.5">
                    {f.title}
                  </p>
                  <p className="text-xs text-[#9c9c96] leading-relaxed">
                    {f.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-[#6b6b66] group-hover:text-[#1a1a18] transition-colors">
                  {f.cta}
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
