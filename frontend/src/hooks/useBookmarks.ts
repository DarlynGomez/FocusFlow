import { useState, useCallback } from "react";
import {
  getBookmarks,
  saveBookmark,
  removeBookmark,
  type Bookmark,
} from "../utils/bookmarkStorage";

export function useBookmarks(sessionId: string) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() =>
    getBookmarks(sessionId)
  );

  const addBookmark = useCallback(
    (chunkIndex: number, pageNumber: number | null, preview: string, label?: string) => {
      const bm: Bookmark = {
        id: `${sessionId}-${chunkIndex}-${Date.now()}`,
        sessionId,
        chunkIndex,
        pageNumber,
        label: label || `Page ${pageNumber ?? chunkIndex + 1}`,
        preview: preview.slice(0, 80),
        createdAt: new Date().toISOString(),
      };
      saveBookmark(bm);
      setBookmarks(getBookmarks(sessionId));
      return bm;
    },
    [sessionId]
  );

  const deleteBookmark = useCallback(
    (id: string) => {
      removeBookmark(sessionId, id);
      setBookmarks(getBookmarks(sessionId));
    },
    [sessionId]
  );

  const isBookmarked = useCallback(
    (chunkIndex: number) => bookmarks.some((b) => b.chunkIndex === chunkIndex),
    [bookmarks]
  );

  return { bookmarks, addBookmark, deleteBookmark, isBookmarked };
}