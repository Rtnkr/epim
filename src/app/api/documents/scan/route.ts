import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { readManifest, addDocument, cleanDocContent, USE_BLOB, DocumentRecord } from "@/lib/documents";
import { excelToText } from "@/lib/excel";
import * as XLSX from "xlsx";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const SUPPORTED_EXT = new Set([".docx", ".txt", ".pdf", ".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function guessMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return map[ext] ?? "application/octet-stream";
}

function guessDocType(name: string): DocumentRecord["type"] {
  const lower = name.toLowerCase();
  if (lower.includes("ntc") || lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "ntc-excel";
  return "rule";
}

async function extractFromBuffer(buffer: Buffer, mimeType: string, name: string): Promise<string> {
  const ext = path.extname(name).toLowerCase();

  if (ext === ".docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch { return "[Could not extract .docx]"; }
  }

  if ([".xlsx", ".xls", ".csv"].includes(ext)) {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      return excelToText(rows as Parameters<typeof excelToText>[0]);
    } catch { return "[Could not extract spreadsheet]"; }
  }

  if (ext === ".pdf") {
    try {
      const pdfModule = await import("pdf-parse");
      const pdfParse = (pdfModule as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default ?? pdfModule;
      const data = await pdfParse(buffer);
      return data.text;
    } catch { return "[PDF — could not extract text]"; }
  }

  if (mimeType.startsWith("image/")) return `[Image file: ${name}]`;

  return buffer.toString("utf-8").slice(0, 50000);
}

async function scanBlob() {
  const { list } = await import("@vercel/blob");
  const existing = await readManifest();
  const existingPaths = new Set(existing.map((d) => d.filePath));

  const { blobs } = await list({ prefix: "epim-files/" });
  let registered = 0, skipped = 0;
  const errors: string[] = [];

  for (const blob of blobs) {
    if (existingPaths.has(blob.url)) { skipped++; continue; }

    const ext = path.extname(blob.pathname).toLowerCase();
    const mimeType = guessMimeType(ext);
    const name = path.basename(blob.pathname);

    try {
      const res = await fetch(blob.url);
      const ab = await res.arrayBuffer();
      const buffer = Buffer.from(ab);
      const rawContent = await extractFromBuffer(buffer, mimeType, name);
      const content = mimeType.startsWith("image/") ? rawContent : cleanDocContent(rawContent);

      await addDocument({
        id: crypto.randomUUID(),
        name,
        type: guessDocType(name),
        mimeType,
        filePath: blob.url,
        content,
        uploadedAt: blob.uploadedAt.toISOString(),
        size: blob.size,
      });
      registered++;
    } catch (err) {
      errors.push(`${name}: ${err}`);
    }
  }

  return NextResponse.json({ registered, skipped, errors });
}

async function scanLocal() {
  if (!fs.existsSync(UPLOADS_DIR)) return NextResponse.json({ registered: 0, skipped: 0 });

  const existing = await readManifest();
  const existingPaths = new Set(existing.map((d) => d.filePath));
  const files = fs.readdirSync(UPLOADS_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return SUPPORTED_EXT.has(ext) && !f.startsWith(".");
  });

  let registered = 0, skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    const filePath = path.join(UPLOADS_DIR, file);
    if (existingPaths.has(filePath)) { skipped++; continue; }

    const ext = path.extname(file).toLowerCase();
    const mimeType = guessMimeType(ext);
    const stat = fs.statSync(filePath);
    const buffer = fs.readFileSync(filePath);

    try {
      const rawContent = await extractFromBuffer(buffer, mimeType, file);
      const content = mimeType.startsWith("image/") ? rawContent : cleanDocContent(rawContent);

      await addDocument({
        id: crypto.randomUUID(),
        name: file,
        type: guessDocType(file),
        mimeType,
        filePath,
        content,
        uploadedAt: stat.mtime.toISOString(),
        size: stat.size,
      });
      registered++;
    } catch (err) {
      errors.push(`${file}: ${err}`);
    }
  }

  return NextResponse.json({ registered, skipped, errors });
}

export async function POST() {
  try {
    return USE_BLOB ? await scanBlob() : await scanLocal();
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
