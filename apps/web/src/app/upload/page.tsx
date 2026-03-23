"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { documents } from "@/lib/api";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setUploadError("Please select a PDF file.");
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const doc = await documents.upload(file);
      router.push(`/documents/${doc.id}`);
      router.refresh();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/dashboard" className="text-xl font-bold text-slate-900">
          FocusFlow
        </Link>
      </header>
      <main className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Upload a PDF</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Document</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f || null);
                setUploadError("");
              }}
              className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700"
            />
            {file && (
              <p className="mt-2 text-sm text-slate-500">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload and process"}
            </button>
            <Link href="/dashboard" className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
