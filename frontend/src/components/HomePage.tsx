import { useNavigate } from "react-router-dom";
import { Plus, FileText, Trash2, BookOpen } from "lucide-react";
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
    const data = getDocumentData(doc.sessionId) as Record<
      string,
      unknown
    > | null;
    if (!data) {
      navigate("/upload");
      return;
    }
    setRestoringId(doc.id);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      await fetch(`${BASE_URL}/api/documents/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: doc.sessionId,
          chunks: (data as { chunks: unknown[] }).chunks ?? [],
        }),
      });
      navigate("/reading", {
        state: { document: data, guidanceLevel: doc.guidanceLevel },
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const isEmpty = documents.length === 0;

  return (
    <div className="max-w-4xl mx-auto pt-10 px-6 pb-20">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Your documents</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload a PDF to start reading with FocusFlow.
        </p>
      </div>

      {restoreError && (
        <p className="text-sm text-red-500 mb-4">{restoreError}</p>
      )}

      {isEmpty ? (
        // Clean centered empty state
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-slate-700">
              No documents yet
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Upload your first PDF to get started.
            </p>
          </div>
          <button
            onClick={() => navigate("/upload")}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Upload a document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Add new card */}
          <button
            onClick={() => navigate("/upload")}
            className="flex flex-col items-center justify-center gap-3 p-8 bg-white border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors min-h-35"
          >
            <Plus className="w-6 h-6" />
            <span className="text-sm font-medium">Add document</span>
          </button>

          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleOpenDocument(doc)}
              className="relative flex flex-col gap-3 p-5 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group min-h-35"
            >
              <button
                onClick={(e) => handleDelete(e, doc.id)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                aria-label="Remove document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <FileText className="w-7 h-7 text-indigo-500" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900 pr-6 truncate leading-snug">
                  {doc.filename}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDate(doc.uploadedAt)}
                </p>
              </div>

              {restoringId === doc.id ? (
                <p className="text-xs text-indigo-500">Opening...</p>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400">
                    {doc.totalPages} pages
                  </span>
                  <span className="text-slate-200 text-xs">·</span>
                  <span className="text-xs text-slate-400 capitalize">
                    {doc.guidanceLevel}
                  </span>
                  <span className="text-slate-200 text-xs">·</span>
                  <span className="text-xs text-slate-400">
                    {doc.parserUsed}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
