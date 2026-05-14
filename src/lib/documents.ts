import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "documents.json");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export interface DocumentRecord {
  id: string;
  name: string;
  type: "rule" | "ntc-excel" | "reference";
  mimeType: string;
  filePath: string;
  content: string; // extracted text
  uploadedAt: string;
  size: number;
}

function ensureDirs() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(path.dirname(DATA_FILE)))
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

export function readManifest(): DocumentRecord[] {
  ensureDirs();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function writeManifest(docs: DocumentRecord[]): void {
  ensureDirs();
  fs.writeFileSync(DATA_FILE, JSON.stringify(docs, null, 2));
}

export function addDocument(doc: DocumentRecord): void {
  const docs = readManifest();
  // Deduplicate by id OR by filename
  const existingIdx = docs.findIndex((d) => d.id === doc.id || d.name === doc.name);
  if (existingIdx >= 0) {
    docs[existingIdx] = doc;
  } else {
    docs.push(doc);
  }
  writeManifest(docs);
}

export function deleteDocument(id: string): void {
  const docs = readManifest();
  const doc = docs.find((d) => d.id === id);
  if (doc && fs.existsSync(doc.filePath)) {
    fs.unlinkSync(doc.filePath);
  }
  writeManifest(docs.filter((d) => d.id !== id));
}

export function getRuleDocuments(): DocumentRecord[] {
  return readManifest().filter((d) => d.type === "rule" || d.type === "reference");
}

export function getNTCDocument(): DocumentRecord | undefined {
  return readManifest().find((d) => d.type === "ntc-excel");
}

const MAX_CHARS_PER_DOC = 4000;
const MAX_DOCS = 3; // send top-3 most relevant docs to stay under Groq's token limit

function scoreRelevance(content: string, query: string): number {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const lower = content.toLowerCase();
  return words.reduce((score, word) => {
    const matches = (lower.match(new RegExp(word, "g")) ?? []).length;
    return score + matches;
  }, 0);
}

export function getAllDocumentContent(query?: string): string {
  const docs = getRuleDocuments();
  if (docs.length === 0) return "";

  // If a query is provided, rank docs by relevance; otherwise take first MAX_DOCS
  const ranked = query
    ? [...docs].sort(
        (a, b) =>
          scoreRelevance(b.content, query) - scoreRelevance(a.content, query)
      )
    : docs;

  const selected = ranked.slice(0, MAX_DOCS);

  return selected
    .map((d) => {
      const truncated =
        d.content.length > MAX_CHARS_PER_DOC
          ? d.content.slice(0, MAX_CHARS_PER_DOC) + "\n[...truncated]"
          : d.content;
      return `=== DOCUMENT: ${d.name} ===\n${truncated}`;
    })
    .join("\n\n");
}
