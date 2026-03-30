import katex from "katex";

interface ChunkProps {
  elementType: string;
  text: string;
  imageData?: string;
  pageNumber?: number | null;
}

// Splits text into math and non-math segments and renders each accordingly.
// Handles both display math ($$...$$) and inline math ($...$).
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
            className="block my-2 overflow-x-auto"
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

export default function ChunkRenderer({
  elementType,
  text,
  imageData,
  pageNumber,
}: ChunkProps) {
  if (elementType === "image") {
    if (!imageData) return null;
    return (
      <figure className="my-4 rounded-lg overflow-hidden border border-slate-200 bg-white">
        <img
          src={`data:image/png;base64,${imageData}`}
          alt={`Figure on page ${pageNumber ?? ""}`}
          className="max-w-full h-auto block mx-auto"
        />
      </figure>
    );
  }

  if (elementType === "table") {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white my-2">
        <pre className="text-xs text-slate-600 p-4 whitespace-pre-wrap select-text">
          {text}
        </pre>
      </div>
    );
  }

  if (elementType === "heading" || elementType === "Title") {
    return (
      <p className="text-base font-semibold text-slate-900 select-text">
        {renderMathText(text)}
      </p>
    );
  }

  // Default: plain text paragraph, selectable, with math rendering
  if (!text) {
    return <span className="block w-full h-4 bg-slate-200 rounded-md" />;
  }

  return (
    <p className="text-sm text-slate-700 leading-relaxed select-text">
      {renderMathText(text)}
    </p>
  );
}
