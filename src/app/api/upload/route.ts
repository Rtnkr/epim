import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { addDocument, cleanDocContent, USE_BLOB, DocumentRecord } from "@/lib/documents";
import { parseExcel, excelToText } from "@/lib/excel";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function extractText(buffer: Buffer, mimeType: string, filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch { return "[Could not extract .docx content]"; }
  }

  if ([".xlsx", ".xls", ".csv"].includes(ext)) {
    try {
      // parseExcel handles buffer via a temp local path; for blob uploads we pass the buffer directly
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const { excelToText: toText } = await import("@/lib/excel");
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      return toText(rows as Parameters<typeof toText>[0]);
    } catch { return "[Could not extract spreadsheet content]"; }
  }

  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf") {
    try {
      const pdfModule = await import("pdf-parse");
      const pdfParse = (pdfModule as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default ?? pdfModule;
      const data = await pdfParse(buffer);
      return data.text;
    } catch { return "[PDF — could not extract text automatically]"; }
  }

  if (mimeType.startsWith("image/")) {
    return `[Image file: ${path.basename(filePath)}]`;
  }

  return buffer.toString("utf-8").slice(0, 50000);
}

function guessDocType(name: string): DocumentRecord["type"] {
  const lower = name.toLowerCase();
  if (lower.includes("ntc") || lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    return "ntc-excel";
  }
  return "rule";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = (formData.get("type") as string) || "rule";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const ext = path.extname(file.name);

    const rawContent = await extractText(buffer, file.type, file.name);
    const content = file.type.startsWith("image/") ? rawContent : cleanDocContent(rawContent);

    let filePath: string;

    if (USE_BLOB) {
      const { put } = await import("@vercel/blob");
      const blob = await put(`epim-files/${id}${ext}`, buffer, {
        access: "public",
        addRandomSuffix: false,
        contentType: file.type,
      });
      filePath = blob.url;
    } else {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      filePath = path.join(UPLOADS_DIR, `${id}${ext}`);
      fs.writeFileSync(filePath, buffer);
    }

    const record: DocumentRecord = {
      id,
      name: file.name,
      type: docType as DocumentRecord["type"],
      mimeType: file.type,
      filePath,
      content,
      uploadedAt: new Date().toISOString(),
      size: buffer.length,
    };

    await addDocument(record);
    return NextResponse.json({ success: true, document: record });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
