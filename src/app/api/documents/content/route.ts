import { NextResponse } from "next/server";
import { readManifest } from "@/lib/documents";

export async function GET() {
  const docs = await readManifest();
  const rules = docs.filter((d) => d.type === "rule" || d.type === "reference");
  const safe = rules.map(({ filePath: _fp, ...rest }) => rest);
  return NextResponse.json({ documents: safe });
}
