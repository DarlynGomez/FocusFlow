import { useEffect, useRef } from "react";
import { Bookmark, X, Trash2, ArrowRight, BookOpen } from "lucide-react";
import type { Bookmark as BookmarkItem } from "../utils/bookmarkStorage";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookmarkItem[];
  onJump: (chunkIndex: number) => void;
  onDelete: (id: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function BookmarksPanel({
  isOpen,
  onClose,
  bookmarks,
  onJump,
  onDelete,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/10 transition-opacity duration-200 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel — slides in from the right */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full z-40 w-80 bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900">Bookmarks</h2>
            <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
              {bookmarks.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                <Bookmark className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                No bookmarks yet
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Click the bookmark icon next to any section heading while
                reading to save your place.
              </p>
            </div>
          ) : (
            <ul className="p-3 space-y-1.5">
              {bookmarks.map((bm) => (
                <li key={bm.id}>
                  <div className="group flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mt-0.5">
                      <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">
                          {bm.label}
                        </span>
                        <span className="text-[10px] text-slate-300">·</span>
                        <span className="text-[10px] text-slate-400">
                          {timeAgo(bm.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {bm.preview || "No preview available"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          onJump(bm.chunkIndex);
                          onClose();
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Jump to this position"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDelete(bm.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete bookmark"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {bookmarks.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100">
            <p className="text-[11px] text-slate-400">
              Bookmarks are saved across sessions.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
