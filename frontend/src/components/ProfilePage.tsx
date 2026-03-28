import { FileText, Clock, Bot, Target } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mock data                                                         */
/* ------------------------------------------------------------------ */

const stats = [
  { label: "Documents read", value: "12", icon: FileText },
  { label: "Hours focused", value: "34", icon: Clock },
  { label: "AI interventions", value: "58", icon: Bot },
  { label: "Avg. focus score", value: "81%", icon: Target },
];

const recentReading = [
  { title: "Introduction to Machine Learning", date: "Mar 16", progress: 72 },
  { title: "React Design Patterns", date: "Mar 13", progress: 45 },
  { title: "Psychology of Focus", date: "Mar 9", progress: 100 },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  const name = "Alex Johnson";
  const email = "alex@example.com";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile header */}
      <div className="bg-gradient-to-b from-indigo-50 to-slate-50 rounded-2xl p-8 mb-8">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-bold shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
            <p className="text-sm text-slate-500">{email}</p>
            <button
              type="button"
              className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Edit profile
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-5 text-center"
          >
            <p className="text-2xl font-bold text-indigo-600">{value}</p>
            <p className="text-sm text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent reading */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Recent reading
        </h2>
        <div className="divide-y divide-slate-100">
          {recentReading.map(({ title, date, progress }) => (
            <div
              key={title}
              className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
            >
              {/* Doc icon */}
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>

              {/* Title & meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {title}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {date}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" /> {progress}% complete
                  </span>
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-28 shrink-0">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
