"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search, MessageSquare, X, Send, Loader2,
  FileText, AlertTriangle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface DocMeta {
  id: string;
  name: string;
  type: string;
  content: string;
  uploadedAt: string;
}

interface ChatMsg { role: "user" | "assistant"; content: string }

// ─── Content parsing ─────────────────────────────────────────
type LineKind =
  | "attr-header"   // "N – NOUN", "T – TYPE", "1 – TRADEMARK/BRAND NAME"
  | "section-header" // ALL-CAPS or ends-with-colon sub-section
  | "toc-entry"     // "Something …\t12" — table of contents row
  | "example"       // starts with "EX:" or "Example:"
  | "bullet"        // "- text", "• text"
  | "numbered"      // "1. text", "a) text"
  | "unspsc"        // 8-digit code line
  | "paragraph"
  | "blank";

function classifyLine(raw: string): LineKind {
  const t = raw.trim();
  if (!t) return "blank";

  // ToC line: tab + page number at end
  if (/\t\d+\s*$/.test(raw)) return "toc-entry";

  // Attribute-level header: "N – NOUN", "T – TYPE", "1 – COMPOSITION"
  if (/^([A-Z0-9]{1,3})\s*[–—-]\s*[A-Z]/.test(t) && t.length < 70) return "attr-header";

  // Example line
  if (/^(EX|EXAMPLE|E\.G\.)\s*:/i.test(t)) return "example";

  // Bullet
  if (/^[-•●◦▸→]\s/.test(t)) return "bullet";

  // Numbered
  if (/^(\d+|[a-z])[.)]\s/i.test(t)) return "numbered";

  // Pure 8-digit code (UNSPSC)
  if (/^\d{8}$/.test(t)) return "unspsc";

  // ALL CAPS section header (min 3 chars, no leading punctuation)
  if (t.length >= 3 && t.length <= 90 && /[A-Z]{2}/.test(t) && t === t.toUpperCase()) {
    return "section-header";
  }

  // Ends with colon → sub-section label
  if (t.endsWith(":") && t.length < 80 && !/^[-•]/.test(t)) return "section-header";

  // Numbered section like "4.1 Step 1 – ..."
  if (/^\d+\.\d+\s/.test(t) && t.length < 90) return "section-header";

  return "paragraph";
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${esc})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase()
          ? <mark key={i} className="bg-amber-200 text-amber-900 rounded-sm px-0.5">{p}</mark>
          : p
      )}
    </>
  );
}

interface Section { id: string; label: string; kind: "attr" | "section" }

