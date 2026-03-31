import { useState, useEffect, useRef, useCallback } from "react";
import {
  MousePointer2,
  Highlighter,
  Underline,
  Strikethrough,
  Pencil,
  Square,
  Eraser,
  Bot,
  Copy,
  Check,
  Send,
  X,
  ChevronRight,
} from "lucide-react";

type ActiveTool =
  | "cursor"
  | "highlight"
  | "underline"
  | "strikethrough"
  | "draw"
  | "box"
  | "erase";

const HIGHLIGHT_COLORS = [
  { color: "#fef08a", label: "Yellow" },
  { color: "#bbf7d0", label: "Green" },
  { color: "#bfdbfe", label: "Blue" },
  { color: "#fecaca", label: "Pink" },
  { color: "#e9d5ff", label: "Purple" },
];

const DRAW_COLORS = [
  { color: "#1e293b", label: "Black" },
  { color: "#ef4444", label: "Red" },
  { color: "#6366f1", label: "Indigo" },
  { color: "#22c55e", label: "Green" },
  { color: "#f97316", label: "Orange" },
];

interface DrawingAnnotation {
  id: string;
  type: "draw" | "box";
  points: { x: number; y: number }[];
  color: string;
  scrollOffset: number;
  lineWidth: number;
}

interface SelectionPopupState {
  text: string;
  x: number;
  y: number;
  placement: "above" | "below";
}

type PopupMode = "toolbar" | "ask-ai" | "success";

interface ReadingToolbarProps {
  readingAreaRef: React.RefObject<HTMLDivElement | null>;
}

