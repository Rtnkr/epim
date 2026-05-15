import * as XLSX from "xlsx";
import fs from "fs";

export interface NTCRow {
  [key: string]: string | number | undefined;
}

// Accepts a local file path (dev) or a Blob URL (Vercel)
export async function parseExcel(source: string): Promise<NTCRow[]> {
  let buffer: Buffer;
  if (source.startsWith("http")) {
    const res = await fetch(source);
    const ab = await res.arrayBuffer();
    buffer = Buffer.from(ab);
  } else {
    buffer = fs.readFileSync(source);
  }
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<NTCRow>(sheet, { defval: "" });
}

export function excelToText(rows: NTCRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const headerLine = headers.join(" | ");
  const dataLines = rows.map((row) =>
    headers.map((h) => String(row[h] ?? "")).join(" | ")
  );
  return [headerLine, ...dataLines].join("\n");
}
