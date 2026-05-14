import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { readManifest, addDocument, DocumentRecord } from "@/lib/documents";
import { parseExcel, excelToText } from "@/lib/excel";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const SUPPORTED_EXT = new Set([
  ".docx", ".txt", ".pdf", ".xlsx", ".xls", ".csv",
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
]);

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function extractText(filePath: string, mimeType: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === ".docx") {
    try {
      return await extractDocx(filePath);
    } catch {
      return "[Could not extract .docx content]";
    }
  }

  if (ext === ".xlsx" || ext === ".xls" || ext === ".csv") {
    try {
      const rows = parseExcel(filePath);
      return excelToText(rows);
    } catch {
      return "[Could not extract spreadsheet content]";
    }
  }

  if (ext === ".txt") {
    return buffer.toString("utf-8");
  }

  if (ext === ".pdf") {
    try {
      const pdfModule = await import("pdf-parse");
      const pdfParse = (
        pdfModule as unknown as { default: (b: Buffer) => Promise<{ text: string }> }
      ).default ?? pdfModule;
      const data = await pdfParse(buffer);
      return data.text;
    } catch {
      return "[PDF — could not extract text automatically]";
    }
  }

  if (mimeType.startsWith("image/")) {
    return `[Image file: ${path.basename(filePath)}]`;
  }

  return buffer.toString("utf-8").slice(0, 50000);
}

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
  if (lower.includes("ntc") || lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    return "ntc-excel";
  }
  return "rule";
}

export async function POST() {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return NextResponse.json({ registered: 0, skipped: 0 });
    }

    const existing = readManifest();
    const existingPaths = new Set(existing.map((d) => d.filePath));

    const files = fs.readdirSync(UPLOADS_DIR).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return SUPPORTED_EXT.has(ext) && !f.startsWith(".");
    });

    let registered = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);

      if (existingPaths.has(filePath)) {
        skipped++;
        continue;
      }

      const ext = path.extname(file).toLowerCase();
      const mimeType = guessMimeType(ext);
      const stat = fs.statSync(filePath);

      try {
        const content = await extractText(filePath, mimeType);

        const record: DocumentRecord = {
          id: crypto.randomUUID(),
          name: file,
          type: guessDocType(file),
          mimeType,
          filePath,
          content,
          uploadedAt: stat.mtime.toISOString(),
          size: stat.size,
        };

        addDocument(record);
        registered++;
      } catch (err) {
        errors.push(`${file}: ${err}`);
      }
    }

    return NextResponse.json({ registered, skipped, errors });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}
