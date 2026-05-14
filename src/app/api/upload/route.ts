import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { addDocument, DocumentRecord } from "@/lib/documents";
import { parseExcel, excelToText } from "@/lib/excel";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function extractText(
  buffer: Buffer,
  mimeType: string,
  filePath: string
): Promise<string> {
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    filePath.endsWith(".xlsx") ||
    filePath.endsWith(".xls") ||
    filePath.endsWith(".csv")
  ) {
    const rows = parseExcel(filePath);
    return excelToText(rows);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filePath.endsWith(".docx")
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch {
      return "[Could not extract .docx content]";
    }
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
    } catch {
      return "[PDF content — could not extract text automatically. Upload as image or text for best results.]";
    }
  }

  if (mimeType.startsWith("image/")) {
    return `[Image file: ${path.basename(filePath)}. Will be sent to Claude vision for analysis.]`;
  }

  return buffer.toString("utf-8").slice(0, 50000);
}

export async function POST(req: NextRequest) {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = (formData.get("type") as string) || "rule";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const ext = path.extname(file.name);
    const savedName = `${id}${ext}`;
    const filePath = path.join(UPLOADS_DIR, savedName);

    fs.writeFileSync(filePath, buffer);

    const content = await extractText(buffer, file.type, filePath);

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

    addDocument(record);

    return NextResponse.json({ success: true, document: record });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