function extractSections(content: string): Section[] {
  const out: Section[] = [];
  let i = 0;
  for (const line of content.split("\n")) {
    const kind = classifyLine(line);
    if (kind === "attr-header" || kind === "section-header") {
      const text = line.trim().replace(/\t.*$/, "").replace(/^#+\s*/, "");
      out.push({
        id: `s${i++}-${text.slice(0, 20).replace(/\W+/g, "-").toLowerCase()}`,
        label: text.length > 40 ? text.slice(0, 40) + "…" : text,
        kind: kind === "attr-header" ? "attr" : "section",
      });
    }
  }
  return out;
}

function RenderedDoc({ content, search }: { content: string; search: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let secIdx = 0;
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    const kind = classifyLine(raw);

    if (kind === "blank") {
      nodes.push(<div key={key++} className="h-3" />);
      continue;
    }

    // Skip ToC entries — they clutter the view
    if (kind === "toc-entry") continue;

    if (kind === "attr-header") {
      const id = `s${secIdx++}-${t.slice(0, 20).replace(/\W+/g, "-").toLowerCase()}`;
      nodes.push(
        <div key={key++} id={id} className="mt-8 mb-3 scroll-mt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a18] text-white">
            <span className="text-xs font-bold tracking-wide">
              <Highlight text={t} q={search} />
            </span>
          </div>
        </div>
      );
      continue;
    }

    if (kind === "section-header") {
      const id = `s${secIdx++}-${t.slice(0, 20).replace(/\W+/g, "-").toLowerCase()}`;
      nodes.push(
        <h3 key={key++} id={id} className="text-sm font-semibold text-[#1a1a18] mt-5 mb-1.5 scroll-mt-6 border-b border-[#f0f0ee] pb-1">
          <Highlight text={t.replace(/:$/, "")} q={search} />
        </h3>
      );
      continue;
    }

    if (kind === "example") {
      nodes.push(
        <div key={key++} className="my-1.5 px-3 py-2 rounded-md bg-[#f0fdf4] border border-[#bbf7d0] text-xs font-mono text-[#166534]">
          <Highlight text={t} q={search} />
        </div>
      );
      continue;
    }

    if (kind === "bullet") {
      nodes.push(
        <div key={key++} className="flex gap-2.5 py-0.5 pl-1">
          <span className="text-[#c9c9c5] mt-1.5 text-[10px] shrink-0 leading-none">●</span>
          <p className="text-sm text-[#3d3d3a] leading-relaxed">
            <Highlight text={t.replace(/^[-•●◦▸→]\s/, "")} q={search} />
          </p>
        </div>
      );
      continue;
    }

    if (kind === "numbered") {
      const num = t.match(/^(\d+|[a-z])[.)]/i)?.[0] ?? "";
      nodes.push(
        <div key={key++} className="flex gap-3 py-0.5">
          <span className="shrink-0 text-[10px] font-bold text-[#9c9c96] mt-1 w-5 text-right tabular-nums">{num}</span>
          <p className="text-sm text-[#3d3d3a] leading-relaxed flex-1">
            <Highlight text={t.replace(/^(\d+|[a-z])[.)]\s*/i, "")} q={search} />
          </p>
        </div>
      );
      continue;
    }

    if (kind === "unspsc") {
      // Try to group: code → description → keywords (3 consecutive non-blank lines separated by blanks)
      const code = t;
      let desc = "";
      let kw = "";
      let skip = 1;
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const next = lines[j].trim();
        if (!next) continue;
        if (!desc) { desc = next; skip = j - i; continue; }
        if (!kw) { kw = next; skip = j - i; break; }
      }
      nodes.push(
        <div key={key++} className="flex gap-3 items-start py-1">
          <code className="shrink-0 text-[10px] font-mono bg-[#f0f0ee] text-[#6b6b66] px-2 py-1 rounded mt-0.5">{code}</code>
          <div className="flex-1 min-w-0">
            {desc && <p className="text-sm text-[#1a1a18] font-medium leading-snug"><Highlight text={desc} q={search} /></p>}
            {kw && <p className="text-[10px] text-[#9c9c96] mt-0.5 truncate"><Highlight text={kw} q={search} /></p>}
          </div>
        </div>
      );
      i += skip;
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={key++} className="text-sm text-[#3d3d3a] leading-relaxed py-0.5">
        <Highlight text={t} q={search} />
      </p>
    );
  }

  return <div className="space-y-0.5">{nodes}</div>;
}

// ─── Cross-document search ────────────────────────────────────
interface Hit { docId: string; docName: string; line: string }

