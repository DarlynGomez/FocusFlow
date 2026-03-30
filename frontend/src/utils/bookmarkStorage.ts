export interface Bookmark {
    id: string;
    sessionId: string;
    chunkIndex: number;
    pageNumber: number | null;
    label: string;
    preview: string;       // first 80 chars of the chunk text
    createdAt: string;     // ISO string
  }
  
  const PREFIX = "focusflow_bookmarks_";
  
  export function getBookmarks(sessionId: string): Bookmark[] {
    try {
      const raw = localStorage.getItem(`${PREFIX}${sessionId}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  
  export function saveBookmark(bookmark: Bookmark): void {
    try {
      const existing = getBookmarks(bookmark.sessionId);
      const updated = [bookmark, ...existing.filter((b) => b.id !== bookmark.id)];
      localStorage.setItem(`${PREFIX}${bookmark.sessionId}`, JSON.stringify(updated));
    } catch {
      console.error("Failed to save bookmark");
    }
  }
  
  export function removeBookmark(sessionId: string, id: string): void {
    try {
      const existing = getBookmarks(sessionId);
      localStorage.setItem(
        `${PREFIX}${sessionId}`,
        JSON.stringify(existing.filter((b) => b.id !== id))
      );
    } catch {
      console.error("Failed to remove bookmark");
    }
  }
  
  export function clearBookmarks(sessionId: string): void {
    try { localStorage.removeItem(`${PREFIX}${sessionId}`); }
    catch { console.error("Failed to clear bookmarks"); }
  }