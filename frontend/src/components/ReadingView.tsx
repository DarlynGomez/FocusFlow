import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

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

  useEffect(() => {
    if (!state || !state.document) {
      navigate("/", { replace: true });
    }
  }, [state, navigate]);

  if (!state || !state.document) {
    return null;
  }
  const { document, guidanceLevel } = state;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        {/* Document header */}
        <div className="mb-6 pb-4 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">
            {document.filename}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {document.total_elements} sections extracted using{" "}
            <span className="font-medium">
              {document.classification.parser_used}
            </span>{" "}
            parser
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Guidance level:{" "}
            <span className="font-medium capitalize">{guidanceLevel}</span>
          </p>
        </div>

        {/* Render each extracted text element as a paragraph */}
        <div className="space-y-4">
          {document.elements.map((element, index) => (
            <div key={index} className="text-sm text-slate-700 leading-relaxed">
              {element.text}
            </div>
          ))}
        </div>

        {/* Back button */}
        <div className="mt-8 pt-4 border-t border-slate-100">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-indigo-500 hover:text-indigo-600 underline"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