export default function RulesViewerPage() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [selected, setSelected] = useState<DocMeta | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/documents/content")
      .then((r) => r.json())
      .then((d) => {
        const rules = (d.documents ?? []).filter(
          (doc: DocMeta) => doc.type === "rule" || doc.type === "reference"
        );
        setDocs(rules);
        if (rules.length) setSelected(rules[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sections = useMemo(
    () => (selected ? extractSections(selected.content) : []),
    [selected]
  );

  const q = search.trim().toLowerCase();
  const isSearching = q.length >= 2;

  const hitsByDoc = useMemo<Map<string, Hit[]>>(() => {
    if (!isSearching) return new Map();
    const map = new Map<string, Hit[]>();
    for (const doc of docs) {
      const hits: Hit[] = [];
      for (const line of doc.content.split("\n")) {
        if (line.toLowerCase().includes(q)) {
          hits.push({ docId: doc.id, docName: doc.name, line });
        }
      }
      if (hits.length) map.set(doc.id, hits.slice(0, 30));
    }
    return map;
  }, [q, isSearching, docs]);

  function pickDoc(doc: DocMeta) {
    setSelected(doc);
    setSearch("");
    contentRef.current?.scrollTo({ top: 0 });
  }

  function jumpTo(id: string) {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMsgs((p) => [...p, { role: "user", content: question }]);
    setChatLoading(true);

    const ctx = selected
      ? `Rule document: "${selected.name}"\n\n${selected.content.slice(0, 8000)}`
      : "All uploaded rule documents";

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText: `[Rule context: ${ctx}]\n\nQuestion: ${question}`,
          history: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
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
    <div className="flex flex-1 h-[calc(100vh-3.5rem-53px)] overflow-hidden">
      {/* ── Left: document list ─────────────────────────── */}
      <aside className="w-[220px] shrink-0 border-r border-[#e5e5e3] bg-white flex flex-col">
        <div className="px-3 pt-4 pb-3 border-b border-[#e5e5e3]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96] mb-2.5">
            Rule Documents
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#c9c9c5] pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search all rules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-6 py-1.5 text-xs border border-[#e5e5e3] rounded-md bg-[#f9f9f8] text-[#1a1a18] placeholder-[#c9c9c5] focus:outline-none focus:border-[#c9c9c5]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-[#c9c9c5] hover:text-[#6b6b66]" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
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
              return (
                <button
                  key={doc.id}
                  onClick={() => pickDoc(doc)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors",
                    active
                      ? "bg-[#1a1a18] text-white"
                      : "text-[#6b6b66] hover:bg-[#f0f0ee] hover:text-[#1a1a18]"
                  )}
                >
                  <FileText className={cn("w-3.5 h-3.5 shrink-0", active ? "text-white/70" : "text-[#c9c9c5]")} />
                  <span className="text-xs font-medium flex-1 truncate leading-snug">
                    {doc.name.replace(/\.[^.]+$/, "")}
                  </span>
                  {isSearching && hitCount > 0 && (
                    <span className="shrink-0 text-[10px] font-bold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 tabular-nums">
                      {hitCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </nav>
      </aside>

      {/* ── Center: content ──────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {isSearching ? (
          // Cross-document search results
          <>
            <div className="px-6 py-3.5 border-b border-[#e5e5e3] bg-white flex items-center gap-3">
              <Search className="w-4 h-4 text-[#9c9c96] shrink-0" />
              <p className="text-sm font-semibold text-[#1a1a18]">
                {Array.from(hitsByDoc.values()).flat().length} results for &ldquo;{search}&rdquo;
              </p>
              <span className="text-xs text-[#9c9c96] ml-auto">
                in {hitsByDoc.size} document{hitsByDoc.size !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
              {hitsByDoc.size === 0 ? (
                <p className="text-sm text-center text-[#9c9c96] py-16">No matches found.</p>
              ) : (
                Array.from(hitsByDoc.entries()).map(([docId, hits]) => {
                  const doc = docs.find((d) => d.id === docId)!;
                  return (
                    <div key={docId}>
                      <button
                        onClick={() => pickDoc(doc)}
                        className="flex items-center gap-2 mb-2.5 group"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#c9c9c5]" />
                        <span className="text-xs font-semibold text-[#6b6b66] group-hover:text-[#1a1a18] transition-colors">
                          {doc.name.replace(/\.[^.]+$/, "")}
                        </span>
                        <span className="text-[10px] text-[#c9c9c5]">
                          — {hits.length} match{hits.length !== 1 ? "es" : ""}
                        </span>
                      </button>
                      <div className="space-y-1 pl-px">
                        {hits.map((hit, i) => (
                          <button
                            key={i}
                            onClick={() => pickDoc(doc)}
                            className="w-full text-left px-4 py-2.5 rounded-lg border border-[#e5e5e3] bg-white hover:border-[#c9c9c5] text-sm text-[#3d3d3a] leading-relaxed transition-colors"
                          >
                            <Highlight text={hit.line.trim()} q={q} />
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
          // Document view
          <>
            <div className="px-6 py-3.5 border-b border-[#e5e5e3] bg-white flex items-center gap-4 shrink-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1a1a18] truncate">
                  {selected.name.replace(/\.[^.]+$/, "")}
                </p>
                <p className="text-[10px] text-[#9c9c96] mt-0.5">
                  Updated {new Date(selected.uploadedAt).toLocaleDateString()}
                  {" · "}{selected.content.length.toLocaleString()} chars
                </p>
              </div>
              <button
                onClick={() => { setChatOpen(true); setChatMsgs([]); }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a18] text-white text-xs font-medium hover:bg-[#3d3d3a] transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask AI
              </button>
            </div>
            <div ref={contentRef} className="flex-1 overflow-y-auto px-8 py-7">
              <div className="max-w-2xl">
                <RenderedDoc content={selected.content} search="" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#f0f0ee] flex items-center justify-center mx-auto mb-3">
                <FileText className="w-5 h-5 text-[#c9c9c5]" />
              </div>
              <p className="text-sm text-[#9c9c96]">Select a document to view</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: section TOC ───────────────────────────── */}
      {!isSearching && selected && sections.length > 0 && (
        <aside className="w-[176px] shrink-0 border-l border-[#e5e5e3] bg-white flex flex-col overflow-hidden">
          <div className="px-3 pt-4 pb-2 border-b border-[#e5e5e3]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96]">Sections</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => jumpTo(sec.id)}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 rounded-md text-[10px] leading-snug transition-colors",
                  sec.kind === "attr"
                    ? "font-semibold text-[#1a1a18] hover:bg-[#f0f0ee]"
                    : "text-[#6b6b66] hover:bg-[#f9f9f8] hover:text-[#1a1a18]"
                )}
              >
                {sec.label}
              </button>
            ))}
          </nav>
        </aside>
      )}

      {/* ── Chat drawer ───────────────────────────────────── */}
      {chatOpen && (
        <div className="absolute top-0 right-0 h-full w-[380px] flex flex-col border-l border-[#e5e5e3] bg-white shadow-2xl z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e3]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#1a1a18]" />
              <p className="text-sm font-semibold text-[#1a1a18]">Rule Assistant</p>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-1 rounded-md hover:bg-[#f0f0ee] transition-colors">
              <X className="w-4 h-4 text-[#9c9c96]" />
            </button>
          </div>

          {selected && (
            <div className="px-4 py-2 bg-[#f9f9f8] border-b border-[#e5e5e3]">
              <p className="text-[10px] text-[#9c9c96]">
                Context: <span className="font-medium text-[#6b6b66]">{selected.name.replace(/\.[^.]+$/, "")}</span>
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMsgs.length === 0 && (
              <div className="pt-6 text-center">
                <p className="text-xs text-[#9c9c96] mb-4">Ask anything about this rule document.</p>
                <div className="space-y-2">
                  {["What is the rule for the Noun?", "How do I attribute Composition?", "What is the de-dupe rule?"].map((q) => (
                    <button
                      key={q}
                      onClick={() => setChatInput(q)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-[#e5e5e3] text-[#6b6b66] hover:border-[#c9c9c5] hover:bg-[#f9f9f8] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMsgs.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[86%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-[#1a1a18] text-white rounded-tr-sm"
                    : "bg-[#f0f0ee] text-[#1a1a18] rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3 py-2 rounded-2xl rounded-tl-sm bg-[#f0f0ee]">
                  <Loader2 className="w-3 h-3 animate-spin text-[#9c9c96]" />
                  <span className="text-xs text-[#9c9c96]">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="p-3 border-t border-[#e5e5e3]">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ask a rule question…"
                className="flex-1 text-xs px-3 py-2 border border-[#e5e5e3] rounded-lg focus:outline-none focus:border-[#c9c9c5] text-[#1a1a18] placeholder-[#c9c9c5]"
              />
              <button
                onClick={sendChat}
                disabled={!chatInput.trim() || chatLoading}
                className="p-2 rounded-lg bg-[#1a1a18] text-white hover:bg-[#3d3d3a] disabled:opacity-40 transition-colors"
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
