"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { documents } from "@/lib/api";

export default function DashboardPage() {
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof documents.list>>>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    documents
      .list()
      .then((list) => {
        if (!cancelled) setDocs(list);
      })
      .catch(() => {
        if (!cancelled) router.push("/login");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="text-xl font-bold text-slate-900">
          FocusFlow
        </Link>
        <div className="flex gap-4">
          <Link href="/upload" className="text-indigo-600 font-medium hover:underline">
            Upload PDF
          </Link>
          <Link href="/settings" className="text-slate-600 hover:underline">
            Settings
          </Link>
          <button
            onClick={() => {
              localStorage.removeItem("focusflow_token");
              router.push("/");
              router.refresh();
            }}
            className="text-slate-600 hover:underline"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">Your documents</h2>
        {docs.length === 0 ? (
          <p className="text-slate-500 mb-6">No documents yet. Upload a PDF to get started.</p>
        ) : (
          <ul className="space-y-3">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200"
              >
                <div>
                  <p className="font-medium text-slate-900">{doc.title}</p>
                  <p className="text-sm text-slate-500">
                    {doc.status}
                    {doc.page_count != null && ` · ${doc.page_count} pages`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {doc.status === "ready" && (
                    <Link
                      href={`/read/${doc.id}`}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                    >
                      Read
                    </Link>
                  )}
                  {doc.status === "processing" && (
                    <Link
                      href={`/documents/${doc.id}`}
                      className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium"
                    >
                      View status
                    </Link>
                  )}
                  {doc.status === "uploaded" && (
                    <Link
                      href={`/documents/${doc.id}`}
                      className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium"
                    >
                      Process
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8">
          <Link
            href="/upload"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            Upload a PDF
          </Link>
        </div>
      </main>
    </div>
  );
}
