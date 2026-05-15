"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search, MessageSquare, X, Send, Loader2, FileText,
  AlertTriangle, RefreshCw, BookOpen,
} from "lucide-react";
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

// ─── Inline highlight ─────────────────────────────────────────
function Hi({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${esc})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{p}</mark>
          : p
      )}
    </>
  );
}

// ─── Section content renderer ─────────────────────────────────
function SectionLines({ lines, q }: { lines: string[]; q: string }) {
  const items: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) { i++; continue; }

    // Example
    if (/^(EX|EXAMPLE|E\.G\.)\s*:/i.test(t)) {
      items.push(
        <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 my-2">
          <span className="shrink-0 text-[9px] font-black text-emerald-700 uppercase tracking-widest mt-0.5 bg-emerald-100 px-1.5 py-0.5 rounded">EX</span>
          <p className="text-xs font-mono text-emerald-800 leading-relaxed">
            <Hi text={t.replace(/^(EX|EXAMPLE|E\.G\.)\s*:\s*/i, "")} q={q} />
          </p>
        </div>
      );
      i++; continue;
    }

    // Note / Exception / Warning
    const calloutMatch = t.match(/^(NOTE|EXCEPTION|WARNING|IMPORTANT)\s*:/i);
    if (calloutMatch) {
      const type = calloutMatch[1].toUpperCase();
      const cls =
        type === "NOTE" ? "bg-blue-50 border-blue-200 text-blue-800" :
        type === "WARNING" ? "bg-red-50 border-red-200 text-red-800" :
        "bg-amber-50 border-amber-200 text-amber-800";
      items.push(
        <div key={i} className={cn("flex items-start gap-2 px-3 py-2.5 rounded-lg border my-2", cls)}>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest mt-0.5">{type}</span>
          <p className="text-xs leading-relaxed">
            <Hi text={t.replace(/^(NOTE|EXCEPTION|WARNING|IMPORTANT)\s*:\s*/i, "")} q={q} />
          </p>
        </div>
      );
      i++; continue;
    }

    // UNSPSC 8-digit code
    if (/^\d{8}$/.test(t)) {
      const desc = lines[i + 1]?.trim() ?? "";
      const kw = lines[i + 2]?.trim() ?? "";
      const advance = 1 + (desc ? 1 : 0) + (kw && !kw.match(/^\d{8}$/) ? 1 : 0);
      items.push(
        <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-lg border border-neutral-100 bg-neutral-50 my-1">
          <code className="shrink-0 text-[11px] font-mono font-bold text-neutral-500 bg-white border border-neutral-200 px-2 py-1 rounded mt-0.5 tracking-wider">{t}</code>
          <div className="min-w-0">
            {desc && <p className="text-xs font-medium text-neutral-800"><Hi text={desc} q={q} /></p>}
            {kw && !kw.match(/^\d{8}$/) && <p className="text-[10px] text-neutral-400 font-mono mt-0.5"><Hi text={kw} q={q} /></p>}
          </div>
        </div>
      );
      i += advance; continue;
    }

    // Sub-heading: ends with colon, short
    if (t.endsWith(":") && t.length < 80 && !/^[-•●]/.test(t) && !/^\d{4}/.test(t)) {
      items.push(
        <p key={i} className="text-[10px] font-bold text-neutral-500 mt-4 mb-1.5 uppercase tracking-wider">
          <Hi text={t.replace(/:$/, "")} q={q} />
        </p>
      );
      i++; continue;
    }

    // Bullet
    if (/^[-•●◦▸→]\s/.test(t)) {
      const indent = /^\s{2,}/.test(raw);
      items.push(
        <div key={i} className={cn("flex gap-2 py-0.5", indent && "pl-5")}>
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-neutral-300 mt-1.5 flex-none" />
          <p className="text-xs text-neutral-700 leading-relaxed">
            <Hi text={t.replace(/^[-•●◦▸→]\s/, "")} q={q} />
          </p>
        </div>
      );
      i++; continue;
    }

    // Numbered list
    if (/^(\d+|[a-z])[.)]\s/i.test(t)) {
      const num = t.match(/^(\d+|[a-z])[.)]/i)?.[0].replace(/[.)]/g, "") ?? "";
      items.push(
        <div key={i} className="flex gap-2.5 py-0.5">
          <span className="shrink-0 w-4 h-4 rounded-full bg-neutral-100 flex items-center justify-center text-[9px] font-bold text-neutral-500 mt-0.5">{num}</span>
          <p className="text-xs text-neutral-700 leading-relaxed flex-1">
            <Hi text={t.replace(/^(\d+|[a-z])[.)]\s*/i, "")} q={q} />
          </p>
        </div>
      );
      i++; continue;
    }

    items.push(
      <p key={i} className="text-xs text-neutral-700 leading-relaxed py-0.5">
        <Hi text={t} q={q} />
      </p>
    );
    i++;
  }
  return <>{items}</>;
}

