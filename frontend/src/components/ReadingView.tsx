import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { MessageCircle, X, Lightbulb, Download } from "lucide-react";
import RightPanel from "./RightPanel";
import {
  useBehavioralDetection,
  type DetectionSignal,
} from "../hooks/useBehavioralDetection";

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
  element_type: "heading" | "table" | "text";
  char_count: number;
  is_section_start: boolean;
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

const SIGNAL_MESSAGES: Record<
  string,
  { heading: string; subtext: string }
> = {
  pause: {
    heading: "You seem to be pausing here",
    subtext: "Would you like an AI explanation of this section?",
  },
  repeated_scroll: {
    heading: "You've re-read this section a few times",
    subtext: "Want help understanding this part?",
  },
  slow_progress: {
    heading: "This section seems challenging",
    subtext: "Would you like a summary or explanation?",
  },
};

const DEFAULT_SIGNAL_MESSAGE = {
  heading: "Looks like you might need some help",
  subtext: "Would you like an AI explanation of this section?",
};

/**
 * Intervention popup with three actions:
 *   X  (top-right)      → close this instance; future signals can still show it
 *   "Don't show again"  → permanently disable intervention popups
 *   "Get help"          → open the AI panel
 */
function InterventionPopup({
  onClose,
  onNeverShowAgain,
  onAccept,
  signalSource,
}: {
  onClose: () => void;
  onNeverShowAgain: () => void;
  onAccept: () => void;
  signalSource?: string | null;
}) {
  const msg = (signalSource && SIGNAL_MESSAGES[signalSource]) || DEFAULT_SIGNAL_MESSAGE;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-72 bg-white border border-indigo-200 rounded-2xl shadow-lg shadow-indigo-100 p-4 flex flex-col gap-3 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug">
            {msg.heading}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {msg.subtext}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close popup"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onNeverShowAgain}
          className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Don't show again
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
  const chunkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showIntervention, setShowIntervention] = useState(false);
  const [showCooldownToast, setShowCooldownToast] = useState(false);
  const cooldownToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Master switch: when false, popups never appear.
  // "Don't show again" sets this to false; Settings toggle re-enables it.
  const [interventionsEnabled, setInterventionsEnabled] = useState(true);

  // Cooldown: after user dismisses a popup (X), block new popups for this
  // many ms so we don't nag them. Cleared on unmount.
  const COOLDOWN_MS = 50_000;
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCoolingDownRef = useRef(false);

  const startCooldown = useCallback(() => {
    isCoolingDownRef.current = true;
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      isCoolingDownRef.current = false;
      cooldownTimerRef.current = null;
    }, COOLDOWN_MS);
  }, [COOLDOWN_MS]);

  // Display settings (lifted from RightPanel so ReadingView can apply them)
  const [textSize, setTextSize] = useState("medium");

  // Behavioral detection settings (lifted from RightPanel so detectors can read them)
  const [pauseThreshold, setPauseThreshold] = useState(5);
  const [pauseDetection, setPauseDetection] = useState(true);
  const [repeatedScrolling, setRepeatedScrolling] = useState(true);
  const [progressTracking, setProgressTracking] = useState(true);

  // Last detection signal — tells the popup which message to show
  const [lastSignal, setLastSignal] = useState<DetectionSignal | null>(null);

  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalChunks = state?.document?.chunks?.length ?? 0;

  // Ref to read the latest interventionsEnabled without re-creating the callback
  const interventionsEnabledRef = useRef(interventionsEnabled);
  interventionsEnabledRef.current = interventionsEnabled;

  const handleDetectionSignal = useCallback((signal: DetectionSignal) => {
    setLastSignal(signal);

    // Gate: master toggle must be on, popup must not be visible, cooldown must be over
    if (
      interventionsEnabledRef.current &&
      !isCoolingDownRef.current
    ) {
      setShowIntervention(true);
    }
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      if (cooldownToastTimerRef.current) clearTimeout(cooldownToastTimerRef.current);
    };
  }, []);

  const { handleUserActivity } = useBehavioralDetection({
    currentIndex,
    totalChunks,
    settings: {
      pauseDetectionEnabled: pauseDetection,
      repeatedScrollingEnabled: repeatedScrolling,
      progressTrackingEnabled: progressTracking,
      pauseThresholdSeconds: pauseThreshold,
    },
    onSignal: handleDetectionSignal,
  });

  useEffect(() => {
    if (!state || !state.document) {
      navigate("/", { replace: true });
    }
  }, [state, navigate]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    // When the user is at or near the top of the document, nothing should
    // be faded — the reading line logic would otherwise grey-out short
    // chunks (headings, first paragraphs) that naturally sit above the 35%
    // mark even though the user hasn't scrolled past them.
    const scrollTop = container.scrollTop;
    if (scrollTop < 80) {
      setCurrentIndex(0);
      handleUserActivity();
      return;
    }

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

    // Reset the pause timer on every scroll event
    handleUserActivity();
  }, [handleUserActivity]);

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

  // Reset pause timer on mouse/keyboard activity within the reading area
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onActivity = () => handleUserActivity();
    container.addEventListener("mousemove", onActivity);
    container.addEventListener("keydown", onActivity);
    return () => {
      container.removeEventListener("mousemove", onActivity);
      container.removeEventListener("keydown", onActivity);
    };
  }, [handleUserActivity]);

  if (!state || !state.document) return null;

  const { document: parsedDoc } = state;

  // Map the text-size setting to Tailwind classes
  const textSizeClasses: Record<string, { body: string; heading: string; table: string }> = {
    small:  { body: "text-xs",  heading: "text-sm font-semibold",  table: "text-[10px]" },
    medium: { body: "text-sm",  heading: "text-base font-semibold", table: "text-xs" },
    large:  { body: "text-base", heading: "text-lg font-semibold",  table: "text-sm" },
  };
  const sizeClass = textSizeClasses[textSize] ?? textSizeClasses.medium;

  // Use chunks for page tracking if available, fall back to elements.
  // This gives accurate page numbers once the chunker is wired in.
  const contentItems = parsedDoc.chunks?.length
    ? parsedDoc.chunks
    : parsedDoc.elements;

  const uniquePages = Array.from(
    new Set(contentItems.map((e) => e.page_number).filter(Boolean))
  );
  const totalPages = uniquePages.length || 1;

  const currentItem = contentItems[currentIndex];
  const currentPage = currentItem?.page_number ?? 1;

  // chunk_index of the item currently at the reading line, used by the RAG query.
  const currentChunkIndex = parsedDoc.chunks?.length
    ? (currentItem as DocumentChunk)?.chunk_index ?? currentIndex
    : currentIndex;

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
          className="flex-1 overflow-y-auto px-8 py-6 bg-slate-50 relative"
        >
          {/* Sticky page indicator + download — always visible as the user scrolls */}
          <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm pb-3 pt-1">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
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
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="space-y-4">
              {contentItems.map((item, index) => {
                const isPast = index < currentIndex;
                const text = item.text || (item as DocumentChunk).text;
                const elementType = item.element_type;

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
                    className={`leading-relaxed ${
                      elementType === "Title" || elementType === "heading"
                        ? `${sizeClass.heading} text-slate-900`
                        : elementType === "table"
                        ? ""
                        : `${sizeClass.body} text-slate-700`
                    }`}
                  >
                    {elementType === "table" ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <pre className={`${sizeClass.table} text-slate-600 p-4 whitespace-pre-wrap`}>
                          {text}
                        </pre>
                      </div>
                    ) : text ? (
                      text
                    ) : (
                      <span className="block w-full h-4 bg-slate-200 rounded-md" />
                    )}
                  </div>
                );
              })}

              <div className="h-[50vh]" />
            </div>
          </div>

          {showIntervention && (
            <InterventionPopup
              onClose={() => {
                // Just close this popup; next signal can re-show after cooldown
                setShowIntervention(false);
                startCooldown();
                // Show a brief toast so the user knows it'll come back later
                setShowCooldownToast(true);
                if (cooldownToastTimerRef.current) clearTimeout(cooldownToastTimerRef.current);
                cooldownToastTimerRef.current = setTimeout(() => {
                  setShowCooldownToast(false);
                  cooldownToastTimerRef.current = null;
                }, 4000);
              }}
              onNeverShowAgain={() => {
                // Permanently disable until user re-enables in Settings
                setShowIntervention(false);
                setInterventionsEnabled(false);
              }}
              onAccept={() => {
                // Open the AI panel and close the popup
                setShowIntervention(false);
                setIsPanelOpen(true);
                startCooldown();
              }}
              signalSource={lastSignal?.source}
            />
          )}

          {showCooldownToast && (
            <div className="fixed bottom-6 left-6 z-30 px-4 py-2 bg-slate-800/90 text-white text-xs rounded-full shadow-md animate-fade-in-out">
              Paused for 50s — you won't be interrupted for a bit
            </div>
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
                pauseThreshold={pauseThreshold}
                onPauseThresholdChange={setPauseThreshold}
                pauseDetection={pauseDetection}
                onPauseDetectionChange={setPauseDetection}
                repeatedScrolling={repeatedScrolling}
                onRepeatedScrollingChange={setRepeatedScrolling}
                progressTracking={progressTracking}
                onProgressTrackingChange={setProgressTracking}
                textSize={textSize}
                onTextSizeChange={setTextSize}
                interventionsEnabled={interventionsEnabled}
                onInterventionsEnabledChange={setInterventionsEnabled}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
