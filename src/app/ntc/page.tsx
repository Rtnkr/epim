"use client";

import { useState, useRef } from "react";
import { Search, X, Loader2, AlertTriangle, Sparkles, Link2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface NTCResult {
  answer: string;
  rowCount?: number;
}

export default function NTCLookupPage() {
  const [productText, setProductText] = useState("");
  const [productURL, setProductURL] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NTCResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productText.trim() && !productURL.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ntc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productText, productURL }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setResult(data);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setProductText("");
    setProductURL("");
    setResult(null);
    setError(null);
  }

  // Render AI answer with basic markdown-ish formatting
  function renderAnswer(text: string) {
    const lines = text.split("\n");
    const nodes: React.ReactNode[] = [];
    let key = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { nodes.push(<div key={key++} className="h-2" />); continue; }

      // Bold headers starting with ** or numbered with bold
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        nodes.push(
          <p key={key++} className="text-sm font-bold text-[#1a1a18] mt-4 mb-1">
            {trimmed.slice(2, -2)}
          </p>
        );
        continue;
      }

      // Numbered items
      if (/^\d+\.\s/.test(trimmed)) {
        // Check for bold inline **text**
        const content = trimmed.replace(/^\d+\.\s/, "");
        nodes.push(
          <div key={key++} className="flex gap-3 py-1">
            <span className="shrink-0 w-5 text-right text-xs font-bold text-[#9c9c96] mt-0.5">
              {trimmed.match(/^\d+/)?.[0]}.
            </span>
            <p className="text-sm text-[#3d3d3a] leading-relaxed flex-1">
              {renderInline(content)}
            </p>
          </div>
        );
        continue;
      }

      // Bullet items
      if (/^[-•]\s/.test(trimmed)) {
        nodes.push(
          <div key={key++} className="flex gap-2.5 py-0.5 pl-4">
            <span className="text-[#c9c9c5] mt-1.5 text-xs shrink-0">—</span>
            <p className="text-sm text-[#3d3d3a] leading-relaxed">{renderInline(trimmed.slice(2))}</p>
          </div>
        );
        continue;
      }

      nodes.push(
        <p key={key++} className="text-sm text-[#3d3d3a] leading-relaxed py-0.5">
          {renderInline(trimmed)}
        </p>
      );
    }
    return nodes;
  }

  function renderInline(text: string): React.ReactNode {
    // Render **bold** inline
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <>
        {parts.map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i} className="font-semibold text-[#1a1a18]">
              {part.slice(2, -2)}
            </strong>
          ) : (
            part
          )
        )}
      </>
    );
  }

  const canSubmit = (productText.trim() || productURL.trim()) && !loading;

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Page header */}
      <div className="border-b border-[#e5e5e3] bg-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#f0f0ee] flex items-center justify-center">
              <Search className="w-4.5 h-4.5 text-[#1a1a18]" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1a1a18] tracking-tight">NTC Lookup</h1>
              <p className="text-xs text-[#9c9c96]">Find the best Noun / Type / Category for any product</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Input form */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#e5e5e3] bg-white overflow-hidden shadow-sm">
          {/* Product description */}
          <div className="p-5 border-b border-[#e5e5e3]">
            <label className="block text-xs font-semibold text-[#6b6b66] uppercase tracking-wider mb-2">
              Product Description
            </label>
            <div className="relative">
              <textarea
                value={productText}
                onChange={(e) => setProductText(e.target.value)}
                placeholder="Paste product info, specifications, or description…"
                rows={5}
                className="w-full text-sm text-[#1a1a18] placeholder-[#c9c9c5] resize-none focus:outline-none leading-relaxed"
              />
              {productText && (
                <button
                  type="button"
                  onClick={() => setProductText("")}
                  className="absolute top-0 right-0 p-1 rounded-md text-[#c9c9c5] hover:text-[#9c9c96] hover:bg-[#f0f0ee] transition-colors"
                  aria-label="Clear description"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* URL input */}
          <div className="px-5 py-3.5 border-b border-[#e5e5e3] bg-[#fafafa]">
            <div className="flex items-center gap-2.5">
              <Link2 className="w-3.5 h-3.5 text-[#c9c9c5] shrink-0" />
              <input
                type="url"
                value={productURL}
                onChange={(e) => setProductURL(e.target.value)}
                placeholder="Or paste a product URL (optional)"
                className="flex-1 text-sm text-[#1a1a18] placeholder-[#c9c9c5] bg-transparent focus:outline-none"
              />
              {productURL && (
                <button
                  type="button"
                  onClick={() => setProductURL("")}
                  className="p-0.5 text-[#c9c9c5] hover:text-[#9c9c96] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-3.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1.5 text-xs text-[#9c9c96] hover:text-[#6b6b66] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Clear all
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                canSubmit
                  ? "bg-[#1a1a18] text-white hover:bg-[#3d3d3a]"
                  : "bg-[#f0f0ee] text-[#c9c9c5] cursor-not-allowed"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Find NTC
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-100 bg-red-50">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div ref={resultRef} className="rounded-xl border border-[#e5e5e3] bg-white overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#e5e5e3] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1a1a18]" />
                <p className="text-sm font-semibold text-[#1a1a18]">NTC Recommendations</p>
              </div>
              {result.rowCount && (
                <span className="text-xs text-[#9c9c96]">
                  Searched {result.rowCount.toLocaleString()} entries
                </span>
              )}
            </div>
            <div className="px-6 py-5 space-y-0.5">
              {renderAnswer(result.answer)}
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {!result && !error && !loading && (
          <div className="text-center py-10">
            <p className="text-xs text-[#c9c9c5] leading-relaxed">
              Enter a product description or URL above, then click{" "}
              <span className="font-medium text-[#9c9c96]">Find NTC</span> to get AI-powered
              Noun / Type / Category suggestions from your uploaded NTC sheet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