// ─── Document section model ───────────────────────────────────
interface AttrSection { code: string; label: string; id: string; lines: string[] }
interface DocSections { title: string; preamble: string[]; attrs: AttrSection[] }

function parseDocSections(content: string): DocSections {
  const raw = content.split("\n");
  let title = "";
  const preamble: string[] = [];
  const attrs: AttrSection[] = [];
  let current: AttrSection | null = null;
  let secIdx = 0;
  let firstNonBlank = true;

  for (const line of raw) {
    const t = line.trim();

    if (firstNonBlank && t) {
      firstNonBlank = false;
      title = t;
      continue;
    }

    const attrMatch = t.match(/^([A-Z0-9]{1,3})\s*[–—-]+\s*(.+)/);
    if (attrMatch && t.length < 80 && !/^\d{4}/.test(t)) {
      if (current) attrs.push(current);
      current = { code: attrMatch[1].trim(), label: attrMatch[2].trim(), id: `a${secIdx++}`, lines: [] };
      continue;
    }

    if (current) {
      current.lines.push(t);
    } else {
      preamble.push(t);
    }
  }
  if (current) attrs.push(current);
  return { title, preamble, attrs };
}

// ─── Attribute card ───────────────────────────────────────────
const CODE_BG: Record<string, string> = {
  N: "#1e293b", T: "#1e293b",
  "1": "#4c1d95", "2": "#1e3a8a", "3": "#0c4a6e", "4": "#134e4a",
  "5": "#14532d", "6": "#365314", "7": "#713f12", "8": "#7c2d12",
  "9": "#881337", "10": "#500724", "11": "#4a044e", "12": "#2d1b69",
  "13": "#172554", "14": "#082f49", "15": "#0c4a6e", "16": "#1e3a5f",
  "17": "#0f172a",
};

function AttrCard({ section, q, isActive, onClick }: {
  section: AttrSection; q: string; isActive: boolean; onClick: () => void;
}) {
  const bg = CODE_BG[section.code] ?? "#1e293b";
  const hasContent = section.lines.some(l => l.trim());
  return (
    <div
      id={section.id}
      className={cn(
        "rounded-2xl border bg-white overflow-hidden scroll-mt-6 transition-shadow",
        isActive ? "border-slate-900 shadow-md ring-1 ring-slate-900" : "border-neutral-200 hover:shadow-sm hover:border-neutral-300"
      )}
    >
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-5 py-4 text-white text-left"
        style={{ background: bg }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-black tracking-tight"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          {section.code}
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-widest opacity-60 mb-0.5">
            {/^\d+$/.test(section.code) ? `Field ${section.code}` : "Field " + section.code}
          </p>
          <p className="text-sm font-bold truncate">{section.label}</p>
        </div>
      </button>

      {hasContent && (
        <div className="px-5 py-4">
          <SectionLines lines={section.lines} q={q} />
        </div>
      )}
    </div>
  );
}

// ─── Search helpers ───────────────────────────────────────────
interface SearchHit { docId: string; docName: string; line: string; context: string; section: string }

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
      const am = t.match(/^([A-Z0-9]{1,3})\s*[–—-]+\s*(.+)/);
      if (am && t.length < 80) { currentSection = `${am[1]} — ${am[2]}`; continue; }
      if (t.toLowerCase().includes(q.toLowerCase())) {
        const prev = lines[i - 1]?.trim() ?? "";
        const next = lines[i + 1]?.trim() ?? "";
        hits.push({
          docId: doc.id, docName: doc.name, line: t, section: currentSection,
          context: [prev, next].filter(Boolean).join(" · ").slice(0, 120),
        });
      }
    }
  }
  return hits.slice(0, 100);
}

