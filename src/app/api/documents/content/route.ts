import { NextResponse } from "next/server";
import { readManifest } from "@/lib/documents";

export async function GET() {
  const docs = readManifest().filter(
    (d) => d.type === "rule" || d.type === "reference"
  );
  // Return full records including content (strip filePath for security)
  const safe = docs.map(({ filePath: _fp, ...rest }) => rest);
  return NextResponse.json({ documents: safe });
}
