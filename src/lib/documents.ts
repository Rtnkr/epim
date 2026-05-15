import fs from "fs";
import path from "path";

// Use Blob storage when the token is present (Vercel), otherwise local FS (dev)
export const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

const DATA_FILE = path.join(process.cwd(), "data", "documents.json");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MANIFEST_PATH = "epim-manifest.json"; // fixed blob pathname

export interface DocumentRecord {
  id: string;
  name: string;
  type: "rule" | "ntc-excel" | "reference";
  mimeType: string;
  filePath: string; // local path OR vercel blob URL
  content: string;
  uploadedAt: string;
  size: number;
}

// ── Content cleaner ────────────────────────────────────────────
export function cleanDocContent(raw: string): string {
  const text = raw
    .replace(/\xa0/g, " ")
    .replace(/​/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = text.split("\n");
  let tocStart = -1, tocEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (tocStart === -1 && /^table of contents$/i.test(t)) tocStart = i;
    if (tocStart >= 0 && /\t\d+\s*$/.test(lines[i])) tocEnd = i;
    if (tocStart >= 0 && tocEnd >= 0 && i > tocEnd + 10) break;
  }

  const result: string[] = [];
  let blanks = 0;
  for (let i = 0; i < lines.length; i++) {
    if (tocStart >= 0 && tocEnd >= 0 && i >= tocStart && i <= tocEnd) continue;
    const t = lines[i].replace(/\xa0/g, " ").trim();
    if (/\t\d+\s*$/.test(lines[i])) continue;
    if (/^\d{1,3}$/.test(t)) continue;
    if (!t) { if (blanks === 0) result.push(""); blanks++; continue; }
    blanks = 0;
    result.push(t);
  }
  while (result.length && !result[0]) result.shift();
  while (result.length && !result[result.length - 1]) result.pop();
  return result.join("\n");
}

// ── Local FS helpers ───────────────────────────────────────────
function ensureDirs() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readManifestFS(): DocumentRecord[] {
  ensureDirs();
  if (!fs.existsSync(DATA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")); } catch { return []; }
}

function writeManifestFS(docs: DocumentRecord[]): void {
  ensureDirs();
  fs.writeFileSync(DATA_FILE, JSON.stringify(docs, null, 2));
}

// ── Vercel Blob helpers ────────────────────────────────────────
async function readManifestBlob(): Promise<DocumentRecord[]> {
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: MANIFEST_PATH });
    const found = blobs.find((b) => b.pathname === MANIFEST_PATH);
    if (!found) return [];
    const res = await fetch(found.url, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

async function writeManifestBlob(docs: DocumentRecord[]): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(MANIFEST_PATH, JSON.stringify(docs, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// ── Public API (all async) ─────────────────────────────────────
export async function readManifest(): Promise<DocumentRecord[]> {
  return USE_BLOB ? readManifestBlob() : readManifestFS();
}

export async function writeManifest(docs: DocumentRecord[]): Promise<void> {
  USE_BLOB ? await writeManifestBlob(docs) : writeManifestFS(docs);
}

export async function addDocument(doc: DocumentRecord): Promise<void> {
  const docs = await readManifest();
  const idx = docs.findIndex((d) => d.id === doc.id || d.name === doc.name);
  if (idx >= 0) docs[idx] = doc; else docs.push(doc);
  await writeManifest(docs);
}

export async function deleteDocument(id: string): Promise<void> {
  const docs = await readManifest();
  const doc = docs.find((d) => d.id === id);
  if (doc) {
    if (USE_BLOB) {
      try {
        const { del } = await import("@vercel/blob");
        await del(doc.filePath);
      } catch {}
    } else {
      if (fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
    }
  }
  await writeManifest(docs.filter((d) => d.id !== id));
}

export async function getRuleDocuments(): Promise<DocumentRecord[]> {
  const docs = await readManifest();
  return docs.filter((d) => d.type === "rule" || d.type === "reference");
}

export async function getNTCDocument(): Promise<DocumentRecord | undefined> {
  const docs = await readManifest();
  return docs.find((d) => d.type === "ntc-excel");
}

// ── AI context builder ─────────────────────────────────────────
const MAX_CHARS_PER_DOC = 4000;
const MAX_DOCS = 3;

function scoreRelevance(content: string, query: string): number {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const lower = content.toLowerCase();
  return words.reduce((score, word) => {
    return score + (lower.match(new RegExp(word, "g")) ?? []).length;
  }, 0);
}

export async function getAllDocumentContent(query?: string): Promise<string> {
  const docs = await getRuleDocuments();
  if (docs.length === 0) return "";

  const ranked = query
    ? [...docs].sort((a, b) => scoreRelevance(b.content, query) - scoreRelevance(a.content, query))
    : docs;

  return ranked
    .slice(0, MAX_DOCS)
    .map((d) => {
      const clean = cleanDocContent(d.content);
      const truncated = clean.length > MAX_CHARS_PER_DOC
        ? clean.slice(0, MAX_CHARS_PER_DOC) + "\n[...truncated]"
        : clean;
      return `=== DOCUMENT: ${d.name} ===\n${truncated}`;
    })
    .join("\n\n");
}
