import { useNavigate } from "react-router-dom";
import { Plus, FileText } from "lucide-react";

// Placeholder documents until a real backend/database is wired up
const mockDocuments = [
  { id: 1, title: "Introduction to Machine Learning", date: "3/14/2026", pages: 45 },
  { id: 2, title: "React Design Patterns", date: "3/9/2026", pages: 32 },
  { id: 3, title: "Psychology of Focus", date: "3/4/2026", pages: 28 },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Your documents
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Add new document card */}
        <button
          onClick={() => navigate("/upload")}
          className="flex flex-col items-center justify-center gap-3 p-8 bg-white border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer"
        >
          <Plus className="w-8 h-8" />
          <span className="text-sm font-medium">Add new document</span>
        </button>

        {/* Document cards */}
        {mockDocuments.map((doc) => (
          <div
            key={doc.id}
            className="flex flex-col gap-2 p-5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
          >
            <FileText className="w-8 h-8 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              {doc.title}
            </h3>
            <p className="text-xs text-slate-400">{doc.date}</p>
            <p className="text-xs text-slate-500 mt-auto">{doc.pages} pages</p>
          </div>
        ))}
      </div>
    </div>
  );
}
