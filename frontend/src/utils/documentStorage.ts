// Manages saved documents in localStorage
export interface SavedDocument {
    id: string;
    filename: string;
    guidanceLevel: string;
    uploadedAt: string;
    totalChunks: number;
    totalPages: number;
    parserUsed: string;
    sessionId: string;
  }
  
  const STORAGE_KEY = "focusflow_documents";
  const DOCUMENT_DATA_PREFIX = "focusflow_doc_data_";
  
  // Document list functions
  
  export function getSavedDocuments(): SavedDocument[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  
  export function saveDocument(doc: SavedDocument): void {
    try {
      const existing = getSavedDocuments();
      const updated = [doc, ...existing.filter((d) => d.id !== doc.id)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      console.error("Failed to save document to localStorage");
    }
  }
  
  export function removeDocument(id: string): void {
    try {
      const existing = getSavedDocuments();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(existing.filter((d) => d.id !== id))
      );
      removeDocumentData(id);
    } catch {
      console.error("Failed to remove document from localStorage");
    }
  }
  
  // Full document data functions
  
  export function saveDocumentData(sessionId: string, data: unknown): void {
    try {
      localStorage.setItem(
        `${DOCUMENT_DATA_PREFIX}${sessionId}`,
        JSON.stringify(data)
      );
    } catch {
      console.error("Failed to save document data, localStorage may be full");
    }
  }
  
  export function getDocumentData(sessionId: string): unknown | null {
    try {
      const raw = localStorage.getItem(`${DOCUMENT_DATA_PREFIX}${sessionId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  
  export function removeDocumentData(sessionId: string): void {
    try {
      localStorage.removeItem(`${DOCUMENT_DATA_PREFIX}${sessionId}`);
    } catch {
      console.error("Failed to remove document data");
    }
  }