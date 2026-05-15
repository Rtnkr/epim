"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, MessageSquare, X, Send, Loader2, FileText, AlertTriangle, RefreshCw, BookOpen, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface DocMeta { id: string; name: string; type: string; content: string; uploadedAt: string }
interface ChatMsg { role: "user" | "assistant"; content: string }

// ─── Content cleaner ─────────────────────────────────────────
function clean(raw: string): string {
  const text = raw.replace(/\xa0/g, " ").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");
  let tocStart = -1, tocEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (tocStart === -1 && /^table of contents$/i.test(t)) tocStart = i;
    if (tocStart >= 0 && /\t\d+\s*$/.test(lines[i])) tocEnd = i;
    if (tocStart >= 0 && tocEnd >= 0 && i > tocEnd + 10) break;
  }
  const out: string[] = [];
  let blanks = 0;
  for (let i = 0; i < lines.length; i++) {
    if (tocStart >= 0 && tocEnd >= 0 && i >= tocStart && i <= tocEnd) continue;
    const t = lines[i].replace(/\xa0/g, " ").trim();
    if (/\t\d+\s*$/.test(lines[i])) continue;
    if (/^\d{1,3}$/.test(t)) continue;
    if (!t) { if (blanks === 0) out.push(""); blanks++; continue; }
    blanks = 0; out.push(t);
  }
  while (out.length && !out[0]) out.shift();
  while (out.length && !out[out.length - 1]) out.pop();
  return out.join("\n");
}

// ─── Block model ─────────────────────────────────────────────
type Block =
  | { kind: "doc-title"; text: string }
  | { kind: "attr-header"; code: string; label: string; id: string }
  | { kind: "section"; text: string; id: string; level: 1 | 2 }
  | { kind: "example"; text: string }
  | { kind: "callout"; variant: "note" | "exception" | "warning"; text: string }
  | { kind: "bullet"; text: string; depth: number }
  | { kind: "numbered"; num: string; text: string }
  | { kind: "unspsc"; code: string; desc: string; keywords: string }
  | { kind: "paragraph"; text: string }
  | { kind: "blank" };

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let secIdx = 0;
  let isFirst = true;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    if (!t) { blocks.push({ kind: "blank" }); i++; continue; }

    // First non-blank line = document title
    if (isFirst) {
      isFirst = false;
      blocks.push({ kind: "doc-title", text: t });
      i++; continue;
    }

    // Attribute header: "N – NOUN", "T – TYPE", "1 – TRADEMARK/BRAND NAME"
    const attrMatch = t.match(/^([A-Z0-9]{1,3})\s*[–—-]+\s*(.+)/) ;
    if (attrMatch && t.length < 80 && !/^\d{4}/.test(t)) {
      const id = `s${secIdx++}`;
      blocks.push({ kind: "attr-header", code: attrMatch[1].trim(), label: attrMatch[2].trim(), id });
      i++; continue;
    }

    // Example
    if (/^(EX|EXAMPLE|E\.G\.)\s*:/i.test(t)) {
      blocks.push({ kind: "example", text: t });
      i++; continue;
    }

    // Note / Exception / Warning callout
    const calloutMatch = t.match(/^(NOTE|EXCEPTION|WARNING|IMPORTANT)\s*:/i);
    if (calloutMatch) {
      const variant = calloutMatch[1].toUpperCase() === "NOTE" ? "note" : calloutMatch[1].toUpperCase() === "WARNING" ? "warning" : "exception";
      blocks.push({ kind: "callout", variant, text: t });
      i++; continue;
    }

    // UNSPSC 8-digit code — look ahead for desc + keywords
    if (/^\d{8}$/.test(t)) {
      let desc = "", kw = "", skip = 0;
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const next = lines[j].trim();
        if (!next) continue;
        if (!desc) { desc = next; skip = j - i; continue; }
        if (!kw) { kw = next; skip = j - i; break; }
      }
      blocks.push({ kind: "unspsc", code: t, desc, keywords: kw });
      i += skip + 1; continue;
    }

    // ALL CAPS section header
    const isAllCaps = t === t.toUpperCase() && /[A-Z]{2}/.test(t) && t.length > 3 && t.length < 90;
    const endsColon = t.endsWith(":") && t.length < 80 && !/^[-•]/.test(t);
    const numbered = /^\d+\.\d+\s/.test(t) && t.length < 90;
    const bigSection = /^\d+\.\s+[A-Z]/.test(t) && t.length < 90;

    if (isAllCaps || bigSection) {
      const id = `s${secIdx++}`;
      blocks.push({ kind: "section", text: t.replace(/:$/, ""), id, level: 1 });
      i++; continue;
    }
    if (endsColon || numbered) {
      const id = `s${secIdx++}`;
      blocks.push({ kind: "section", text: t.replace(/:$/, ""), id, level: 2 });
      i++; continue;
    }

    // Bullet
    if (/^[-•●◦▸→]\s/.test(t)) {
      const depth = raw.match(/^\s+/) ? 2 : 1;
      blocks.push({ kind: "bullet", text: t.replace(/^[-•●◦▸→]\s/, ""), depth });
      i++; continue;
    }

    // Numbered list item
    if (/^(\d+|[a-z])[.)]\s/i.test(t)) {
      const num = t.match(/^(\d+|[a-z])[.)]/i)?.[0] ?? "";
      blocks.push({ kind: "numbered", num, text: t.replace(/^(\d+|[a-z])[.)]\s*/i, "") });
      i++; continue;
    }

    blocks.push({ kind: "paragraph", text: t });
    i++;
  }
  return blocks;
}