// ─── Main page ────────────────────────────────────────────────
export default function RulesViewerPage() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [selected, setSelected] = useState<DocMeta | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
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
  const docSections = useMemo(() => parseDocSections(cleanedContent), [cleanedContent]);

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
    setActiveId(null);
    contentRef.current?.scrollTo({ top: 0 });
  }

  function jumpTo(id: string) {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMsgs((p) => [...p, { role: "user", content: question }]);
    setChatLoading(true);
    const ctx = selected ? `Rule document: "${selected.name}"\n\n${cleanedContent.slice(0, 8000)}` : "";
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
    <div className="flex flex-1 h-[calc(100vh-3.5rem-53px)] overflow-hidden bg-neutral-50 relative">

      {/* ── Left panel: document list ────────────────────── */}
      <aside className="w-[240px] shrink-0 border-r border-neutral-200 bg-white flex flex-col">
        <div className="px-4 pt-5 pb-3 border-b border-neutral-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Documents</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-300 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all rules…"
              className="w-full pl-9 pr-7 py-2 text-xs border border-neutral-200 rounded-lg bg-neutral-50 text-neutral-800 placeholder-neutral-300 focus:outline-none focus:border-neutral-400 focus:bg-white transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-neutral-300 hover:text-neutral-600" />
              </button>
            )}
          </div>
          {isSearching && (
            <p className="text-[10px] text-neutral-400 mt-2">
              {allHits.length} match{allHits.length !== 1 ? "es" : ""} · {hitsByDoc.size} doc{hitsByDoc.size !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-neutral-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          ) : docs.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <AlertTriangle className="w-5 h-5 text-neutral-200 mx-auto mb-2" />
              <p className="text-xs text-neutral-400 mb-1">No documents yet.</p>
              <Link href="/rules" className="text-xs text-neutral-800 underline">Upload →</Link>
            </div>
          ) : docs.map((doc) => {
            const hitCount = hitsByDoc.get(doc.id)?.length ?? 0;
            const active = !isSearching && selected?.id === doc.id;
            return (
              <button
                key={doc.id}
                onClick={() => pickDoc(doc)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                  active ? "bg-slate-900 text-white" : "hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  active ? "bg-white/10" : "bg-neutral-100")}>
                  <FileText className={cn("w-4 h-4", active ? "text-white" : "text-neutral-400")} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold leading-snug truncate">
                    {doc.name.replace(/\.[^.]+$/, "")}
                  </p>
                  <p className={cn("text-[10px] mt-0.5", active ? "text-white/50" : "text-neutral-400")}>
                    {new Date(doc.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                {isSearching && hitCount > 0 && (
                  <span className="shrink-0 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5">{hitCount}</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Center panel: content ─────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {isSearching ? (
          /* Search results */
          <>
            <div className="px-6 py-3.5 border-b border-neutral-200 bg-white flex items-center gap-3 shrink-0">
              <Search className="w-4 h-4 text-neutral-400" />
              <p className="text-sm font-semibold text-neutral-900">Results for &ldquo;{search}&rdquo;</p>
              <span className="text-xs text-neutral-400">{allHits.length} matches</span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {allHits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <BookOpen className="w-10 h-10 text-neutral-200 mb-3" />
                  <p className="text-sm text-neutral-400">No matches found.</p>
                </div>
              ) : Array.from(hitsByDoc.entries()).map(([docId, hits]) => {
                const doc = docs.find((d) => d.id === docId)!;
                return (
                  <div key={docId}>
                    <button onClick={() => pickDoc(doc)} className="flex items-center gap-2 mb-3 group">
                      <div className="w-5 h-5 rounded-md bg-neutral-100 flex items-center justify-center">
                        <FileText className="w-3 h-3 text-neutral-400" />
                      </div>
                      <span className="text-xs font-bold text-neutral-700 group-hover:text-neutral-900 transition-colors">
                        {doc.name.replace(/\.[^.]+$/, "")}
                      </span>
                      <span className="text-[10px] text-neutral-300">· {hits.length} match{hits.length !== 1 ? "es" : ""}</span>
                    </button>
                    <div className="space-y-2">
                      {hits.map((hit, i) => (
                        <button
                          key={i}
                          onClick={() => pickDoc(doc)}
                          className="w-full text-left px-4 py-3 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm transition-all"
                        >
                          {hit.section && (
                            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">{hit.section}</p>
                          )}
                          <p className="text-sm text-neutral-800 leading-relaxed">
                            <Hi text={hit.line} q={q} />
                          </p>
                          {hit.context && (
                            <p className="text-[11px] text-neutral-400 mt-1.5 line-clamp-2">{hit.context}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : selected ? (
          /* Document view */
          <>
            {/* Top bar */}
            <div className="px-6 py-3.5 border-b border-neutral-200 bg-white flex items-center gap-4 shrink-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-neutral-900 truncate">{docSections.title || selected.name.replace(/\.[^.]+$/, "")}</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  {docSections.attrs.length > 0 && `${docSections.attrs.length} fields · `}
                  Updated {new Date(selected.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => { setChatOpen(true); setChatMsgs([]); }}
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask AI
              </button>
            </div>

            {/* Scrollable content */}
            <div ref={contentRef} className="flex-1 overflow-y-auto">
              <div className="px-6 py-6 max-w-5xl mx-auto w-full">

                {/* Preamble card */}
                {docSections.preamble.some(l => l.trim()) && (
                  <div className="mb-6 px-5 py-4 rounded-2xl bg-white border border-neutral-200">
                    <SectionLines lines={docSections.preamble} q="" />
                  </div>
                )}

                {/* Attribute grid */}
                {docSections.attrs.length > 0 ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {docSections.attrs.map((section) => (
                      <AttrCard
                        key={section.id}
                        section={section}
                        q=""
                        isActive={activeId === section.id}
                        onClick={() => setActiveId(section.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-neutral-200 px-6 py-5">
                    <SectionLines lines={cleanedContent.split("\n")} q="" />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-neutral-300" />
            </div>
            <p className="text-sm text-neutral-400">Select a document from the left panel</p>
          </div>
        )}
      </div>

      {/* ── Right panel: field navigator ─────────────────── */}
      {!isSearching && selected && docSections.attrs.length > 0 && (
        <aside className="w-[168px] shrink-0 border-l border-neutral-200 bg-white flex flex-col overflow-hidden">
          <div className="px-4 pt-5 pb-3 border-b border-neutral-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Fields</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {docSections.attrs.map((section) => {
              const isActive = activeId === section.id;
              const bg = CODE_BG[section.code] ?? "#1e293b";
              return (
                <button
                  key={section.id}
                  onClick={() => jumpTo(section.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left",
                    isActive ? "bg-slate-900 text-white" : "hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  <span
                    className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black text-white"
                    style={{ background: isActive ? "rgba(255,255,255,0.2)" : bg }}
                  >
                    {section.code}
                  </span>
                  <span className="text-[10px] font-medium truncate leading-snug">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      {/* ── Chat drawer ───────────────────────────────────── */}
      {chatOpen && (
        <div className="absolute inset-y-0 right-0 w-[360px] flex flex-col border-l border-neutral-200 bg-white shadow-2xl z-30">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-sm font-semibold text-neutral-900">Rule Assistant</p>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          </div>

          {selected && (
            <div className="px-5 py-2.5 bg-neutral-50 border-b border-neutral-100">
              <p className="text-[10px] text-neutral-400">
                Context: <span className="font-semibold text-neutral-600">{selected.name.replace(/\.[^.]+$/, "")}</span>
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMsgs.length === 0 && (
              <div className="pt-4 text-center">
                <p className="text-xs text-neutral-400 mb-4">Ask anything about the rules in this document.</p>
                <div className="space-y-2">
                  {["What is the rule for the Noun?", "How do I attribute Composition?", "What is the de-dupe rule?"].map((sq) => (
                    <button key={sq} onClick={() => setChatInput(sq)}
                      className="block w-full text-left text-xs px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 transition-colors">
                      {sq}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMsgs.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[88%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-slate-900 text-white rounded-tr-sm"
                    : "bg-neutral-100 text-neutral-800 rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-sm bg-neutral-100">
                  <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
                  <span className="text-xs text-neutral-400">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="p-4 border-t border-neutral-100">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask a rule question…"
                className="flex-1 text-xs px-4 py-2.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-400 text-neutral-800 placeholder-neutral-300 bg-neutral-50 focus:bg-white transition-colors"
              />
              <button
                onClick={sendChat}
                disabled={!chatInput.trim() || chatLoading}
                className="p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
