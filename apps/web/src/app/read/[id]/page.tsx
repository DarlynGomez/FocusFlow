"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  documents,
  sessions,
  chunks as chunksApi,
  type ChunkOut,
  type DocumentOutline,
  type SessionResponse,
} from "@/lib/api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ReadPage() {
  const params = useParams();
  const documentId = params.id as string;
  const router = useRouter();
  const [docChunks, setDocChunks] = useState<ChunkOut[]>([]);
  const [outline, setOutline] = useState<DocumentOutline | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [currentChunkId, setCurrentChunkId] = useState<string | null>(null);
  const [supportContent, setSupportContent] = useState<string | null>(null);
  const [supportType, setSupportType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportLoading, setSupportLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [fontSize, setFontSize] = useState<"base" | "lg">("base");
  const [supportMode, setSupportMode] = useState("medium");

  const currentChunk = docChunks.find((c) => c.id === currentChunkId);
  const currentIndex = currentChunk ? docChunks.indexOf(currentChunk) : 0;
  const currentSectionNode =
    outline?.nodes.find((node) => currentChunkId && node.chunk_ids.includes(currentChunkId)) ?? null;
  const currentSectionLabel =
    currentSectionNode?.section_title && currentSectionNode.section_title !== "_no_section"
      ? currentSectionNode.section_title
      : "Document";

  const loadDoc = useCallback(async () => {
    try {
      const [chunksList, outlineRes] = await Promise.all([
        documents.chunks(documentId),
        documents.outline(documentId),
      ]);
      setDocChunks(chunksList);
      setOutline(outlineRes);
      if (chunksList.length > 0) {
        const newSession = await sessions.start(documentId, supportMode);
        setSession(newSession);
        setCurrentChunkId(chunksList[0].id);
      }
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [documentId, supportMode]);

  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  useEffect(() => {
    if (!session || !currentChunkId) return;
    sessions.event(session.id, "chunk_opened", currentChunkId).catch(() => {});
  }, [session?.id, currentChunkId]);

  useEffect(() => {
    if (!session || !currentChunkId) return;
    sessions
      .supportCurrent(session.id)
      .then((msg) => {
        if (!msg || msg.chunk_id !== currentChunkId) {
          setSupportContent(null);
          setSupportType(null);
          return;
        }
        setSupportContent(msg.content);
        setSupportType(msg.support_type);
      })
      .catch(() => {});
  }, [session?.id, currentChunkId]);

  const goToChunk = (chunkId: string) => {
    setCurrentChunkId(chunkId);
    setSupportContent(null);
    setSupportType(null);
    setChatMessages([]);
  };

  const requestSupport = async (type: "explain" | "recap" | "orient" | "why-it-matters") => {
    if (!currentChunkId) return;
    setSupportLoading(true);
    setSupportType(type);
    try {
      let content: string;
      if (type === "explain") content = (await chunksApi.explain(currentChunkId)).content;
      else if (type === "recap") content = (await chunksApi.recap(currentChunkId)).content;
      else if (type === "orient") content = (await chunksApi.orient(currentChunkId)).content;
      else content = (await chunksApi.whyItMatters(currentChunkId)).content;
      setSupportContent(content);
      setChatMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch {
      setSupportContent("Could not load support. Please try again.");
    } finally {
      setSupportLoading(false);
    }
  };

  const sendSupportChat = async () => {
    if (!session || !chatInput.trim() || chatLoading) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatLoading(true);
    try {
      const msg = await sessions.supportChat(session.id, question, currentChunkId || undefined);
      setChatMessages((prev) => [...prev, { role: "assistant", content: msg.content }]);
      setSupportContent(msg.content);
      setSupportType("chat");
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Could not send your question. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading document...</p>
      </div>
    );
  }

  if (docChunks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600 mb-4">No chunks available yet. The document may still be processing.</p>
          <Link href="/dashboard" className="text-indigo-600 hover:underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left sidebar: outline & progress */}
      <aside className="w-72 border-r border-slate-200 bg-white hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen">
        <div className="p-4 border-b border-slate-100">
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Dashboard</Link>
        </div>
        <div className="p-4">
          <p className="text-xs font-medium text-slate-500 uppercase mb-2">Progress</p>
          <p className="text-sm text-slate-700">
            Chunk {currentIndex + 1} of {docChunks.length}
          </p>
          <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / docChunks.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 overflow-y-auto">
          <p className="text-xs font-medium text-slate-500 uppercase mb-2">Table of contents</p>
          <nav className="space-y-2">
            {outline?.nodes.map((node) => {
              const sectionLabel = node.section_title === "_no_section" ? "Document" : node.section_title;
              const sectionIsActive = !!currentChunkId && node.chunk_ids.includes(currentChunkId);
              return (
                <div key={node.section_title} className="space-y-1">
                  <button
                    onClick={() => node.chunk_ids[0] && goToChunk(node.chunk_ids[0])}
                    className={`block w-full text-left text-sm px-2 py-1.5 rounded ${
                      sectionIsActive
                        ? "bg-indigo-100 text-indigo-800 font-medium"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    title={sectionLabel}
                  >
                    {sectionLabel}
                  </button>
                  {sectionIsActive && (
                    <div className="pl-2 space-y-1">
                      {node.chunk_ids.map((cid, i) => (
                        <button
                          key={cid}
                          onClick={() => goToChunk(cid)}
                          className={`block w-full text-left text-xs px-2 py-1 rounded truncate ${
                            cid === currentChunkId
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {node.chunk_titles[i] || `Chunk ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Center: reading pane */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="lg:hidden rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Dashboard</Link>
              <p className="text-xs text-slate-500">Chunk {currentIndex + 1} / {docChunks.length}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {outline?.nodes.map((node) => {
                const sectionLabel = node.section_title === "_no_section" ? "Document" : node.section_title;
                const sectionIsActive = !!currentChunkId && node.chunk_ids.includes(currentChunkId);
                return (
                  <button
                    key={node.section_title}
                    onClick={() => node.chunk_ids[0] && goToChunk(node.chunk_ids[0])}
                    className={`shrink-0 px-3 py-1.5 text-xs rounded-full border ${
                      sectionIsActive
                        ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    {sectionLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Current section</p>
            <p className="text-sm font-medium text-slate-800 truncate">{currentSectionLabel}</p>
          </div>

          {currentChunk && (
            <article className={`rounded-xl p-6 bg-white border-2 border-indigo-200 shadow-sm ${fontSize === "lg" ? "text-lg" : ""}`} style={{ lineHeight: 1.7 }}>
              {currentChunk.section_title && currentChunk.section_title !== "_no_section" && (
                <p className="text-xs font-medium text-indigo-600 uppercase mb-1">{currentChunk.section_title}</p>
              )}
              <h2 className="text-xl font-semibold text-slate-900 mb-2">{currentChunk.title}</h2>
              {currentChunk.key_idea && (
                <p className="text-slate-600 mb-4 font-medium">Key idea: {currentChunk.key_idea}</p>
              )}
              {currentChunk.estimated_read_time_seconds && (
                <p className="text-xs text-slate-400 mb-4">~{currentChunk.estimated_read_time_seconds}s read</p>
              )}

              <div className="prose prose-slate max-w-none">
                <p className="whitespace-pre-wrap text-slate-800">{currentChunk.chunk_text}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                <button
                  onClick={() => requestSupport("explain")}
                  disabled={supportLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                >
                  Explain this
                </button>
                <button
                  onClick={() => requestSupport("recap")}
                  disabled={supportLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                >
                  Recap previous
                </button>
                <button
                  onClick={() => requestSupport("orient")}
                  disabled={supportLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                >
                  Where am I?
                </button>
                <button
                  onClick={() => requestSupport("why-it-matters")}
                  disabled={supportLoading}
                  className="px-3 py-1.5 text-sm rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50"
                >
                  Why does this matter?
                </button>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  onClick={() => currentIndex > 0 && goToChunk(docChunks[currentIndex - 1].id)}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-medium disabled:opacity-50"
                >
                  Previous
                </button>
                <p className="text-xs text-slate-500">Chunk {currentIndex + 1} / {docChunks.length}</p>
                <button
                  onClick={() => currentIndex < docChunks.length - 1 && goToChunk(docChunks[currentIndex + 1].id)}
                  disabled={currentIndex === docChunks.length - 1}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </article>
          )}
        </div>
      </main>

      {/* Right: support panel */}
      <aside className="w-80 border-l border-slate-200 bg-white hidden xl:flex xl:flex-col xl:sticky xl:top-0 xl:h-screen">
        <div className="p-4 border-b border-slate-100 space-y-1">
          <p className="text-sm font-medium text-slate-700">Support</p>
          <p className="text-xs text-slate-500 truncate">Section: {currentSectionLabel}</p>
          <p className="text-xs text-slate-500 truncate">Chunk: {currentChunk?.title || "-"}</p>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          {supportLoading && <p className="text-sm text-slate-500 mb-3">Loading...</p>}
          {supportContent && !supportLoading && (
            <div className="space-y-2 mb-4 rounded-lg border border-slate-200 p-3 bg-slate-50">
              {supportType && (
                <p className="text-xs font-medium text-indigo-600 uppercase">{supportType.replace(/-/g, " ")}</p>
              )}
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{supportContent}</p>
              <button
                onClick={() => { setSupportContent(null); setSupportType(null); }}
                className="text-xs text-slate-500 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}
          {!supportContent && !supportLoading && (
            <p className="text-sm text-slate-400">Use the buttons next to the current chunk to get a recap, explanation, or orientation.</p>
          )}

          <div className="mt-4 rounded-xl border border-slate-200 p-3 bg-white flex flex-col" style={{ minHeight: 360 }}>
            <p className="text-xs font-medium text-slate-500 uppercase">Ask about this document</p>
            <div className="mt-3 flex-1 overflow-y-auto space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-sm text-slate-400">
                  Ask any question about the document. I will answer using relevant chunks.
                </p>
              )}
              {chatMessages.map((message, idx) => (
                <div
                  key={`${message.role}-${idx}`}
                  className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-indigo-600 text-white ml-6"
                      : "bg-slate-100 text-slate-700 mr-6"
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {chatLoading && (
                <p className="text-xs text-slate-500">Thinking...</p>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendSupportChat();
                  }
                }}
                placeholder="Ask a question about this section or the whole document"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                disabled={!session || chatLoading}
              />
              <button
                onClick={sendSupportChat}
                disabled={!session || !chatInput.trim() || chatLoading}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 space-y-2">
          <p className="text-xs font-medium text-slate-500">Reading settings</p>
          <div className="flex gap-2">
            <button
              onClick={() => setFontSize("base")}
              className={`px-2 py-1 text-xs rounded ${fontSize === "base" ? "bg-indigo-100 text-indigo-800" : "bg-slate-100"}`}
            >
              A
            </button>
            <button
              onClick={() => setFontSize("lg")}
              className={`px-2 py-1 text-xs rounded ${fontSize === "lg" ? "bg-indigo-100 text-indigo-800" : "bg-slate-100"}`}
            >
              A+
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
