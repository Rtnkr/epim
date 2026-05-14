"use client";

import { useState, useRef, useCallback } from "react";
import {
  Send,
  Link as LinkIcon,
  Image as ImageIcon,
  Trash2,
  Loader2,
  FileSearch,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  inputSummary?: string;
}

interface InputState {
  text: string;
  url: string;
  imageBase64: string | null;
  imageMimeType: string | null;
  imageName: string | null;
}

function parseMarkdown(text: string): string {
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="my-3 p-3 bg-[#f0f0ee] rounded text-xs overflow-x-auto whitespace-pre-wrap">$1</pre>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-[#f0f0ee] rounded text-xs">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^#{3} (.+)$/gm, '<h3 class="font-semibold text-sm text-[#1a1a18] mt-3 mb-1">$1</h3>')
    .replace(/^#{2} (.+)$/gm, '<h2 class="font-semibold text-base text-[#1a1a18] mt-4 mb-1.5">$1</h2>')
    .replace(/^#{1} (.+)$/gm, '<h1 class="font-bold text-lg text-[#1a1a18] mt-4 mb-2">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-[#3d3d3a] list-disc">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)/g, '<ul class="my-2 space-y-0.5">$1</ul>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, "<br />");
}

export default function AnalyzePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<InputState>({
    text: "",
    url: "",
    imageBase64: null,
    imageMimeType: null,
    imageName: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        setInput((prev) => ({
          ...prev,
          imageBase64: base64,
          imageMimeType: file.type,
          imageName: file.name,
        }));
      };
      reader.readAsDataURL(file);
    },
    []
  );

  function clearImage() {
    setInput((prev) => ({
      ...prev,
      imageBase64: null,
      imageMimeType: null,
      imageName: null,
    }));
  }

  async function handleSubmit() {
    if (!input.text && !input.url && !input.imageBase64) return;
    setError(null);

    const summaryParts: string[] = [];
    if (input.url) summaryParts.push(`URL: ${input.url}`);
    if (input.text) summaryParts.push(input.text.slice(0, 80) + (input.text.length > 80 ? "…" : ""));
    if (input.imageName) summaryParts.push(`Image: ${input.imageName}`);

    const userMsg: Message = {
      role: "user",
      content: summaryParts.join(" · "),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    setInput((prev) => ({ ...prev, text: "", url: "" }));
    setLoading(true);

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText: input.text || undefined,
          inputURL: input.url || undefined,
          imageBase64: input.imageBase64 || undefined,
          imageMimeType: input.imageMimeType || undefined,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Analysis failed");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      clearImage();
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const hasInput = input.text || input.url || input.imageBase64;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-53px)] max-w-3xl mx-auto w-full px-4">
      {/* Header */}
      <div className="py-5 border-b border-[#e5e5e3]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#1a1a18] flex items-center justify-center">
            <FileSearch className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#1a1a18]">
              Process Intelligence
            </h1>
            <p className="text-xs text-[#9c9c96]">
              Ask a question or paste a product description, URL, or image
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="ml-auto flex items-center gap-1 text-xs text-[#9c9c96] hover:text-[#6b6b66] transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
            <div className="w-12 h-12 rounded-xl bg-[#f0f0ee] flex items-center justify-center">
              <FileSearch className="w-6 h-6 text-[#9c9c96]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#3d3d3a]">
                Ready to analyze
              </p>
              <p className="text-xs text-[#9c9c96] mt-1 max-w-xs">
                Paste a product description, a URL, or upload an image. The AI
                will match it against your uploaded rules and fill in all
                required fields.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { icon: "📝", label: "Text description" },
                { icon: "🔗", label: "Product URL" },
                { icon: "🖼️", label: "Image upload" },
              ].map((t) => (
                <div
                  key={t.label}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border border-[#e5e5e3] bg-white text-center"
                >
                  <span className="text-lg">{t.icon}</span>
                  <span className="text-[10px] text-[#9c9c96]">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "user" ? (
              <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-[#1a1a18] text-white text-sm leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[90%] w-full">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-5 h-5 rounded-md bg-[#f0f0ee] flex items-center justify-center">
                    <FileSearch className="w-2.5 h-2.5 text-[#6b6b66]" />
                  </div>
                  <span className="text-[10px] font-medium text-[#9c9c96] uppercase tracking-wider">
                    Process Intelligence
                  </span>
                </div>
                <div
                  className="text-sm text-[#1a1a18] leading-relaxed rounded-2xl rounded-tl-sm bg-white border border-[#e5e5e3] px-4 py-3"
                  dangerouslySetInnerHTML={{
                    __html: `<p class="mb-2">${parseMarkdown(msg.content)}</p>`,
                  }}
                />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-[#e5e5e3]">
              <Loader2 className="w-3.5 h-3.5 text-[#9c9c96] animate-spin" />
              <span className="text-xs text-[#9c9c96]">
                Analyzing against your rules…
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input panel */}
      <div className="pb-4 pt-2">
        <div className="rounded-xl border border-[#e5e5e3] bg-white shadow-[0_1px_3px_0_rgb(0_0_0/0.06)] overflow-hidden">
          {/* URL row */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#f0f0ee]">
            <LinkIcon className="w-3.5 h-3.5 text-[#9c9c96] shrink-0" />
            <input
              type="url"
              placeholder="Paste a product URL…"
              value={input.url}
              onChange={(e) => setInput((p) => ({ ...p, url: e.target.value }))}
              className="flex-1 text-sm text-[#3d3d3a] placeholder-[#c9c9c5] bg-transparent focus:outline-none"
            />
            {input.url && (
              <button onClick={() => setInput((p) => ({ ...p, url: "" }))}>
                <X className="w-3.5 h-3.5 text-[#c9c9c5] hover:text-[#6b6b66]" />
              </button>
            )}
          </div>

          {/* Image preview */}
          {input.imageName && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#f0f0ee] bg-[#f9f9f8]">
              <ImageIcon className="w-3.5 h-3.5 text-[#9c9c96] shrink-0" />
              <span className="text-xs text-[#6b6b66] flex-1 truncate">
                {input.imageName}
              </span>
              <button onClick={clearImage}>
                <X className="w-3.5 h-3.5 text-[#c9c9c5] hover:text-[#6b6b66]" />
              </button>
            </div>
          )}

          {/* Text input */}
          <textarea
            rows={3}
            placeholder="Paste a product description, question, or any text…"
            value={input.text}
            onChange={(e) =>
              setInput((p) => ({ ...p, text: e.target.value }))
            }
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2.5 text-sm text-[#1a1a18] placeholder-[#c9c9c5] bg-transparent focus:outline-none resize-none"
          />

          {/* Bottom actions */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#f0f0ee]">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-[#6b6b66] hover:bg-[#f0f0ee] transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Image
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#c9c9c5] hidden sm:inline">
                ⌘↵ to send
              </span>
              <button
                onClick={handleSubmit}
                disabled={!hasInput || loading}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  hasInput && !loading
                    ? "bg-[#1a1a18] text-white hover:bg-[#3d3d3a]"
                    : "bg-[#f0f0ee] text-[#c9c9c5] cursor-not-allowed"
                )}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Analyze
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
