"use client";

import { SOPStep } from "@/types/sop";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface TableOfContentsProps {
  steps: SOPStep[];
}

export function TableOfContents({ steps }: TableOfContentsProps) {
  const [active, setActive] = useState<number>(1);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = Number(entry.target.getAttribute("data-step"));
            if (id) setActive(id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    steps.forEach((step) => {
      const el = document.querySelector(`[data-step="${step.id}"]`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [steps]);

  return (
    <div className="sticky top-20">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96] mb-3">
        Steps
      </p>
      <nav className="space-y-0.5">
        {steps.map((step) => (
          <a
            key={step.id}
            href={`#step-${step.id}`}
            className={cn(
              "flex items-start gap-2.5 py-1.5 px-2 rounded text-xs transition-colors duration-150",
              active === step.id
                ? "text-[#1a1a18] font-medium"
                : "text-[#9c9c96] hover:text-[#6b6b66]"
            )}
          >
            <span
              className={cn(
                "shrink-0 w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold mt-0.5 transition-colors",
                active === step.id
                  ? "border-[#1a1a18] bg-[#1a1a18] text-white"
                  : "border-[#c9c9c5] text-[#9c9c96]"
              )}
            >
              {step.id}
            </span>
            <span className="leading-relaxed">{step.title}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
