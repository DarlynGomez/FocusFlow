import { useState } from "react";
import ReactConfetti from "react-confetti";

interface AssessmentCardProps {
  question: string;
  idealAnswer: string;
  sessionId: string;
  chunkIndex: number;
  onResult: (result: "correct" | "incorrect") => void;
  onClose: () => void;
}

export default function AssessmentCard({
  question: initialQuestion,
  idealAnswer: initialIdealAnswer,
  sessionId,
  chunkIndex,
  onResult,
  onClose,
}: AssessmentCardProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [idealAnswer, setIdealAnswer] = useState(initialIdealAnswer);
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<
    "idle" | "loading" | "regenerating" | "correct" | "incorrect"
  >("idle");
  const [feedback, setFeedback] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleSubmit = async () => {
    if (!answer.trim() || phase === "loading") return;
    setPhase("loading");

    try {
      const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${BASE_URL}/api/documents/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          chunk_index: chunkIndex,
          question,
          ideal_answer: idealAnswer,
          student_answer: answer,
        }),
      });

      const data = await response.json();

      if (data.correct) {
        setPhase("correct");
        setFeedback(data.feedback || "Great understanding!");
        setShowConfetti(true);
        onResult("correct");
        setTimeout(() => setShowConfetti(false), 3500);
        // Fade away after a moment so the student sees the success state
        setTimeout(() => setDismissed(true), 3200);
      } else {
        setPhase("incorrect");
        setFeedback(data.feedback || "Not quite — try again.");
        onResult("incorrect");
      }
    } catch {
      setPhase("idle");
    }
  };

  const handleRedo = async () => {
    setPhase("regenerating");
    setAnswer("");
    setFeedback("");

    try {
      const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(
        `${BASE_URL}/api/documents/regenerate-question`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            chunk_index: chunkIndex,
            previous_question: question,
          }),
        }
      );
      const data = await response.json();
      setQuestion(data.question);
      setIdealAnswer(data.ideal_answer);
      setPhase("idle");
    } catch {
      setPhase("idle");
    }
  };

  if (dismissed) return null;

  return (
    <div
      className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3 transition-opacity duration-700"
      style={{ opacity: dismissed ? 0 : 1 }}
    >
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <ReactConfetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={220}
            gravity={0.25}
            colors={["#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff"]}
          />
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <span className="shrink-0 text-base">🧠</span>
          <p className="text-sm font-medium text-indigo-800 leading-snug">
            {phase === "regenerating"
              ? "Generating a new question..."
              : question}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-slate-300 hover:text-slate-500 text-lg leading-none transition-colors"
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Input phase */}
      {(phase === "idle" ||
        phase === "loading" ||
        phase === "regenerating") && (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here..."
            rows={3}
            disabled={phase === "regenerating"}
            className="w-full text-sm bg-white border border-indigo-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 text-slate-700 placeholder:text-slate-400 resize-none disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleRedo}
              disabled={phase !== "idle"}
              className="px-3 py-2 rounded-xl border border-indigo-200 text-indigo-500 text-xs font-medium hover:bg-indigo-100 disabled:opacity-40 transition-colors"
              title="Generate a different question"
            >
              ↺ Different question
            </button>
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || phase !== "idle"}
              className="flex-1 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              {phase === "loading" ? "Checking..." : "Submit ⌘↵"}
            </button>
          </div>
        </>
      )}

      {/* Correct phase */}
      {phase === "correct" && (
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-lg">
            ✓
          </div>
          <div>
            <p className="text-sm font-semibold text-green-700">Correct!</p>
            <p className="text-xs text-green-600 mt-0.5 leading-relaxed">
              {feedback}
            </p>
          </div>
        </div>
      )}

      {/* Incorrect phase */}
      {phase === "incorrect" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-base">
              💡
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-700">Not quite</p>
              <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
                {feedback}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-1.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                setPhase("idle");
                setAnswer("");
                setFeedback("");
              }}
              className="flex-1 py-1.5 rounded-xl border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-50 transition-colors"
            >
              ↺ Try again
            </button>
            <button
              onClick={handleRedo}
              className="flex-1 py-1.5 rounded-xl border border-indigo-200 text-indigo-600 text-xs font-medium hover:bg-indigo-50 transition-colors"
            >
              Different question
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
