import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useCallback, useState } from "react";
import {
  MessageCircle,
  X,
  Lightbulb,
  Download,
  Bookmark,
  BookOpen,
} from "lucide-react";
import RightPanel from "./RightPanel";
import {
  useBehavioralDetection,
  type DetectionSignal,
} from "../hooks/useBehavioralDetection";
import ChunkRenderer from "./ChunkRenderer";
import BookmarksPanel from "./BookmarksPanel";
import ReadingToolbar from "./ReadingToolbar";
import { useBookmarks } from "../hooks/useBookmarks";

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
  element_type:
    | "heading"
    | "table"
    | "text"
    | "image"
    | "Title"
    | "caption"
    | "citation";
  char_count: number;
  is_section_start: boolean;
  image_data?: string;
  image_width?: number;
  image_height?: number;
  key_idea?: string;
  why_it_matters?: string;
  estimated_read_time_seconds?: number;
  rendered_html?: string;
  assessment_question?: string;
  assessment_answer?: string;
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

const SIGNAL_MESSAGES: Record<string, { heading: string; subtext: string }> = {
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
  const msg =
    (signalSource && SIGNAL_MESSAGES[signalSource]) || DEFAULT_SIGNAL_MESSAGE;

  return (
    <div className="z-20 w-full max-w-sm bg-white/95 backdrop-blur border border-indigo-200 rounded-2xl shadow-lg shadow-indigo-100 p-4 flex flex-col gap-3 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
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
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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

  // ── All hooks must be declared before any conditional return ──
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [interventionTrigger, setInterventionTrigger] = useState<{
    chunkIndex: number;
    signal: string;
    timestamp: number;
  } | null>(null);
  const [guidanceLevel, setGuidanceLevel] = useState(
    state?.guidanceLevel ?? "medium"
  );
  const [panelWidth, setPanelWidth] = useState(360);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showIntervention, setShowIntervention] = useState(false);
  const [bookmarksPanelOpen, setBookmarksPanelOpen] = useState(false);
  const [assessmentsEnabled, setAssessmentsEnabled] = useState(true);

  const chunkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const readingContentRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Behavioral detection state ──
  const [showCooldownToast, setShowCooldownToast] = useState(false);
  const cooldownToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  type SectionState =
    | "unread"
    | "reading"
    | "assessed-correct"
    | "assessed-incorrect"
    | "struggled";

  const [_sectionStates, setSectionStates] = useState<
    Record<number, SectionState>
  >({});

  // Master switch: when false, popups never appear.
  // "Don't show again" sets this to false; Settings toggle re-enables it.
  const [interventionsEnabled, setInterventionsEnabled] = useState(true);

  // Cooldown: after user dismisses a popup (X), block new popups for this
  // many ms so we don't nag them. Cleared on unmount.
  const COOLDOWN_MS = 50_000;
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCoolingDownRef = useRef(false);

  // Display settings (lifted from RightPanel so ReadingView can apply them)
  const [textSize, setTextSize] = useState("medium");

  // Behavioral detection settings (lifted from RightPanel so detectors can read them)
  const [pauseThreshold, setPauseThreshold] = useState(5);
  const [pauseDetection, setPauseDetection] = useState(true);
  const [repeatedScrolling, setRepeatedScrolling] = useState(true);
  const [progressTracking, setProgressTracking] = useState(true);
  const [lastSignal, setLastSignal] = useState<DetectionSignal | null>(null);
  const [popupSignal, setPopupSignal] = useState<DetectionSignal | null>(null);
  const [popupAnchorTop, setPopupAnchorTop] = useState<number | null>(null);

  const updateSectionState = useCallback(
    (chunkIndex: number, state: SectionState) => {
      setSectionStates((prev) => ({ ...prev, [chunkIndex]: state }));
    },
    []
  );

  // Last detection signal — tells the popup which message to show
  const contentItems = state?.document
    ? state.document.chunks?.length
      ? state.document.chunks
      : state.document.elements
    : [];
  const readingItemsWithIndex = contentItems
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => (item as DocumentChunk).element_type !== "citation");
  const totalChunks = readingItemsWithIndex.length;
  const boundedDetectionIndex =
    totalChunks > 0 ? Math.max(0, Math.min(currentIndex, totalChunks - 1)) : 0;

  // Ref to read the latest interventionsEnabled without re-creating the callback
  const interventionsEnabledRef = useRef(interventionsEnabled);
  const showInterventionRef = useRef(showIntervention);
  const currentDetectionIndexRef = useRef(boundedDetectionIndex);
  const pendingSignalRef = useRef<DetectionSignal | null>(null);

  const showSignalPopup = (signal: DetectionSignal) => {
    setPopupSignal(signal);
    setShowIntervention(true);
  };

  useEffect(() => {
    interventionsEnabledRef.current = interventionsEnabled;
    showInterventionRef.current = showIntervention;
    currentDetectionIndexRef.current = boundedDetectionIndex;
  }, [boundedDetectionIndex, interventionsEnabled, showIntervention]);

  const isSignalRelevant = (signal: DetectionSignal) => {
    return Math.abs(signal.chunkIndex - currentDetectionIndexRef.current) <= 1;
  };

  const handleDetectionSignal = (signal: DetectionSignal) => {
    setLastSignal(signal);

    if (!interventionsEnabledRef.current) return;

    if (isCoolingDownRef.current) {
      pendingSignalRef.current = signal;
      return;
    }

    if (!showInterventionRef.current) {
      showSignalPopup(signal);
    }
  };

  const startCooldown = () => {
    pendingSignalRef.current = null;
    isCoolingDownRef.current = true;
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      isCoolingDownRef.current = false;
      cooldownTimerRef.current = null;

      const pendingSignal = pendingSignalRef.current;
      pendingSignalRef.current = null;

      if (
        pendingSignal &&
        interventionsEnabledRef.current &&
        !showInterventionRef.current &&
        isSignalRelevant(pendingSignal)
      ) {
        showSignalPopup(pendingSignal);
      }
    }, COOLDOWN_MS);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      if (cooldownToastTimerRef.current)
        clearTimeout(cooldownToastTimerRef.current);
      pendingSignalRef.current = null;
    };
  }, []);

  const handleInterventionsEnabledChange = (value: boolean) => {
    setInterventionsEnabled(value);
    if (!value) {
      pendingSignalRef.current = null;
      isCoolingDownRef.current = false;
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      setShowIntervention(false);
      setPopupSignal(null);
    }
  };

  useEffect(() => {
    if (!showIntervention || popupSignal == null) return;

    let frameId = 0;
    const updatePopupAnchor = () => {
      const targetEl = chunkRefs.current[popupSignal.chunkIndex];
      if (!targetEl) {
        frameId = window.requestAnimationFrame(() => {
          setPopupAnchorTop(null);
        });
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        setPopupAnchorTop(Math.max(0, targetEl.offsetTop + 16));
      });
    };

    updatePopupAnchor();
    window.addEventListener("resize", updatePopupAnchor);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePopupAnchor);
    };
  }, [isPanelOpen, popupSignal, showIntervention, textSize]);

  const { handleUserActivity } = useBehavioralDetection({
    currentIndex: boundedDetectionIndex,
    totalChunks,
    settings: {
      pauseDetectionEnabled: pauseDetection,
      repeatedScrollingEnabled: repeatedScrolling,
      progressTrackingEnabled: progressTracking,
      pauseThresholdSeconds: pauseThreshold,
    },
    onSignal: handleDetectionSignal,
  });

  // Bookmarks hook -- session_id may be undefined if state is null,
  // but the hook is always called; it just operates on an empty string.
  const { bookmarks, addBookmark, deleteBookmark, isBookmarked } = useBookmarks(
    state?.document?.session_id ?? ""
  );

  const jumpToChunk = (chunkIndex: number) => {
    const displayIndex = readingItemsWithIndex.findIndex(
      ({ originalIndex }) => originalIndex === chunkIndex
    );
    const el = displayIndex >= 0 ? chunkRefs.current[displayIndex] : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!state || !state.document) {
      navigate("/", { replace: true });
    }
  }, [state, navigate]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    // When the user is at or near the top of the document, nothing should
    // be faded — the reading line logic would otherwise grey-out short
    // chunks (headings, first paragraphs) that naturally sit above the 35%
    // mark even though the user hasn't scrolled past them.
    const scrollTop = container.scrollTop;
    if (scrollTop < 80) {
      setCurrentIndex(0);
      handleUserActivity("scroll");
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const readingLine = containerTop + container.clientHeight * 0.35;
    let newIndex = 0;
    for (let i = 0; i < readingItemsWithIndex.length; i++) {
      const el = chunkRefs.current[i];
      if (!el) continue;
      if (el.getBoundingClientRect().bottom < readingLine) newIndex = i + 1;
    }
    setCurrentIndex(newIndex);

    // Mark the section the reader just entered as reading
    const currentChunk = readingItemsWithIndex[newIndex]?.item as DocumentChunk;
    if (currentChunk?.element_type === "heading") {
      setSectionStates((prev) => ({
        ...prev,
        [newIndex]:
          prev[newIndex] === "assessed-correct"
            ? "assessed-correct"
            : "reading",
      }));
    }

    // Reset the pause timer on every scroll event
    handleUserActivity("scroll");
  };

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

  // Reset the pause timer only for deliberate reading actions.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onPointerActivity = () => handleUserActivity("pointer");
    const onWheelActivity = () => handleUserActivity("scroll");
    const onTouchActivity = () => handleUserActivity("touch");

    container.addEventListener("pointerdown", onPointerActivity);
    container.addEventListener("wheel", onWheelActivity, { passive: true });
    container.addEventListener("touchstart", onTouchActivity, {
      passive: true,
    });
    return () => {
      container.removeEventListener("pointerdown", onPointerActivity);
      container.removeEventListener("wheel", onWheelActivity);
      container.removeEventListener("touchstart", onTouchActivity);
    };
  }, [handleUserActivity]);

  // ── Guard -- render nothing until state is confirmed present ──
  if (!state || !state.document) return null;

  const { document: parsedDoc } = state;

  // Map the text-size setting to Tailwind classes
  // const textSizeClasses: Record<
  //   string,
  //   { body: string; heading: string; table: string }
  // > = {
  //   small: {
  //     body: "text-xs",
  //     heading: "text-sm font-semibold",
  //     table: "text-[10px]",
  //   },
  //   medium: {
  //     body: "text-sm",
  //     heading: "text-base font-semibold",
  //     table: "text-xs",
  //   },
  //   large: {
  //     body: "text-base",
  //     heading: "text-lg font-semibold",
  //     table: "text-sm",
  //   },
  // };

  const boundedCurrentIndex =
    readingItemsWithIndex.length > 0
      ? Math.max(0, Math.min(currentIndex, readingItemsWithIndex.length - 1))
      : 0;

  const currentItem = readingItemsWithIndex[boundedCurrentIndex]?.item;

  const currentChunkIndex = parsedDoc.chunks?.length
    ? (currentItem as DocumentChunk)?.chunk_index ?? boundedCurrentIndex
    : boundedCurrentIndex;

  const currentPage =
    (currentItem as DocumentChunk | undefined)?.page_number ?? 1;

  const totalPages = contentItems.reduce((max, item) => {
    const page = (item as DocumentChunk).page_number ?? 1;
    return page > max ? page : max;
  }, 1);

  const citationChunks = contentItems.filter(
    (item) => (item as DocumentChunk).element_type === "citation"
  );

  const nonCitationItemsWithIndex = readingItemsWithIndex;

  const handleDownload = () => {
    const chunkToHtml = (chunk: DocumentChunk): string => {
      const et = chunk.element_type;
      const text = chunk.text ?? "";
      if (et === "image") return "";
      if (et === "heading" || et === "Title")
        return `<h2 style="font-size:16px;font-weight:700;margin:32px 0 8px;">${text}</h2>`;
      if (et === "table") {
        if (chunk.rendered_html)
          return `<div style="margin:16px 0;">${chunk.rendered_html}</div>`;
        return `<pre style="font-size:12px;background:#f8f8f8;padding:12px;border-radius:6px;overflow-x:auto;">${text}</pre>`;
      }
      if (et === "caption")
        return `<p style="font-size:12px;color:#666;font-style:italic;margin:4px 0 16px;padding-left:12px;border-left:2px solid #ddd;">${text}</p>`;
      if (et === "citation")
        return `<p style="font-size:11px;color:#888;font-family:monospace;margin:4px 0;">${text}</p>`;
      return `<p style="font-size:14px;line-height:1.7;margin:0 0 12px;color:#333;">${text}</p>`;
    };

    const bodyItems = contentItems.filter(
      (item) => (item as DocumentChunk).element_type !== "citation"
    );
    const citationItems = contentItems.filter(
      (item) => (item as DocumentChunk).element_type === "citation"
    );
    const bodyHtml = bodyItems
      .map((item) => chunkToHtml(item as DocumentChunk))
      .join("\n");
    const citationsHtml =
      citationItems.length > 0
        ? `<hr style="margin:32px 0;border:none;border-top:1px solid #ddd;" />
           <h3 style="font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">References</h3>
           ${citationItems
             .map((item) => chunkToHtml(item as DocumentChunk))
             .join("\n")}`
        : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${parsedDoc.filename.replace(/\.pdf$/i, "")}</title>
  <style>
    body { max-width: 720px; margin: 48px auto; font-family: Georgia, serif; color: #1a1a1a; padding: 0 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #ddd; }
    td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #eee; }
  </style>
</head>
<body>
  <h1 style="font-size:22px;font-weight:700;text-align:center;margin-bottom:8px;">
    ${parsedDoc.filename.replace(/\.pdf$/i, "")}
  </h1>
  <p style="text-align:center;font-size:12px;color:#999;margin-bottom:40px;">
    ${parsedDoc.classification.parser_used} parser · ${guidanceLevel} guidance
  </p>
  ${bodyHtml}
  ${citationsHtml}
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = parsedDoc.filename.replace(/\.pdf$/i, "") + ".html";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-88px)]">
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-visible bg-slate-100 relative"
        >
          {/* Sticky bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-2 bg-white border-b border-slate-200">
            <span className="text-xs text-slate-400">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBookmarksPanelOpen(true)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Bookmarks
                {bookmarks.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {bookmarks.length > 9 ? "9+" : bookmarks.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>
          {/* Document body */}
          <div
            ref={readingContentRef}
            className="relative bg-white max-w-2xl mx-auto px-10 py-8 min-h-full"
            style={{
              fontSize:
                textSize === "small"
                  ? "0.75rem"
                  : textSize === "large"
                  ? "1rem"
                  : "0.875rem",
            }}
          >
            {/* Document header */}
            <div className="text-center mb-8 pb-6 border-b border-slate-100">
              <h1 className="text-lg font-semibold text-slate-900 leading-snug mb-2">
                {parsedDoc.filename.replace(/\.pdf$/i, "")}
              </h1>
              <p className="text-xs text-slate-400">
                {parsedDoc.classification.parser_used} parser ·{" "}
                <span className="capitalize">{guidanceLevel}</span> guidance ·{" "}
                {parsedDoc.total_chunks} sections
              </p>
            </div>

            {/* Chunks */}
            <div className="space-y-3">
              {nonCitationItemsWithIndex.map(
                ({ item, originalIndex }, displayIndex) => {
                  const isPast = displayIndex < currentIndex;
                  const isInterventionTarget =
                    showIntervention &&
                    popupSignal?.chunkIndex === displayIndex;
                  const chunk = item as DocumentChunk;
                  const bookmarked = isBookmarked(originalIndex);

                  return (
                    <div
                      key={originalIndex}
                      ref={(el) => {
                        chunkRefs.current[displayIndex] = el;
                      }}
                      style={{
                        opacity: isPast ? 0.55 : 1,
                        transition: "opacity 0.5s ease",
                      }}
                      className="relative group/chunk transition-all duration-300"
                    >
                      <div
                        className={`relative rounded-2xl transition-all duration-300 ${
                          isInterventionTarget
                            ? "bg-indigo-50/70 ring-2 ring-indigo-200 shadow-[0_0_0_1px_rgba(99,102,241,0.08)] px-4 py-4"
                            : ""
                        }`}
                      >
                        <button
                          onClick={() =>
                            bookmarked
                              ? deleteBookmark(
                                  bookmarks.find(
                                    (b) => b.chunkIndex === originalIndex
                                  )?.id ?? ""
                                )
                              : addBookmark(
                                  originalIndex,
                                  chunk.page_number,
                                  chunk.text,
                                  `Page ${
                                    chunk.page_number ?? originalIndex + 1
                                  }`
                                )
                          }
                          className={`absolute -left-7 top-1 p-1 rounded transition-all ${
                            bookmarked
                              ? "text-indigo-500 opacity-100"
                              : "text-slate-300 opacity-0 group-hover/chunk:opacity-100 hover:text-indigo-400"
                          }`}
                          title={
                            bookmarked
                              ? "Remove bookmark"
                              : "Bookmark this position"
                          }
                        >
                          <Bookmark
                            className={`w-3.5 h-3.5 ${
                              bookmarked ? "fill-indigo-500" : ""
                            }`}
                          />
                        </button>

                        <ChunkRenderer
                          elementType={chunk.element_type}
                          text={chunk.text}
                          imageData={chunk.image_data}
                          pageNumber={chunk.page_number}
                          keyIdea={chunk.key_idea}
                          whyItMatters={chunk.why_it_matters}
                          renderedHtml={chunk.rendered_html}
                          estimatedReadTime={chunk.estimated_read_time_seconds}
                          assessmentQuestion={chunk.assessment_question}
                          assessmentAnswer={chunk.assessment_answer}
                          sessionId={parsedDoc.session_id}
                          chunkIndex={displayIndex}
                          onAssessmentResult={(result) => {
                            updateSectionState(
                              displayIndex,
                              result === "correct"
                                ? "assessed-correct"
                                : "assessed-incorrect"
                            );
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {/* References */}
            {citationChunks.length > 0 && (
              <div className="mt-10 pt-6 border-t border-slate-200">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  References
                </h3>
                <div className="space-y-1.5">
                  {citationChunks.map((item, i) => {
                    const chunk = item as DocumentChunk;
                    return (
                      <p
                        key={i}
                        className="text-xs text-slate-400 leading-relaxed select-text font-mono"
                      >
                        {chunk.text}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            {showIntervention && popupAnchorTop !== null && (
              <div
                className="hidden lg:block absolute left-[calc(100%+1.75rem)] w-80 z-20"
                style={{ top: popupAnchorTop }}
              >
                <InterventionPopup
                  onClose={() => {
                    // Just close this popup; next signal can re-show after cooldown
                    setShowIntervention(false);
                    setPopupSignal(null);
                    startCooldown();
                    // Show a brief toast so the user knows it'll come back later
                    setShowCooldownToast(true);
                    if (cooldownToastTimerRef.current)
                      clearTimeout(cooldownToastTimerRef.current);
                    cooldownToastTimerRef.current = setTimeout(() => {
                      setShowCooldownToast(false);
                      cooldownToastTimerRef.current = null;
                    }, 4000);
                  }}
                  onNeverShowAgain={() => {
                    // Permanently disable until user re-enables in Settings
                    handleInterventionsEnabledChange(false);
                  }}
                  onAccept={() => {
                    console.log(
                      "onAccept fired, session_id:",
                      parsedDoc.session_id,
                      "trigger chunk:",
                      boundedDetectionIndex
                    );
                    setShowIntervention(false);
                    setPopupSignal(null);
                    setIsPanelOpen(true);
                    startCooldown();
                    setInterventionTrigger({
                      chunkIndex: boundedDetectionIndex,
                      signal: popupSignal?.source ?? "pause",
                      timestamp: Date.now(),
                    });
                  }}
                  signalSource={popupSignal?.source}
                />
              </div>
            )}

            {showIntervention && popupAnchorTop !== null && (
              <div className="mt-4 lg:hidden">
                <InterventionPopup
                  onClose={() => {
                    // Just close this popup; next signal can re-show after cooldown
                    setShowIntervention(false);
                    setPopupSignal(null);
                    startCooldown();
                    // Show a brief toast so the user knows it'll come back later
                    setShowCooldownToast(true);
                    if (cooldownToastTimerRef.current)
                      clearTimeout(cooldownToastTimerRef.current);
                    cooldownToastTimerRef.current = setTimeout(() => {
                      setShowCooldownToast(false);
                      cooldownToastTimerRef.current = null;
                    }, 4000);
                  }}
                  onNeverShowAgain={() => {
                    // Permanently disable until user re-enables in Settings
                    handleInterventionsEnabledChange(false);
                  }}
                  onAccept={() => {
                    console.log(
                      "onAccept fired, session_id:",
                      parsedDoc.session_id,
                      "trigger chunk:",
                      boundedDetectionIndex
                    );
                    setShowIntervention(false);
                    setPopupSignal(null);
                    setIsPanelOpen(true);
                    startCooldown();
                    setInterventionTrigger({
                      chunkIndex: boundedDetectionIndex,
                      signal: popupSignal?.source ?? "pause",
                      timestamp: Date.now(),
                    });
                  }}
                  signalSource={popupSignal?.source}
                />
              </div>
            )}

            <div className="h-24" />
          </div>
          {showCooldownToast && (
            <div className="fixed bottom-6 left-6 z-30 px-4 py-2 bg-slate-800/90 text-white text-xs rounded-full shadow-md animate-fade-in-out">
              Paused for 50s — you won't be interrupted for a bit
            </div>
          )}
          {!isPanelOpen && (
            <button
              onClick={() => setIsPanelOpen(true)}
              className="fixed bottom-20 right-6 z-10 w-12 h-12 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-200 flex items-center justify-center transition-colors"
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
                onInterventionsEnabledChange={handleInterventionsEnabledChange}
                lastDetectionSignal={lastSignal}
                interventionTrigger={interventionTrigger}
                onInterventionTriggerConsumed={() =>
                  setInterventionTrigger(null)
                }
                assessmentsEnabled={assessmentsEnabled}
                onAssessmentsEnabledChange={setAssessmentsEnabled}
              />
            </div>
          </>
        )}

        <BookmarksPanel
          isOpen={bookmarksPanelOpen}
          onClose={() => setBookmarksPanelOpen(false)}
          bookmarks={bookmarks}
          onJump={jumpToChunk}
          onDelete={deleteBookmark}
        />
      </div>

      {/* Toolbar -- fixed to bottom, sits above the AI button */}
      <ReadingToolbar readingAreaRef={readingContentRef} />
    </div>
  );
}
