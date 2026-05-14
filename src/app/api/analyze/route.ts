import { NextRequest, NextResponse } from "next/server";
import { groq, GROQ_MODEL, GROQ_VISION_MODEL, SYSTEM_PROMPT } from "@/lib/claude";
import { getAllDocumentContent, getNTCDocument } from "@/lib/documents";
import { parseExcel, excelToText } from "@/lib/excel";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";

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
    .slice(0, 12000);
}

function buildNTCContext(query: string): string {
  const ntcDoc = getNTCDocument();
  if (!ntcDoc) return "";
  try {
    const rows = parseExcel(ntcDoc.filePath);
    if (rows.length === 0) return "";

    const headers = Object.keys(rows[0]);
    const queryWords = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);

    // Score each row by how many query words appear in its values
    const scored = rows.map((row) => {
      const rowText = Object.values(row).join(" ").toLowerCase();
      const score = queryWords.reduce(
        (s, w) => s + (rowText.includes(w) ? 1 : 0),
        0
      );
      return { row, score };
    });

    // Take top 15 matching rows (or first 15 if no matches)
    const top = scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map((r) => r.row);

    const selected = top.length > 0 ? top : rows.slice(0, 10);
    const headerLine = headers.join(" | ");
    const dataLines = selected.map((row) =>
      headers.map((h) => String(row[h] ?? "")).join(" | ")
    );

    return `\n\n=== NTC TABLE (top matches from ${rows.length} rows) ===\n${headerLine}\n${dataLines.join("\n")}\n`;
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inputText, inputURL, imageBase64, imageMimeType, history } = body;

    const queryHint = [inputText, inputURL].filter(Boolean).join(" ");
    const ruleContent = getAllDocumentContent(queryHint);
    const ntcContent = buildNTCContext(queryHint);

    if (!ruleContent && !ntcContent) {
      return NextResponse.json({
        answer:
          "No rule documents found. Please go to **Rules** and click **Scan Folder** to register your uploaded documents.",
      });
    }

    const contextBlock = `${ruleContent}${ntcContent}`;
    const hasImage = !!(imageBase64 && imageMimeType);
    const model = hasImage ? GROQ_VISION_MODEL : GROQ_MODEL;

    // Detect whether the user is asking a question or providing product info for attribution
    const textForDetection = (inputText ?? "").trim();
    const isQuestion =
      /[?]/.test(textForDetection) ||
      /^(what|how|why|when|where|can|is|are|should|does|do|which|who)\b/i.test(textForDetection);
    const hasProductInput = !!(inputURL?.trim() || imageBase64);

    const modeInstruction =
      isQuestion && !hasProductInput
        ? "Answer the question below using the rules."
        : "Attribute ALL fields for the product information below. Use the full attribution format from your instructions — every field, N through 17.";

    // Build the user message content
    let userText = `RULES CONTEXT:\n\n${contextBlock}\n\n---\n\n${modeInstruction}`;

    if (inputURL?.trim()) {
      let urlContent = "";
      try {
        urlContent = await fetchURLContent(inputURL.trim());
      } catch {
        urlContent = `[Could not fetch URL: ${inputURL}]`;
      }
      userText += `\n\nURL: ${inputURL}\nPage content:\n${urlContent}`;
    }

    if (inputText?.trim()) {
      userText += `\n\n${inputText.trim()}`;
    }

    // Build messages array
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add conversation history
    if (Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    // Add current user message — with or without image
    if (hasImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userText },
          {
            type: "image_url",
            image_url: {
              url: `data:${imageMimeType};base64,${imageBase64}`,
            },
          },
        ],
      });
    } else {
      messages.push({ role: "user", content: userText });
    }

    const completion = await groq.chat.completions.create({
      model,
      messages,
      max_tokens: 1500,
      temperature: 0.2,
    });

    const answer = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ answer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Analysis error:", message);

    if (message.includes("429") || message.includes("rate_limit")) {
      return NextResponse.json(
        { error: "Rate limit reached. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Analysis failed: " + message },
      { status: 500 }
    );
  }
}
