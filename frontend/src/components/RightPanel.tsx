import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

// Single chat message
interface Message {
  id: number;
  role: "ai" | "user";
  text: string;
}

// Everything ReadingView needs to pass into this panel
interface RightPanelProps {
  documentTitle: string;
  currentPage: number;
  totalPages: number;
  guidanceLevel: string;
  onGuidanceLevelChange: (level: string) => void;
  onClose: () => void;
}

// Welcome message before the user sends anything
const WELCOME_MESSAGE: Message = {
  id: 0,
  role: "ai",
  text: "Hi! I'm here to help you understand this document. Ask me anything about what you're reading, and I'll do my best to help.",
};

export default function RightPanel({
  documentTitle,
  currentPage,
  totalPages,
  guidanceLevel,
  onGuidanceLevelChange,
  onClose,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "settings">("chat");
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [pauseThreshold, setPauseThreshold] = useState(5);
  const [textSize, setTextSize] = useState("medium");

  // Behavioral signal toggles for the settings tab
  const [pauseDetection, setPauseDetection] = useState(true);
  const [repeatedScrolling, setRepeatedScrolling] = useState(true);
  const [progressTracking, setProgressTracking] = useState(true);

  // Invisible div at the bottom of the chat list
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    // Don't send if the input is empty or just whitespace
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Build the user's message object and add it to the list.
    // Date.now() gives us a unique number to use as the message id.
    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Placeholder AI response. In a future sprint this will call the Claude API
    // and pass currentPage and documentTitle as context.
    const aiPlaceholder: Message = {
      id: Date.now() + 1,
      role: "ai",
      text: `I'm reviewing page ${currentPage} of "${documentTitle}". Full AI responses will be wired up in the next sprint.`,
    };

    // setTimeout with 0ms delay pushes the AI response to the next render cycle
    // so the user's message appears first before the AI reply shows up.
    setTimeout(() => {
      setMessages((prev) => [...prev, aiPlaceholder]);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Let the user press Enter to send instead of clicking the button.
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    // The outer div takes up the full height of whatever container it's placed in.
    // The parent (ReadingView) controls the width by resizing the flex column.
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Panel header: AI Assistant label, current page, and close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-slate-900">
            AI Assistant
          </span>
          <span className="text-xs text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab bar: clicking a tab updates activeTab which controls what renders below */}
      <div className="flex border-b border-slate-100 shrink-0">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "chat"
              ? "text-indigo-600 border-b-2 border-indigo-500"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "settings"
              ? "text-indigo-600 border-b-2 border-indigo-500"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Settings
        </button>
      </div>

      {/* Tab body: conditionally renders chat or settings based on activeTab */}
      {activeTab === "chat" ? (
        <>
          {/* Message list: flex-1 means it takes all available vertical space,
              overflow-y-auto adds a scrollbar when messages overflow the height */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === "ai"
                    ? "bg-slate-100 text-slate-800 self-start"
                    : "bg-indigo-500 text-white self-end"
                }`}
              >
                {msg.text}
              </div>
            ))}
            {/* Invisible anchor at the bottom so useEffect can scroll here */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input row: stays pinned at the bottom because the message list above it
              uses flex-1 to absorb all leftover space */}
          <div className="flex gap-2 px-3 py-3 border-t border-slate-100 shrink-0">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this page..."
              className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 text-slate-800 placeholder:text-slate-400"
            />
            <button
              onClick={handleSend}
              className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm rounded-lg transition-colors"
            >
              Send
            </button>
          </div>
        </>
      ) : (
        // Settings tab body: scrollable list of controls
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
          {/* Guidance level dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Guidance level
            </label>
            <select
              value={guidanceLevel}
              onChange={(e) => onGuidanceLevelChange(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-indigo-300"
            >
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
            </select>
          </div>

          {/* Pause threshold slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Pause threshold
              </label>
              {/* The number next to the label updates live as the slider moves */}
              <span className="text-sm font-medium text-slate-700">
                {pauseThreshold}s
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={pauseThreshold}
              onChange={(e) => setPauseThreshold(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>1s</span>
              <span>30s</span>
            </div>
          </div>

          {/* Text size dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Text size
            </label>
            <select
              value={textSize}
              onChange={(e) => setTextSize(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-indigo-300"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          {/* Behavioral signals checkboxes */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Behavioral signals
            </label>

            {/* Each checkbox is a row with a label next to it.
                Clicking the label also toggles the checkbox because htmlFor matches the input id */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                id="pause-detection"
                type="checkbox"
                checked={pauseDetection}
                onChange={(e) => setPauseDetection(e.target.checked)}
                className="accent-indigo-500 w-4 h-4"
              />
              <span className="text-sm text-slate-700">Pause detection</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                id="repeated-scrolling"
                type="checkbox"
                checked={repeatedScrolling}
                onChange={(e) => setRepeatedScrolling(e.target.checked)}
                className="accent-indigo-500 w-4 h-4"
              />
              <span className="text-sm text-slate-700">Repeated scrolling</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                id="progress-tracking"
                type="checkbox"
                checked={progressTracking}
                onChange={(e) => setProgressTracking(e.target.checked)}
                className="accent-indigo-500 w-4 h-4"
              />
              <span className="text-sm text-slate-700">Progress tracking</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
