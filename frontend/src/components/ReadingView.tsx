import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { MessageCircle, X, Lightbulb, Download } from "lucide-react";
import RightPanel from "./RightPanel";
import ChunkRenderer from "./ChunkRenderer";

interface TextElement {
  text: string;
  element_type: string;
  page_number: number | null;
  char_count: number;
}

interface DocumentChunk {
  chunk_index: number;
  text: string;
  page_number: number | null;
  element_type: "heading" | "table" | "text" | "image" | "Title";
  char_count: number;
  is_section_start: boolean;
  image_data?: string;
  image_width?: number;
  image_height?: number;
}

interface ParsedDocument {
  filename: string;
  total_elements: number;
  total_chunks: number;
  session_id: string;
  elements: TextElement[];
  chunks: DocumentChunk[];
  classification: {
    parser_used: string;
    routing_reasons: string[];
    signals: Record<string, unknown>;
  };
  low_text_warning: boolean;
  warning_message: string | null;
}

interface ReadingLocationState {
  document: ParsedDocument;
  guidanceLevel: string;
}

function InterventionPopup({
  onDismiss,
  onAccept,
}: {
  onDismiss: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-72 bg-white border border-indigo-200 rounded-2xl shadow-lg shadow-indigo-100 p-4 flex flex-col gap-3 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug">
            Looks like you might need some help
          </p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Would you like an AI explanation of this section?
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onDismiss}
          className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Dismiss
        </button>
        <button
          onClick={onAccept}
          className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors"
        >
          Get help
        </button>
      </div>
    </div>
  );
}

export default function ReadingView() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ReadingLocationState | null;

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [guidanceLevel, setGuidanceLevel] = useState(
    state?.guidanceLevel ?? "medium"
  );
  const [panelWidth, setPanelWidth] = useState(360);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showIntervention, setShowIntervention] = useState(false);

  // These must be declared before any early return so hooks are always
  // called in the same order on every render.

  const chunkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const interventionFiredRef = useRef(false);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state || !state.document) {
      navigate("/", { replace: true });
    }
  }, [state, navigate]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;
    const readingLine = containerTop + container.clientHeight * 0.35;

    let newIndex = 0;
    for (let i = 0; i < chunkRefs.current.length; i++) {
      const el = chunkRefs.current[i];
      if (!el) continue;
      if (el.getBoundingClientRect().bottom < readingLine) {
        newIndex = i + 1;
      }
    }
    setCurrentIndex(newIndex);

    if (newIndex >= 5 && !interventionFiredRef.current) {
      interventionFiredRef.current = true;
      setShowIntervention(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPanelWidth = containerRect.right - e.clientX;
    setPanelWidth(
      Math.max(240, Math.min(newPanelWidth, containerRect.width * 0.7))
    );
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  if (!state || !state.document) return null;

  const { document: parsedDoc } = state;

  const contentItems = parsedDoc.chunks?.length
    ? parsedDoc.chunks
    : parsedDoc.elements;

  const currentItem = contentItems[currentIndex];

  const currentChunkIndex = parsedDoc.chunks?.length
    ? (currentItem as DocumentChunk)?.chunk_index ?? currentIndex
    : currentIndex;

  const currentPage =
    (contentItems[currentIndex] as DocumentChunk)?.page_number ?? 1;

  const totalPages = contentItems.reduce((max, item) => {
    const page = (item as DocumentChunk).page_number ?? 1;
    return page > max ? page : max;
  }, 1);

  const handleDownload = () => {
    const text = parsedDoc.elements.map((el) => el.text).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = parsedDoc.filename.replace(/\.pdf$/i, "") + ".txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-88px)]">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-slate-900 truncate max-w-lg">
            {parsedDoc.filename}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {parsedDoc.total_elements} sections ·{" "}
            {parsedDoc.classification.parser_used} parser ·{" "}
            <span className="capitalize">{guidanceLevel}</span> guidance
          </p>
        </div>
      </div>

      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-slate-100 relative"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-2 bg-white border-b border-slate-200">
            <span className="text-xs text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>

          <div className="max-w-2xl mx-auto px-8 py-6 space-y-4">
            {contentItems.map((item, index) => {
              const isPast = index < currentIndex;
              const chunk = item as DocumentChunk;

              return (
                <div
                  key={index}
                  ref={(el) => {
                    chunkRefs.current[index] = el;
                  }}
                  style={{
                    opacity: isPast ? 0.22 : 1,
                    transition: "opacity 0.5s ease",
                  }}
                >
                  <ChunkRenderer
                    elementType={chunk.element_type}
                    text={chunk.text}
                    imageData={chunk.image_data}
                    pageNumber={chunk.page_number}
                  />
                </div>
              );
            })}
            <div className="h-[50vh]" />
          </div>

          {showIntervention && (
            <InterventionPopup
              onDismiss={() => setShowIntervention(false)}
              onAccept={() => {
                setShowIntervention(false);
                setIsPanelOpen(true);
              }}
            />
          )}

          {!isPanelOpen && (
            <button
              onClick={() => setIsPanelOpen(true)}
              className="fixed bottom-6 right-6 z-10 w-12 h-12 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-200 flex items-center justify-center transition-colors"
              aria-label="Open AI Assistant"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        {isPanelOpen && (
          <>
            <div
              className="w-1 bg-slate-200 hover:bg-indigo-300 cursor-col-resize shrink-0 transition-colors"
              onMouseDown={() => {
                isDragging.current = true;
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
              }}
            />
            <div
              style={{ width: panelWidth }}
              className="shrink-0 overflow-hidden"
            >
              <RightPanel
                documentTitle={parsedDoc.filename}
                currentPage={currentPage}
                totalPages={totalPages}
                guidanceLevel={guidanceLevel}
                onGuidanceLevelChange={setGuidanceLevel}
                onClose={() => setIsPanelOpen(false)}
                sessionId={parsedDoc.session_id}
                currentChunkIndex={currentChunkIndex}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
