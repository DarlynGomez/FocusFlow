import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">FocusFlow</h1>
        <p className="text-lg text-slate-600 mb-8">
          Your AI reading companion. Turn dense PDFs into structured, supportive reading experiences.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-slate-200 text-slate-800 font-medium hover:bg-slate-300"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            Get started
          </Link>
        </div>
      </div>
    </div>
  );
}
