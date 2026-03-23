"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { documents } from "@/lib/api";
import type { DocDetail } from "@/lib/api";

export default function DocumentStatusPage() {
  const params = useParams();
  const id = params.id as string;
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    documents
      .get(id)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch(() => {
        if (!cancelled) router.push("/dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
  }, [id, router]);

  useEffect(() => {
    if (!doc || doc.status !== "processing" && doc.status !== "uploaded") return;
    const t = setInterval(() => {
      documents.get(id).then((d) => setDoc(d));
    }, 3000);
    return () => clearInterval(t);
  }, [id, doc?.status]);

  if (loading || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/dashboard" className="text-xl font-bold text-slate-900">
          FocusFlow
        </Link>
      </header>
      <main className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">{doc.title}</h1>
        <p className="text-slate-500 mb-8">Status: {doc.status}</p>
        {doc.status === "processing" && (
          <p className="text-sm text-slate-600 mb-6">
            Parsing and chunking your document. This may take a minute.
          </p>
        )}
        {doc.status === "failed" && doc.error_message && (
          <p className="text-sm text-red-600 mb-6">{doc.error_message}</p>
        )}
        {doc.status === "ready" && (
          <Link
            href={`/read/${doc.id}`}
            className="inline-flex px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            Start reading
          </Link>
        )}
        <Link href="/dashboard" className="block mt-6 text-indigo-600 hover:underline">
          Back to dashboard
        </Link>
      </main>
    </div>
  );
}
