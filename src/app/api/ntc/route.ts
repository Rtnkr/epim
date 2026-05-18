import { NextRequest, NextResponse } from "next/server";
import { groq, GROQ_MODEL, SYSTEM_PROMPT } from "@/lib/claude";
import { getNTCDocument } from "@/lib/documents";
import { parseExcel } from "@/lib/excel";

async function fetchURLContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ProcessHub/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  const html = await res.text();
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

export async function POST(req: NextRequest) {
  try {
    const { productText, productURL } = await req.json();

    if (!productText?.trim() && !productURL?.trim()) {
      return NextResponse.json({ error: "Please provide a product description or URL." }, { status: 400 });
    }

    const ntcDoc = await getNTCDocument();
    if (!ntcDoc) {
      return NextResponse.json(
        { error: "No NTC Excel document found. Please upload your NTC file in Manage Docs." },
        { status: 404 }
      );
    }

    const rows = await parseExcel(ntcDoc.filePath);
    if (rows.length === 0) {
      return NextResponse.json({ error: "NTC file appears to be empty." }, { status: 404 });
    }

    const query = [productText, productURL].filter(Boolean).join(" ");
    const queryWords = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const headers = Object.keys(rows[0]);

    const scored = rows.map((row) => {
      const rowText = Object.values(row).join(" ").toLowerCase();
      const score = queryWords.reduce((s, w) => s + (rowText.includes(w) ? 1 : 0), 0);
      return { row, score };
    });

    const top = scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => r.row);

    const selected = top.length > 0 ? top : rows.slice(0, 15);
    const ntcTable = [
      headers.join(" | "),
      ...selected.map((row) => headers.map((h) => String(row[h] ?? "")).join(" | ")),
    ].join("\n");

    let urlContent = "";
    if (productURL?.trim()) {
      try { urlContent = await fetchURLContent(productURL.trim()); }
      catch { urlContent = `[Could not fetch URL: ${productURL}]`; }
    }

    const productInfo = [
      productText?.trim() ? `Product Description:\n${productText.trim()}` : "",
      urlContent ? `URL: ${productURL}\nPage Content:\n${urlContent}` : "",
    ].filter(Boolean).join("\n\n");

    const userMessage = `NTC table — top matches from ${rows.length} total rows:\n\n${ntcTable}\n\n---\n\nBased on the product information below, identify the BEST matching NTC combination. Return:\n1. Top 3 most suitable NTC combinations in order of confidence\n2. For each: exact Noun, Type, and Category values from the table\n3. Brief explanation of why each matches\n4. Which combination you recommend and why\n\n${productInfo}`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1200,
      temperature: 0.1,
    });

    const answer = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ answer, rowCount: rows.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("NTC error:", message);
    if (message.includes("429") || message.includes("rate_limit")) {
      return NextResponse.json({ error: "Rate limit reached. Please wait a moment and try again." }, { status: 429 });
    }
    if (message.includes("401") || message.includes("403") || message.toLowerCase().includes("invalid api key") || message.includes("not-set") || message.toLowerCase().includes("unauthorized")) {
      return NextResponse.json({ error: "AI not configured — add GROQ_API_KEY in Vercel → Project Settings → Environment Variables, then redeploy." }, { status: 401 });
    }
    return NextResponse.json({ error: "NTC lookup failed: " + message }, { status: 500 });
  }
}
