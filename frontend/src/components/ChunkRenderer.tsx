import { useState } from "react";
import katex from "katex";

interface ChunkProps {
  elementType: string;
  text: string;
  imageData?: string;
  pageNumber?: number | null;
  keyIdea?: string;
  whyItMatters?: string;
  renderedHtml?: string;
  estimatedReadTime?: number;
}

function renderMathText(text: string): React.ReactNode[] {
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^\n$]*?\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      const math = part.slice(2, -2);
      try {
        const html = katex.renderToString(math, {
          displayMode: true,
          throwOnError: false,
        });
        return (
          <span
            key={i}
            className="block my-3 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        return <span key={i}>{part}</span>;
      }
    }
    if (part.startsWith("$") && part.endsWith("$")) {
      const math = part.slice(1, -1);
      try {
        const html = katex.renderToString(math, {
          displayMode: false,
          throwOnError: false,
        });
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      } catch {
        return <span key={i}>{part}</span>;
      }
    }
    return <span key={i}>{part}</span>;
  });
}

function parseMarkdownTable(
  text: string
): { headers: string[]; rows: string[][] } | null {
  const lines = text
    .trim()
    .split("\n")
    .filter((l) => l.trim());
  if (lines.length < 2) return null;
  const parseCells = (line: string) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1);
  const headers = parseCells(lines[0]);
  if (!headers.length) return null;
  const rows = lines
    .slice(2)
    .map(parseCells)
    .filter((r) => r.length > 0);
  return { headers, rows };
}

export default function ChunkRenderer({
  elementType,
  text,
  imageData,
  pageNumber,
  keyIdea,
  whyItMatters,
  renderedHtml,
  estimatedReadTime,
}: ChunkProps) {
  // useState MUST be called before any conditional returns.
  const [insightOpen, setInsightOpen] = useState(false);
  const hasInsight = !!(keyIdea || whyItMatters);

  // IMAGE
  if (elementType === "image") {
    if (!imageData) return null;
    return (
      <figure className="my-6">
        <img
          src={`data:image/png;base64,${imageData}`}
          alt={`Figure on page ${pageNumber ?? ""}`}
          className="max-w-full h-auto block mx-auto rounded border border-slate-200"
        />
      </figure>
    );
  }

  // TABLE
  if (elementType === "table") {
    if (renderedHtml) {
      return (
        <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <div
            className="text-sm [&_table]:w-full [&_table]:border-collapse [&_thead_tr]:bg-slate-50 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-slate-500 [&_th]:uppercase [&_th]:tracking-wide [&_th]:border-b [&_th]:border-slate-200 [&_td]:px-4 [&_td]:py-2 [&_td]:text-xs [&_td]:text-slate-700 [&_td]:border-b [&_td]:border-slate-100 [&_tr:last-child_td]:border-0 [&_tr:hover_td]:bg-slate-50"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      );
    }
    const parsed = parseMarkdownTable(text);
    if (parsed) {
      return (
        <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50">
                {parsed.headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <pre className="text-xs text-slate-600 p-4 whitespace-pre-wrap select-text">
          {text}
        </pre>
      </div>
    );
  }

  // CAPTION
  if (elementType === "caption") {
    return (
      <p className="text-xs text-slate-500 italic mt-1 mb-4 pl-3 border-l-2 border-slate-200 select-text">
        {text}
      </p>
    );
  }

  // CITATION
  if (elementType === "citation") {
    return (
      <p className="text-xs text-slate-400 leading-relaxed select-text font-mono">
        {text}
      </p>
    );
  }

  // DOCUMENT TITLE -- large centered, for the paper/document title element
  // Uses inline style to guarantee the size is never overridden by Tailwind base resets.
  if (elementType === "Title" && text.length > 40) {
    return (
      <div className="mt-2 mb-6 text-center">
        <h1
          style={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.25 }}
          className="text-slate-900 select-text"
        >
          {renderMathText(text)}
        </h1>
      </div>
    );
  }

  // SECTION HEADING
  if (elementType === "heading" || elementType === "Title") {
    return (
      <div className="mt-8 mb-3">
        <div className="flex items-start gap-2">
          {/* Inline style guarantees heading size survives any Tailwind base reset */}
          <h2
            style={{ fontSize: "1.125rem", fontWeight: 700, lineHeight: 1.35 }}
            className="text-slate-900 select-text flex-1 tracking-tight"
          >
            {renderMathText(text)}
          </h2>
          {hasInsight && (
            <button
              onClick={() => setInsightOpen((o) => !o)}
              className="shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-500 hover:bg-indigo-100 transition-colors"
            >
              {insightOpen ? "hide" : "key idea"}
            </button>
          )}
        </div>
        {insightOpen && (keyIdea || whyItMatters) && (
          <div className="mt-2 p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700 space-y-1">
            {keyIdea && (
              <p>
                <span className="font-semibold">Key idea: </span>
                {keyIdea}
              </p>
            )}
            {whyItMatters && (
              <p>
                <span className="font-semibold">Why it matters: </span>
                {whyItMatters}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // PLAIN TEXT
  if (!text) {
    return <span className="block w-full h-4 bg-slate-200 rounded-md" />;
  }

  return (
    <div className="relative group mb-0">
      {hasInsight && (
        <button
          onClick={() => setInsightOpen((o) => !o)}
          className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-indigo-300 hover:text-indigo-500"
          title="Show key idea"
        >
          ✦
        </button>
      )}
      <p className="text-sm text-slate-700 leading-relaxed select-text">
        {renderMathText(text)}
      </p>
      {insightOpen && (keyIdea || whyItMatters) && (
        <div className="mt-2 p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700 space-y-1">
          {keyIdea && (
            <p>
              <span className="font-semibold">Key idea: </span>
              {keyIdea}
            </p>
          )}
          {whyItMatters && (
            <p>
              <span className="font-semibold">Why it matters: </span>
              {whyItMatters}
            </p>
          )}
        </div>
      )}
      {estimatedReadTime && (
        <p className="text-[10px] text-slate-300 mt-1 select-none">
          {estimatedReadTime}s read
        </p>
      )}
    </div>
  );
}
