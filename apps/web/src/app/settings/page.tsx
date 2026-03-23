"use client";

import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/dashboard" className="text-xl font-bold text-slate-900">
          FocusFlow
        </Link>
      </header>
      <main className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Settings</h1>
        <p className="text-slate-600 mb-8">
          Reading preferences (font size, support intensity) can be adjusted on the reading page. More options coming soon.
        </p>
        <Link href="/dashboard" className="text-indigo-600 hover:underline">Back to dashboard</Link>
      </main>
    </div>
  );
}
