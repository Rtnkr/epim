"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, FileText, Table, FileImage, RefreshCw, FolderSearch } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocMeta {
  id: string;
  name: string;
  type: "rule" | "ntc-excel" | "reference";
  mimeType: string;
  uploadedAt: string;
  size: number;
}

const typeLabel: Record<DocMeta["type"], string> = {
  rule: "Rule / SOP",
  "ntc-excel": "NTC Excel",
  reference: "Reference",
};

const typeColor: Record<DocMeta["type"], string> = {
  rule: "bg-blue-50 text-blue-700",
  "ntc-excel": "bg-green-50 text-green-700",
  reference: "bg-amber-50 text-amber-700",
};

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))
    return <FileImage className="w-4 h-4 text-[#9c9c96]" />;
  if (
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  )
    return <Table className="w-4 h-4 text-green-600" />;
  return <FileText className="w-4 h-4 text-[#9c9c96]" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RulesPage() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<DocMeta["type"]>("rule");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchDocs() {
    const res = await fetch("/api/documents");
    const data = await res.json();
    setDocs(data.documents ?? []);
  }

  useEffect(() => {
    fetchDocs();
  }, []);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", uploadType);
      await fetch("/api/upload", { method: "POST", body: fd });
      await fetchDocs();
    } finally {
      setUploading(false);
    }
  }

  async function handleScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/documents/scan", { method: "POST" });
      const data = await res.json();
      setScanResult(
        `Registered ${data.registered} new file${data.registered !== 1 ? "s" : ""}${data.skipped > 0 ? `, ${data.skipped} already known` : ""}.`
      );
      await fetchDocs();
    } finally {
      setScanning(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this document?")) return;
    await fetch("/api/documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  const ruleCount = docs.filter((d) => d.type === "rule").length;
  const ntcDoc = docs.find((d) => d.type === "ntc-excel");

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1a1a18] tracking-tight mb-1.5">
          Rules Management
        </h1>
        <p className="text-sm text-[#6b6b66]">
          Upload your SOP/rule documents and NTC Excel file. The AI assistant
          uses these to answer questions and attribute product fields.
        </p>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-6 mb-8 p-4 rounded-lg border border-[#e5e5e3] bg-white">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96]">
            Rule Docs
          </p>
          <p className="text-xl font-bold text-[#1a1a18]">{ruleCount}</p>
        </div>
        <div className="w-px h-8 bg-[#e5e5e3]" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96]">
            NTC Excel
          </p>
          <p
            className={cn(
              "text-sm font-semibold mt-0.5",
              ntcDoc ? "text-green-600" : "text-[#9c9c96]"
            )}
          >
            {ntcDoc ? ntcDoc.name : "Not uploaded"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {scanResult && (
            <span className="text-xs text-green-600 font-medium">{scanResult}</span>
          )}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 text-xs text-white bg-[#1a1a18] hover:bg-[#3d3d3a] px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
          >
            {scanning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FolderSearch className="w-3.5 h-3.5" />
            )}
            Scan Folder
          </button>
          <button
            onClick={fetchDocs}
            className="flex items-center gap-1.5 text-xs text-[#9c9c96] hover:text-[#6b6b66] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Upload area */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-sm font-semibold text-[#1a1a18]">
            Upload document
          </p>
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as DocMeta["type"])}
            className="ml-auto text-xs border border-[#e5e5e3] rounded-md px-2.5 py-1.5 text-[#3d3d3a] bg-white focus:outline-none focus:border-[#c9c9c5]"
          >
            <option value="rule">Rule / SOP document</option>
            <option value="ntc-excel">NTC Excel file</option>
            <option value="reference">Reference document</option>
          </select>
        </div>

        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200",
            dragOver
              ? "border-[#1a1a18] bg-[#f0f0ee]"
              : "border-[#e5e5e3] hover:border-[#c9c9c5] bg-white"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.docx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
              e.target.value = "";
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 text-[#9c9c96] animate-spin" />
              <p className="text-sm text-[#6b6b66]">Uploading and extracting…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-[#9c9c96]" />
              <p className="text-sm font-medium text-[#3d3d3a]">
                Drop a file here or click to browse
              </p>
              <p className="text-xs text-[#9c9c96]">
                PDF, TXT, XLSX, CSV, PNG, JPG supported
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Document list */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9c9c96] mb-3">
          Uploaded documents ({docs.length})
        </p>

        {docs.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-[#e5e5e3] bg-white">
            <FileText className="w-8 h-8 text-[#e5e5e3] mx-auto mb-2" />
            <p className="text-sm text-[#9c9c96]">
              No documents uploaded yet.
            </p>
            <p className="text-xs text-[#9c9c96] mt-1">
              Upload your SOP rules and NTC Excel to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3.5 rounded-lg border border-[#e5e5e3] bg-white"
              >
                <FileIcon mimeType={doc.mimeType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a1a18] truncate">
                    {doc.name}
                  </p>
                  <p className="text-[11px] text-[#9c9c96]">
                    {formatSize(doc.size)} ·{" "}
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0",
                    typeColor[doc.type]
                  )}
                >
                  {typeLabel[doc.type]}
                </span>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 rounded-md text-[#c9c9c5] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
