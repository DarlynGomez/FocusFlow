import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { MessageCircle } from "lucide-react";
import RightPanel from "./RightPanel";

interface TextElement {
  text: string;
  element_type: string;
  page_number: number | null;
  char_count: number;
}

interface ParsedDocument {
  filename: string;
  total_elements: number;
  elements: TextElement[];
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

export default function ReadingView() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ReadingLocationState | null;

  // isPanelOpen tracks whether the right panel is visible
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const [guidanceLevel, setGuidanceLevel] = useState(
    state?.guidanceLevel ?? "medium"
  );

  // Width of the right panel column
  const [panelWidth, setPanelWidth] = useState(360);

  // Becomes true while the user is holding the mouse down on the drag handle
  const isDragging = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // If someone lands on /reading without uploading send them home
  useEffect(() => {
    if (!state || !state.document) {
      navigate("/", { replace: true });
    }
  }, [state, navigate]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    // Position and size of the container div
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPanelWidth = containerRect.right - e.clientX;

    const clamped = Math.max(
      240,
      Math.min(newPanelWidth, containerRect.width * 0.7)
    );

    setPanelWidth(clamped);
  }, []);

  const handleMouseUp = useCallback(() => {
    // When the user releases the mouse, stop dragging.
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      // Remove the listeners when ReadingView unmounts
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  if (!state || !state.document) {
    return null;
  }

  const { document } = state;

  // Derive unique page numbers from the elements array so we know the total page count
  const uniquePages = Array.from(
    new Set(document.elements.map((e) => e.page_number).filter(Boolean))
  );
  const totalPages = uniquePages.length || 1;

  return (
    <div className="flex flex-col h-[calc(100vh-88px)]">
      {/* Top bar containing document title and the avatar button that opens the panel */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-slate-900 truncate max-w-lg">
            {document.filename}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {document.total_elements} sections ·{" "}
            {document.classification.parser_used} parser ·{" "}
            <span className="capitalize">{guidanceLevel}</span> guidance
          </p>
        </div>

        {/* Avatar/toggle button for the right panel */}
        <button
          onClick={() => setIsPanelOpen((prev) => !prev)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
            isPanelOpen
              ? "bg-indigo-50 border-indigo-200 text-indigo-600"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          AI Assistant
        </button>
      </div>

      {/* Two-column layout */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Reader column */}
        <div className="flex-1 overflow-y-auto px-8 py-6 bg-slate-50">
          <div className="max-w-2xl mx-auto space-y-4">
            {document.elements.map((element, index) => (
              <div
                key={index}
                className={`leading-relaxed text-slate-700 ${
                  element.element_type === "Title"
                    ? "text-base font-semibold text-slate-900"
                    : "text-sm"
                }`}
              >
                {element.text}
              </div>
            ))}
          </div>
        </div>

        {/* Drag handle and panel */}
        {isPanelOpen && (
          <>
            <div
              className="w-1 bg-slate-200 hover:bg-indigo-300 cursor-col-resize shrink-0 transition-colors"
              onMouseDown={() => {
                isDragging.current = true;
                // Prevent text selection across the page while dragging.
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
              }}
            />

            {/* The panel column */}
            <div
              style={{ width: panelWidth }}
              className="shrink-0 overflow-hidden"
            >
              <RightPanel
                documentTitle={document.filename}
                currentPage={1}
                totalPages={totalPages}
                guidanceLevel={guidanceLevel}
                onGuidanceLevelChange={setGuidanceLevel}
                onClose={() => setIsPanelOpen(false)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
