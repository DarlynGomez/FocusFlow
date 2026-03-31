import { useState } from "react";
import {
  saveDocument,
  saveDocumentData,
  saveFileData,
} from "../utils/documentStorage";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import Header from "./Header";
import GuidanceOption from "./GuidanceOption";
import FileUploader from "./FileUploader";

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
  title?: string;
  key_idea?: string;
  why_it_matters?: string;
  estimated_read_time_seconds?: number;
  rendered_html?: string;
}

interface ParsedDocument {
  filename: string;
  total_elements: number;
  total_chunks: number;
  session_id: string;
  elements: {
    text: string;
    element_type: string;
    page_number: number | null;
    char_count: number;
  }[];
  chunks: DocumentChunk[];
  classification: {
    parser_used: string;
    routing_reasons: string[];
    signals: Record<string, unknown>;
  };
  low_text_warning: boolean;
  warning_message: string | null;
}

export default function UploadSetupView() {
  const navigate = useNavigate();
  const [guidanceLevel, setGuidanceLevel] = useState("medium");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Stores the parsed document after a successful upload
  const [parsedDocument, setParsedDocument] = useState<ParsedDocument | null>(
    null
  );

  // Stores a non fatal warning from the backend
  const [backendWarning, setBackendWarning] = useState<string | null>(null);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleStartReading = async () => {
    if (!file) {
      setUploadError("Please upload a PDF document first.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setBackendWarning(null);
    setParsedDocument(null);

    const formData = new FormData();
    formData.append("file", file);

    // Send guidance_level alongside the file as a form field
    formData.append("guidance_level", guidanceLevel);

    try {
      const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

      const response = await fetch(`${BASE_URL}/api/documents/upload`, {
        method: "POST",
        body: formData,
      });

      // Parse the response body regardless of status
      const data = await response.json();

      if (!response.ok) {
        // Surface that message directly to the user
        throw new Error(
          data.detail || `Upload failed with status ${response.status}`
        );
      }

      // Store the parsed document for the reading view
      setParsedDocument(data);

      saveDocument({
        id: data.session_id,
        filename: data.filename,
        guidanceLevel,
        uploadedAt: new Date().toISOString(),
        totalChunks: data.total_chunks,
        totalPages: Array.from(
          new Set(
            data.elements
              .map((e: { page_number: number | null }) => e.page_number)
              .filter(Boolean)
          )
        ).length,
        parserUsed: data.classification.parser_used,
        sessionId: data.session_id,
      });

      saveDocumentData(data.session_id, data);

      // Wait for file to be fully saved before navigating.
      // ReadingView reads fileData synchronously on mount so it must exist first.
      const base64 = await readFileAsBase64(file);
      saveFileData(data.session_id, base64);

      // Now safe to navigate -- file is confirmed in localStorage.
      if (data.low_text_warning && data.warning_message) {
        setBackendWarning(data.warning_message);
        setTimeout(() => {
          navigate("/reading", { state: { document: data, guidanceLevel } });
        }, 2000);
        return;
      }

      navigate("/reading", { state: { document: data, guidanceLevel } });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to upload the document. Is the backend server running?";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 font-sans pb-20">
      <Header />

      <div className="w-full max-w-3xl mb-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>

      <main className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-blue-50/50 p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <FileText className="w-6 h-6 text-indigo-500" />
            <h3 className="text-lg font-semibold text-slate-900">
              Upload your Document
            </h3>
          </div>
          <p className="text-sm text-slate-500 ml-9">
            Upload your PDF and customize your reading experience
          </p>
        </div>

        <div className="p-8 space-y-8">
          <section className="space-y-3">
            <label className="block text-sm font-medium text-slate-900">
              Document Upload
            </label>
            <FileUploader file={file} setFile={setFile} />

            {/* Fatal upload error */}
            {uploadError && (
              <p className="text-sm text-red-500 mt-2">{uploadError}</p>
            )}

            {/* Non-fatal backend warning */}
            {backendWarning && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">{backendWarning}</p>
              </div>
            )}

            {/* Success state */}
            {parsedDocument && !backendWarning && (
              <p className="text-sm text-green-600 mt-2">
                Document processed successfully. {parsedDocument.total_elements}{" "}
                sections extracted, {parsedDocument.total_chunks} chunks
                created.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <label className="block text-sm font-medium text-slate-900">
              Guidance Level
            </label>
            <div className="space-y-3">
              <GuidanceOption
                id="light"
                title="Light support"
                description="Minimal interventions. Basic formatting and occasional check-ins."
                selected={guidanceLevel === "light"}
                onClick={() => setGuidanceLevel("light")}
              />
              <GuidanceOption
                id="medium"
                title="Medium Support (Recommended)"
                description="Balanced guidance with clear chunking and tracking."
                selected={guidanceLevel === "medium"}
                onClick={() => setGuidanceLevel("medium")}
              />
              <GuidanceOption
                id="heavy"
                title="Heavy Support"
                description="Frequent re-orientation, detailed context, and active reading assistance."
                selected={guidanceLevel === "heavy"}
                onClick={() => setGuidanceLevel("heavy")}
              />
            </div>
          </section>

          <button
            onClick={handleStartReading}
            disabled={isUploading || !file}
            className="w-full py-4 mt-4 text-white font-medium bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing Document...
              </>
            ) : (
              "Start Reading with FocusFlow"
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