function SelectionPopup({
  popup,
  onDismiss,
}: {
  popup: SelectionPopupState;
  onDismiss: () => void;
}) {
  const [mode, setMode] = useState<PopupMode>("toolbar");
  const [aiQuestion, setAiQuestion] = useState("");
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const aiInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "ask-ai") setTimeout(() => aiInputRef.current?.focus(), 60);
  }, [mode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(popup.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleAskAI = () => {
    if (!aiQuestion.trim()) return;
    window.dispatchEvent(
      new CustomEvent("focusflow:ask-ai", {
        detail: { text: popup.text, question: aiQuestion.trim() },
      })
    );
    setSuccessMsg("Sent to AI");
    setMode("success");
    setTimeout(onDismiss, 900);
  };

  const handleHighlight = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.style.backgroundColor = "#fef08a";
    span.style.borderRadius = "2px";
    try {
      range.surroundContents(span);
    } catch {
      /* cross-node selection */
    }
    sel.removeAllRanges();
    onDismiss();
  };

  const truncated =
    popup.text.length > 80 ? popup.text.slice(0, 80) + "…" : popup.text;
  const width = mode === "ask-ai" ? 320 : 260;

  return (
    <div
      style={{
        position: "fixed",
        top: popup.y,
        left: popup.x,
        width,
        zIndex: 9999,
        transformOrigin: `center ${
          popup.placement === "above" ? "100%" : "0%"
        }`,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 ${
          popup.placement === "above"
            ? "bottom-[-6px] border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900"
            : "top-[-6px] border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-gray-900"
        }`}
      />

      <div className="bg-gray-900 rounded-xl shadow-2xl overflow-hidden text-white">
        {mode === "toolbar" && (
          <div className="flex items-center divide-x divide-white/10">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 h-10 hover:bg-white/10 transition-colors text-xs font-medium text-gray-200 hover:text-white whitespace-nowrap"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setMode("ask-ai")}
              className="flex items-center gap-1.5 px-3 h-10 bg-indigo-600 hover:bg-indigo-500 transition-colors text-xs font-medium text-white whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5" />
              Ask AI
              <ChevronRight className="w-3 h-3 opacity-60" />
            </button>
            <button
              onClick={handleHighlight}
              className="flex items-center gap-1.5 px-3 h-10 hover:bg-white/10 transition-colors text-xs font-medium text-gray-200 hover:text-white whitespace-nowrap"
            >
              <Highlighter className="w-3.5 h-3.5" />
              Highlight
            </button>
          </div>
        )}

        {mode === "ask-ai" && (
          <div>
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-semibold">Ask AI</span>
              </div>
              <button
                onClick={() => setMode("toolbar")}
                className="text-gray-400 hover:text-white p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mx-3 mb-2 px-2.5 py-2 rounded-lg bg-white/10 border-l-2 border-indigo-400">
              <p className="text-xs text-gray-300 italic leading-relaxed">
                "{truncated}"
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 pb-3">
              <input
                ref={aiInputRef}
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAskAI();
                  if (e.key === "Escape") setMode("toolbar");
                }}
                placeholder="Ask anything about this passage…"
                className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-400 outline-none focus:bg-white/15 focus:ring-1 focus:ring-indigo-400 transition-all"
              />
              <button
                onClick={handleAskAI}
                disabled={!aiQuestion.trim()}
                className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 flex items-center justify-center transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <div className="px-3 pb-3 flex flex-wrap gap-1.5">
              {["Explain this", "Summarise", "Simplify", "Give an example"].map(
                (q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setAiQuestion(q);
                      setTimeout(() => aiInputRef.current?.focus(), 10);
                    }}
                    className="text-[10px] px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                  >
                    {q}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {mode === "success" && (
          <div className="flex items-center gap-2 px-4 h-10">
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-xs font-medium text-green-400">
              {successMsg}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReadingToolbar({
  readingAreaRef,
}: ReadingToolbarProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>("cursor");
  const [activeColor, setActiveColor] = useState("#fef08a");
  const [drawings, setDrawings] = useState<DrawingAnnotation[]>([]);
  const [selectionPopup, setSelectionPopup] =
    useState<SelectionPopupState | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingsRef = useRef<DrawingAnnotation[]>([]);
  const activeToolRef = useRef<ActiveTool>("cursor");
  const activeColorRef = useRef(activeColor);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);
  const boxStartRef = useRef<{ x: number; y: number } | null>(null);
  const drawScrollOffsetRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Keep refs in sync
  useEffect(() => {
    drawingsRef.current = drawings;
  }, [drawings]);
  useEffect(() => {
    activeColorRef.current = activeColor;
  }, [activeColor]);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // Find scroll container
  useEffect(() => {
    const el = readingAreaRef.current?.closest(
      ".overflow-y-auto"
    ) as HTMLDivElement | null;
    scrollContainerRef.current = el;
  }, [readingAreaRef]);

  // ── redrawCanvas declared before any useEffect that calls it ──
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const ann of drawingsRef.current) {
      const yShift = ann.scrollOffset - scrollTop;
      ctx.strokeStyle = ann.color;
      ctx.lineWidth = ann.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.85;
      if (ann.type === "draw") {
        ctx.beginPath();
        ann.points.forEach((p, i) => {
          const y = p.y + yShift;
          if (i === 0) ctx.moveTo(p.x, y);
          else ctx.lineTo(p.x, y);
        });
        ctx.stroke();
      } else if (ann.type === "box" && ann.points.length === 2) {
        const [s, e] = ann.points;
        ctx.strokeRect(s.x, s.y + yShift, e.x - s.x, e.y - s.y);
      }
      ctx.globalAlpha = 1;
    }
  }, []);

  // ── handleErase declared before the useEffect that calls it ──
  const handleErase = useCallback((clientX: number, clientY: number) => {
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    let closestId: string | null = null;
    let closestDist = 24;
    for (const ann of drawingsRef.current) {
      const yShift = ann.scrollOffset - scrollTop;
      for (const pt of ann.points) {
        const dist = Math.hypot(clientX - pt.x, clientY - (pt.y + yShift));
        if (dist < closestDist) {
          closestDist = dist;
          closestId = ann.id;
        }
      }
    }
    if (closestId) {
      setDrawings((prev) => prev.filter((d) => d.id !== closestId));
    }
  }, []);

  // Canvas setup -- now safely after redrawCanvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redrawCanvas();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [drawings, redrawCanvas]);

  // Canvas scroll sync
  useEffect(() => {
    const sc = scrollContainerRef.current;
    if (!sc) return;
    const onScroll = () => redrawCanvas();
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => sc.removeEventListener("scroll", onScroll);
  }, [redrawCanvas]);

  // Canvas mouse events -- now safely after handleErase and redrawCanvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      scrollContainerRef.current?.scrollBy({ top: e.deltaY, behavior: "auto" });
    };

    const onMouseDown = (e: MouseEvent) => {
      const tool = activeToolRef.current;
      if (tool === "erase") {
        handleErase(e.clientX, e.clientY);
        return;
      }
      if (tool !== "draw" && tool !== "box") return;
      isDrawingRef.current = true;
      drawScrollOffsetRef.current = scrollContainerRef.current?.scrollTop ?? 0;
      if (tool === "draw")
        currentPointsRef.current = [{ x: e.clientX, y: e.clientY }];
      else if (tool === "box")
        boxStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      const tool = activeToolRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (tool === "draw") {
        currentPointsRef.current.push({ x: e.clientX, y: e.clientY });
        redrawCanvas();
        const pts = currentPointsRef.current;
        ctx.strokeStyle = activeColorRef.current;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        pts.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (tool === "box" && boxStartRef.current) {
        redrawCanvas();
        const s = boxStartRef.current;
        ctx.strokeStyle = activeColorRef.current;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.85;
        ctx.strokeRect(s.x, s.y, e.clientX - s.x, e.clientY - s.y);
        ctx.globalAlpha = 1;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const tool = activeToolRef.current;
      const scrollOffset = drawScrollOffsetRef.current;
      if (tool === "draw" && currentPointsRef.current.length > 1) {
        setDrawings((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "draw",
            points: [...currentPointsRef.current],
            color: activeColorRef.current,
            scrollOffset,
            lineWidth: 2.5,
          },
        ]);
        currentPointsRef.current = [];
      } else if (tool === "box" && boxStartRef.current) {
        setDrawings((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "box",
            points: [boxStartRef.current!, { x: e.clientX, y: e.clientY }],
            color: activeColorRef.current,
            scrollOffset,
            lineWidth: 2,
          },
        ]);
        boxStartRef.current = null;
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
    };
  }, [redrawCanvas, handleErase]);

  // Text annotation
  useEffect(() => {
    const content = readingAreaRef.current;
    if (!content) return;
    const TEXT_TOOLS: ActiveTool[] = [
      "highlight",
      "underline",
      "strikethrough",
    ];

    const applyAnnotation = () => {
      if (!TEXT_TOOLS.includes(activeToolRef.current)) return;
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || !selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!content.contains(range.commonAncestorContainer)) return;
      const tool = activeToolRef.current;
      const color = activeColorRef.current;

      const applySpan = (span: HTMLSpanElement) => {
        if (tool === "highlight") {
          span.style.backgroundColor = color;
          span.style.borderRadius = "2px";
          span.style.padding = "0 1px";
        } else if (tool === "underline") {
          span.style.textDecoration = "underline";
          span.style.textDecorationColor = color;
          span.style.textDecorationThickness = "2px";
          span.style.textUnderlineOffset = "2px";
        } else if (tool === "strikethrough") {
          span.style.textDecoration = "line-through";
          span.style.textDecorationColor = color;
          span.style.textDecorationThickness = "2px";
        }
      };

      try {
        const span = document.createElement("span");
        applySpan(span);
        range.surroundContents(span);
        selection.removeAllRanges();
      } catch {
        try {
          const fragment = range.extractContents();
          const span = document.createElement("span");
          applySpan(span);
          span.appendChild(fragment);
          range.insertNode(span);
          selection.removeAllRanges();
        } catch {
          /* cross-element edge case */
        }
      }
    };

    content.addEventListener("mouseup", applyAnnotation);
    return () => content.removeEventListener("mouseup", applyAnnotation);
  }, [readingAreaRef]);

  // Selection popup
  useEffect(() => {
    const handleMouseUp = () => {
      if (activeToolRef.current !== "cursor") return;
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (!text || text.length < 2 || !selection || !selection.rangeCount) {
          setSelectionPopup(null);
          return;
        }
        const range = selection.getRangeAt(0);
        if (!readingAreaRef.current?.contains(range.commonAncestorContainer)) {
          setSelectionPopup(null);
          return;
        }
        const rect = range.getBoundingClientRect();
        const popupW = 260;
        const margin = 12;
        let x = rect.left + rect.width / 2 - popupW / 2;
        x = Math.max(margin, Math.min(window.innerWidth - popupW - margin, x));
        let y: number;
        let placement: "above" | "below" = "above";
        if (rect.top - 60 > 60) {
          y = rect.top - 60;
        } else {
          y = rect.bottom + margin;
          placement = "below";
        }
        setSelectionPopup({ text, x, y, placement });
      }, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const popupEl = document.getElementById("selection-popup-root");
      if (popupEl && !popupEl.contains(e.target as Node)) {
        setTimeout(() => {
          if (!window.getSelection()?.toString().trim())
            setSelectionPopup(null);
        }, 20);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [readingAreaRef]);

  const handleToolClick = (id: ActiveTool) => {
    setActiveTool(activeTool === id ? "cursor" : id);
  };

  const isDrawTool = activeTool === "draw" || activeTool === "box";
  const isTextTool =
    activeTool === "highlight" ||
    activeTool === "underline" ||
    activeTool === "strikethrough";
  const showColorPicker = isDrawTool || isTextTool;
  const colors = isDrawTool ? DRAW_COLORS : HIGHLIGHT_COLORS;
  const canvasActive =
    activeTool === "draw" || activeTool === "box" || activeTool === "erase";

  const TOOL_GROUPS = [
    [{ id: "cursor" as ActiveTool, Icon: MousePointer2, label: "Select" }],
    [
      { id: "highlight" as ActiveTool, Icon: Highlighter, label: "Highlight" },
      { id: "underline" as ActiveTool, Icon: Underline, label: "Underline" },
      {
        id: "strikethrough" as ActiveTool,
        Icon: Strikethrough,
        label: "Strikethrough",
      },
    ],
    [
      { id: "draw" as ActiveTool, Icon: Pencil, label: "Draw" },
      { id: "box" as ActiveTool, Icon: Square, label: "Box" },
      { id: "erase" as ActiveTool, Icon: Eraser, label: "Erase" },
    ],
  ];

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 20,
          pointerEvents: canvasActive ? "auto" : "none",
        }}
      />

      {selectionPopup && (
        <div id="selection-popup-root">
          <SelectionPopup
            popup={selectionPopup}
            onDismiss={() => setSelectionPopup(null)}
          />
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none select-none">
        {showColorPicker && (
          <div className="pointer-events-auto flex items-center gap-2 bg-white rounded-xl shadow-lg border border-slate-200 px-3.5 py-2.5">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mr-0.5">
              Color
            </span>
            {colors.map(({ color, label }) => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                title={label}
                style={{ backgroundColor: color }}
                className="relative w-5 h-5 rounded-full transition-transform hover:scale-125 shrink-0"
              >
                {activeColor === color && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-offset-1 ring-slate-700" />
                )}
              </button>
            ))}
          </div>
        )}

        {activeTool === "erase" && drawings.length > 0 && (
          <button
            onClick={() => setDrawings([])}
            className="pointer-events-auto flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow text-xs text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
          >
            <Eraser className="w-3 h-3" />
            Clear all {drawings.length} drawing
            {drawings.length !== 1 ? "s" : ""}
          </button>
        )}

        <div className="pointer-events-auto flex items-center bg-white rounded-2xl shadow-xl border border-slate-200 px-2.5 py-2 gap-0.5">
          {TOOL_GROUPS.map((group, gi) => (
            <div key={gi} className="flex items-center">
              {gi > 0 && <div className="w-px h-6 bg-slate-200 mx-1.5" />}
              {group.map(({ id, Icon, label }) => {
                const isActive = activeTool === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleToolClick(id)}
                    title={label}
                    className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {isActive && (isTextTool || isDrawTool) && (
                      <span
                        className="absolute bottom-[5px] right-[5px] w-1.5 h-1.5 rounded-full ring-1 ring-white/80"
                        style={{ backgroundColor: activeColor }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
