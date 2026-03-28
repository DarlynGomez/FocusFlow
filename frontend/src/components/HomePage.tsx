import { useNavigate } from "react-router-dom";
import { Plus, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  getSavedDocuments,
  getDocumentData,
  removeDocument,
} from "../utils/documentStorage";
import type { SavedDocument } from "../utils/documentStorage";

export default function HomePage() {
  const navigate = useNavigate();
  const [documents, setDocuments] =
    useState<SavedDocument[]>(getSavedDocuments);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleOpenDocument = async (doc: SavedDocument) => {
    setRestoreError(null);

    // Get the full document data from localStorage.
    const data = getDocumentData(doc.sessionId) as Record<
      string,
      unknown
    > | null;

    if (!data) {
      // Data was lost (localStorage cleared, different browser, etc).
      // Send them to upload instead.
      navigate("/upload");
      return;
    }

    setRestoringId(doc.id);

    try {
      const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

      // Restore the FAISS index on the server.
      // If the server never restarted this is a no-op (returns restored: false).
      await fetch(`${BASE_URL}/api/documents/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: doc.sessionId,
          chunks: (data as { chunks: unknown[] }).chunks ?? [],
        }),
      });

      // Navigate to the reading view with the full document data.
      navigate("/reading", {
        state: {
          document: data,
          guidanceLevel: doc.guidanceLevel,
        },
      });
    } catch {
      setRestoreError(
        "Could not connect to the server. Is the backend running?"
      );
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeDocument(id);
    setDocuments(getSavedDocuments());
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-5xl mx-auto pt-8 px-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Your documents</h1>

      {restoreError && (
        <p className="text-sm text-red-500 mb-4">{restoreError}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={() => navigate("/upload")}
          className="flex flex-col items-center justify-center gap-3 p-8 bg-white border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer"
        >
          <Plus className="w-8 h-8" />
          <span className="text-sm font-medium">Add new document</span>
        </button>

        {documents.length === 0 && (
          <div className="flex items-center col-span-2 px-2 py-8">
            <p className="text-sm text-slate-400">
              No documents yet. Upload your first PDF to get started.
            </p>
          </div>
        )}

        {documents.map((doc) => (
          <div
            key={doc.id}
            onClick={() => handleOpenDocument(doc)}
            className="relative flex flex-col gap-2 p-5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer group"
          >
            <button
              onClick={(e) => handleDelete(e, doc.id)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
              aria-label="Remove document"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <FileText className="w-8 h-8 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-900 pr-6 truncate">
              {doc.filename}
            </h3>
            <p className="text-xs text-slate-400">
              {formatDate(doc.uploadedAt)}
            </p>

            {/* Loading indicator while restoring the session */}
            {restoringId === doc.id ? (
              <p className="text-xs text-indigo-500 mt-auto">Opening...</p>
            ) : (
              <div className="flex items-center gap-2 mt-auto flex-wrap">
                <span className="text-xs text-slate-500">
                  {doc.totalPages} pages
                </span>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-xs text-slate-500 capitalize">
                  {doc.guidanceLevel} guidance
                </span>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-xs text-slate-500">{doc.parserUsed}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
