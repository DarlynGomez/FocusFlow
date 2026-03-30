import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface PDFViewerProps {
  fileData: string;
  onPageChange: (page: number, totalPages: number) => void;
  currentPage: number;
}

export default function PDFViewer({ fileData, onPageChange }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  useEffect(() => {
    if (!fileData) return;
    setIsLoading(true);
    setError(null);

    let cancelled = false;
    let pdfDoc: PDFDocumentProxy | null = null;

    const renderPDF = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        const { default: workerUrl } = await import(
          "pdfjs-dist/build/pdf.worker.min.mjs?url"
        );
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

        const binaryString = atob(fileData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        setTotalPages(pdfDoc.numPages);
        onPageChangeRef.current(1, pdfDoc.numPages);

        // ✅ Clear BEFORE we start appending
        if (containerRef.current) containerRef.current.innerHTML = "";

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (cancelled) return;

          const page = await pdfDoc.getPage(pageNum);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const pageWrapper = document.createElement("div");
          pageWrapper.className = "pdf-page-wrapper";
          pageWrapper.setAttribute("data-page", String(pageNum));
          pageWrapper.style.cssText = `
              margin-bottom: 16px;
              background: white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              border-radius: 4px;
              overflow: hidden;
              width: ${viewport.width}px;
            `;

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = "block";

          pageWrapper.appendChild(canvas);
          containerRef.current?.appendChild(pageWrapper);

          await page.render({ canvasContext: context, viewport }).promise;

          // ✅ Hide spinner after page 1 is painted
          if (pageNum === 1) setIsLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("PDF rendering failed:", err);
        setError(
          err instanceof Error
            ? `Rendering failed: ${err.message}`
            : "Failed to render PDF."
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    renderPDF();
    return () => {
      cancelled = true;
      pdfDoc?.destroy?.();
    };
  }, [fileData]);

  useEffect(() => {
    if (!containerRef.current || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute("data-page"));
            if (pageNum) onPageChangeRef.current(pageNum, totalPages);
          }
        });
      },
      { root: containerRef.current.parentElement, threshold: 0.3 }
    );
    const pages = containerRef.current.querySelectorAll(".pdf-page-wrapper");
    pages.forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, [isLoading, totalPages]);

  return (
    <div className="w-full">
      {/* ✅ Spinner and canvas container BOTH always in DOM — no conditional unmounting */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Rendering document...</p>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-40 text-sm text-red-500">
          {error}
        </div>
      )}
      {/* ✅ Always rendered — canvases appended here imperatively survive re-renders */}
      <div
        ref={containerRef}
        className="flex flex-col items-center py-6 px-4 w-full"
      ></div>
    </div>
  );
}