// ─── TOC extraction ───────────────────────────────────────────
interface TocEntry { id: string; label: string; kind: "attr" | "section" | "section2" }

function extractToc(blocks: Block[]): TocEntry[] {
  return blocks.flatMap((b): TocEntry[] => {
    if (b.kind === "attr-header") return [{ id: b.id, label: `${b.code} — ${b.label}`, kind: "attr" }];
    if (b.kind === "section" && b.level === 1) return [{ id: b.id, label: b.text, kind: "section" }];
    if (b.kind === "section" && b.level === 2) return [{ id: b.id, label: b.text, kind: "section2" }];
    return [];
  });
}

// ─── Inline highlight ─────────────────────────────────────────
function Hi({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${esc})`, "gi"));
  return <>{parts.map((p, i) => p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="bg-amber-200 text-amber-900 rounded-sm px-0.5">{p}</mark> : p)}</>;
}

// ─── Block renderer ───────────────────────────────────────────
function RenderBlock({ block, q }: { block: Block; q: string }) {
  switch (block.kind) {
    case "blank":
      return <div className="h-2" />;

    case "doc-title":
      return (
        <div className="mb-6 pb-5 border-b border-[#e5e5e3]">
          <h1 className="text-xl font-bold text-[#1a1a18] leading-snug">
            <Hi text={block.text} q={q} />
          </h1>
        </div>
      );

    case "attr-header":
      return (
        <div id={block.id} className="mt-8 mb-4 scroll-mt-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#1a1a18] text-white">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-black tracking-tight"><Hi text={block.code} q={q} /></span>
            </div>
            <div>
              <p className="text-xs font-medium text-white/50 uppercase tracking-widest mb-0.5">Attribute {block.code}</p>
              <p className="text-base font-bold"><Hi text={block.label} q={q} /></p>
            </div>
          </div>
        </div>
      );

    case "section":
      return block.level === 1 ? (
        <h2 id={block.id} className="mt-7 mb-3 scroll-mt-6 text-sm font-bold text-[#1a1a18] uppercase tracking-wide flex items-center gap-2">
          <span className="w-4 h-px bg-[#1a1a18] inline-block" />
          <Hi text={block.text} q={q} />
        </h2>
      ) : (
        <h3 id={block.id} className="mt-5 mb-2 scroll-mt-6 text-sm font-semibold text-[#1a1a18] pl-3 border-l-2 border-[#e5e5e3]">
          <Hi text={block.text} q={q} />
        </h3>
      );

    case "example":
      return (
        <div className="my-2 flex items-start gap-2.5 px-4 py-3 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0]">
          <span className="shrink-0 text-[10px] font-bold text-[#166534] uppercase tracking-widest mt-0.5 pt-px">EX</span>
          <p className="text-sm font-mono text-[#166534] leading-relaxed">
            <Hi text={block.text.replace(/^(EX|EXAMPLE|E\.G\.)\s*:\s*/i, "")} q={q} />
          </p>
        </div>
      );

    case "callout": {
      const styles = {
        note: "bg-[#eff6ff] border-[#bfdbfe] text-[#1e40af]",
        exception: "bg-[#fffbeb] border-[#fde68a] text-[#92400e]",
        warning: "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]",
      };
      const labels = { note: "Note", exception: "Exception", warning: "Warning" };
      return (
        <div className={cn("my-2 flex items-start gap-2.5 px-4 py-3 rounded-lg border", styles[block.variant])}>
          <span className={cn("shrink-0 text-[10px] font-bold uppercase tracking-widest mt-0.5 pt-px")}>{labels[block.variant]}</span>
          <p className="text-sm leading-relaxed">
            <Hi text={block.text.replace(/^(NOTE|EXCEPTION|WARNING|IMPORTANT)\s*:\s*/i, "")} q={q} />
          </p>
        </div>
      );
    }

    case "bullet":
      return (
        <div className={cn("flex gap-2.5 py-0.5", block.depth === 2 && "pl-5")}>
          <span className="shrink-0 w-1 h-1 rounded-full bg-[#9c9c96] mt-2" />
          <p className="text-sm text-[#3d3d3a] leading-relaxed">
            <Hi text={block.text} q={q} />
          </p>
        </div>
      );

    case "numbered":
      return (
        <div className="flex gap-3 py-0.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-[#f0f0ee] flex items-center justify-center text-[10px] font-bold text-[#6b6b66] mt-0.5">
            {block.num.replace(/[.)]/g, "")}
          </span>
          <p className="text-sm text-[#3d3d3a] leading-relaxed flex-1">
            <Hi text={block.text} q={q} />
          </p>
        </div>
      );

    case "unspsc":
      return (
        <div className="flex items-start gap-3 py-1.5 px-3 rounded-lg border border-[#f0f0ee] bg-[#fafafa] my-1 hover:border-[#e5e5e3] transition-colors">
          <code className="shrink-0 text-[11px] font-mono font-bold bg-white border border-[#e5e5e3] text-[#6b6b66] px-2 py-1 rounded-md mt-0.5 tracking-wider">{block.code}</code>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#1a1a18] leading-snug"><Hi text={block.desc} q={q} /></p>
            {block.keywords && <p className="text-[11px] text-[#9c9c96] mt-0.5 truncate font-mono"><Hi text={block.keywords} q={q} /></p>}
          </div>
        </div>
      );

    case "paragraph":
      return (
        <p className="text-sm text-[#3d3d3a] leading-relaxed py-0.5">
          <Hi text={block.text} q={q} />
        </p>
      );

    default:
      return null;
  }
}

// ─── Search helpers ───────────────────────────────────────────
interface SearchHit {
  docId: string; docName: string;
  line: string; context: string; section: string;
}

function buildSearchHits(docs: DocMeta[], q: string): SearchHit[] {
  if (!q || q.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const content = clean(doc.content);
    const lines = content.split("\n");
    let currentSection = "";
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) continue;
      const attrMatch = t.match(/^([A-Z0-9]{1,3})\s*[–—-]+\s*(.+)/);
      if (attrMatch && t.length < 80) { currentSection = `${attrMatch[1]} — ${attrMatch[2]}`; continue; }
      if (t.endsWith(":") && t.length < 80) currentSection = t.replace(/:$/, "");
      if (t.toLowerCase().includes(q.toLowerCase())) {
        const prev = lines[i - 1]?.trim() ?? "";
        const next = lines[i + 1]?.trim() ?? "";
        const context = [prev, next].filter(Boolean).join(" · ").slice(0, 120);
        hits.push({ docId: doc.id, docName: doc.name, line: t, context, section: currentSection });
      }
    }
  }
  return hits.slice(0, 100);
}

// ─── Main component ───────────────────────────────────────────
export default function RulesViewerPage() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [selected, setSelected] = useState<DocMeta | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/documents/content")
      .then((r) => r.json())
      .then((d) => {
        const rules = (d.documents ?? []).filter((doc: DocMeta) => doc.type === "rule" || doc.type === "reference");
        setDocs(rules);
        if (rules.length) setSelected(rules[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cleanedContent = useMemo(() => selected ? clean(selected.content) : "", [selected]);
  const blocks = useMemo(() => parseBlocks(cleanedContent), [cleanedContent]);
  const toc = useMemo(() => extractToc(blocks), [blocks]);

  const q = search.trim().toLowerCase();
  const isSearching = q.length >= 2;

  const allHits = useMemo(() => buildSearchHits(docs, q), [docs, q]);
  const hitsByDoc = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const h of allHits) {
      if (!map.has(h.docId)) map.set(h.docId, []);
      map.get(h.docId)!.push(h);
    }
    return map;
  }, [allHits]);

  function pickDoc(doc: DocMeta) {
    setSelected(doc);
    setSearch("");
    contentRef.current?.scrollTo({ top: 0 });
  }

  function jumpTo(id: string) {
    contentRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMsgs((p) => [...p, { role: "user", content: question }]);
    setChatLoading(true);
    const ctx = selected ? `Rule document: "${selected.name}"\n\n${cleanedContent.slice(0, 8000)}` : "All uploaded rule documents";
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText: `[Rule context: ${ctx}]\n\nQuestion: ${question}`, history: chatMsgs }),
      });
      const data = await res.json();
      setChatMsgs((p) => [...p, { role: "assistant", content: data.answer ?? data.error ?? "No response." }]);
    } catch {
      setChatMsgs((p) => [...p, { role: "assistant", content: "Error reaching AI." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  return (
    <div className="flex flex-1 h-[calc(100vh-3.5rem-53px)] overflow-hidden bg-[#f9f9f8]">

      {/* ── Left: Document list ──────────────────────────── */}
      <aside className="w-[240px] shrink-0 border-r border-[#e5e5e3] bg-white flex flex-col">
        <div className="px-4 pt-5 pb-3 border-b border-[#e5e5e3]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9c9c96] mb-3">Rule Documents</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#c9c9c5] pointer-events-none" />
            <input
              type="text"
              placeholder="Search all rules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-7 py-2 text-xs border border-[#e5e5e3] rounded-lg bg-[#f9f9f8] text-[#1a1a18] placeholder-[#c9c9c5] focus:outline-none focus:border-[#c9c9c5] focus:bg-white transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-[#c9c9c5] hover:text-[#6b6b66]" />
              </button>
            )}
          </div>
          {isSearching && (
            <p className="text-[10px] text-[#9c9c96] mt-2">
              {allHits.length} result{allHits.length !== 1 ? "s" : ""} across {hitsByDoc.size} doc{hitsByDoc.size !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-[#9c9c96]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : docs.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <AlertTriangle className="w-5 h-5 text-[#e5e5e3] mx-auto mb-2" />
              <p className="text-xs text-[#9c9c96] mb-1">No documents yet.</p>
              <Link href="/rules" className="text-xs text-[#1a1a18] underline">Upload →</Link>
            </div>
          ) : (
            docs.map((doc) => {
              const hitCount = hitsByDoc.get(doc.id)?.length ?? 0;
              const active = !isSearching && selected?.id === doc.id;
              const shortName = doc.name.replace(/\.[^.]+$/, "");
              return (
                <button
                  key={doc.id}
                  onClick={() => pickDoc(doc)}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150",
                    active ? "bg-[#1a1a18] text-white shadow-sm" : "hover:bg-[#f0f0ee] text-[#6b6b66] hover:text-[#1a1a18]"
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    active ? "bg-white/10" : "bg-[#f0f0ee]")}>
                    <FileText className={cn("w-4 h-4", active ? "text-white" : "text-[#9c9c96]")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-snug truncate">{shortName}</p>
                    <p className={cn("text-[10px] mt-0.5", active ? "text-white/50" : "text-[#c9c9c5]")}>
                      {new Date(doc.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  {isSearching && hitCount > 0 && (
                    <span className="shrink-0 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 mt-0.5 tabular-nums">{hitCount}</span>
                  )}
                  {active && !isSearching && <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-white/40" />}
                </button>
              );
            })
          )}
        </nav>
      </aside>

      {/* ── Center: Content ──────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {isSearching ? (
          <>
            <div className="px-7 py-4 border-b border-[#e5e5e3] bg-white flex items-center gap-3 shrink-0">
              <Search className="w-4 h-4 text-[#9c9c96]" />
              <p className="text-sm font-semibold text-[#1a1a18]">Results for &ldquo;{search}&rdquo;</p>
            </div>
            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-8">
              {allHits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <BookOpen className="w-10 h-10 text-[#e5e5e3] mb-3" />
                  <p className="text-sm text-[#9c9c96]">No matches found.</p>
                </div>
              ) : (
                Array.from(hitsByDoc.entries()).map(([docId, hits]) => {
                  const doc = docs.find((d) => d.id === docId)!;
                  return (
                    <div key={docId}>
                      <button onClick={() => pickDoc(doc)} className="flex items-center gap-2 mb-3 group">
                        <div className="w-5 h-5 rounded-md bg-[#f0f0ee] flex items-center justify-center">
                          <FileText className="w-3 h-3 text-[#9c9c96]" />
                        </div>
                        <span className="text-xs font-semibold text-[#6b6b66] group-hover:text-[#1a1a18] transition-colors">
                          {doc.name.replace(/\.[^.]+$/, "")}
                        </span>
                        <span className="text-[10px] text-[#c9c9c5]">— {hits.length} match{hits.length !== 1 ? "es" : ""}</span>
                      </button>
                      <div className="space-y-2">
                        {hits.map((hit, i) => (
                          <button
                            key={i}
                            onClick={() => pickDoc(doc)}
                            className="w-full text-left px-4 py-3 rounded-xl border border-[#e5e5e3] bg-white hover:border-[#c9c9c5] hover:shadow-sm transition-all group"
                          >
                            {hit.section && (
                              <p className="text-[10px] font-semibold text-[#9c9c96] uppercase tracking-wider mb-1.5">{hit.section}</p>
                            )}
                            <p className="text-sm text-[#1a1a18] leading-relaxed">
                              <Hi text={hit.line} q={q} />
                            </p>
                            {hit.context && (
                              <p className="text-[11px] text-[#9c9c96] mt-1.5 leading-relaxed line-clamp-2">{hit.context}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : selected ? (
          <>
            <div className="px-7 py-4 border-b border-[#e5e5e3] bg-white flex items-center gap-4 shrink-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#1a1a18] truncate">{selected.name.replace(/\.[^.]+$/, "")}</p>
                <p className="text-[10px] text-[#9c9c96] mt-0.5">
                  Updated {new Date(selected.uploadedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  {toc.length > 0 && ` · ${toc.length} sections`}
                </p>
              </div>
              <button
                onClick={() => { setChatOpen(true); setChatMsgs([]); }}
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a18] text-white text-xs font-semibold hover:bg-[#3d3d3a] transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask AI
              </button>
            </div>
            <div ref={contentRef} className="flex-1 overflow-y-auto">
              <div className="px-8 py-7 max-w-2xl mx-auto">
                {blocks.map((block, i) => <RenderBlock key={i} block={block} q="" />)}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#f0f0ee] flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-[#c9c9c5]" />
            </div>
            <p className="text-sm text-[#9c9c96]">Select a document to view</p>
          </div>
        )}
      </div>

      {/* ── Right: TOC ───────────────────────────────────── */}
      {!isSearching && selected && toc.length > 0 && (
        <aside className="w-[200px] shrink-0 border-l border-[#e5e5e3] bg-white flex flex-col overflow-hidden">
          <div className="px-4 pt-5 pb-3 border-b border-[#e5e5e3]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9c9c96]">On this page</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
            {toc.map((entry) => (
              <button
                key={entry.id}
                onClick={() => jumpTo(entry.id)}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 rounded-lg transition-colors text-[11px] leading-snug",
                  entry.kind === "attr"
                    ? "font-bold text-[#1a1a18] hover:bg-[#f0f0ee]"
                    : entry.kind === "section"
                    ? "font-medium text-[#6b6b66] hover:bg-[#f9f9f8] hover:text-[#1a1a18]"
                    : "text-[#9c9c96] pl-4 hover:text-[#6b6b66]"
                )}
              >
                {entry.label.length > 30 ? entry.label.slice(0, 30) + "…" : entry.label}
              </button>
            ))}
          </nav>
        </aside>
      )}

      {/* ── Chat drawer ───────────────────────────────────── */}
      {chatOpen && (
        <div className="absolute top-0 right-0 h-full w-[380px] flex flex-col border-l border-[#e5e5e3] bg-white shadow-2xl z-30">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5e3]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#1a1a18] flex items-center justify-center">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-sm font-semibold text-[#1a1a18]">Rule Assistant</p>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-1.5 rounded-lg hover:bg-[#f0f0ee] transition-colors">
              <X className="w-4 h-4 text-[#9c9c96]" />
            </button>
          </div>

          {selected && (
            <div className="px-5 py-2.5 bg-[#f9f9f8] border-b border-[#e5e5e3]">
              <p className="text-[10px] text-[#9c9c96]">Context: <span className="font-semibold text-[#6b6b66]">{selected.name.replace(/\.[^.]+$/, "")}</span></p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {chatMsgs.length === 0 && (
              <div className="pt-4 text-center">
                <p className="text-xs text-[#9c9c96] mb-4">Ask anything about this rule document.</p>
                <div className="space-y-2">
                  {["What is the rule for the Noun?", "How do I attribute Composition?", "What is the de-dupe rule?"].map((q) => (
                    <button key={q} onClick={() => setChatInput(q)}
                      className="block w-full text-left text-xs px-4 py-2.5 rounded-xl border border-[#e5e5e3] text-[#6b6b66] hover:border-[#c9c9c5] hover:bg-[#f9f9f8] transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMsgs.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[86%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap",
                  msg.role === "user" ? "bg-[#1a1a18] text-white rounded-tr-sm" : "bg-[#f0f0ee] text-[#1a1a18] rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-sm bg-[#f0f0ee]">
                  <Loader2 className="w-3 h-3 animate-spin text-[#9c9c96]" />
                  <span className="text-xs text-[#9c9c96]">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="p-4 border-t border-[#e5e5e3]">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask a rule question…"
                className="flex-1 text-xs px-4 py-2.5 border border-[#e5e5e3] rounded-xl focus:outline-none focus:border-[#c9c9c5] text-[#1a1a18] placeholder-[#c9c9c5] bg-[#f9f9f8] focus:bg-white transition-colors"
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                className="p-2.5 rounded-xl bg-[#1a1a18] text-white hover:bg-[#3d3d3a] disabled:opacity-40 transition-colors">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
