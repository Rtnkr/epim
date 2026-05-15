import { NextRequest, NextResponse } from "next/server";
import { readManifest, deleteDocument } from "@/lib/documents";

export async function GET() {
  const docs = await readManifest();
  const safe = docs.map(({ filePath: _fp, content: _c, ...rest }) => rest);
  return NextResponse.json({ documents: safe });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deleteDocument(id);
  return NextResponse.json({ success: true });
}
