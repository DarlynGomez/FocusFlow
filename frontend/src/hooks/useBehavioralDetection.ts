import { useEffect, useRef, useCallback } from "react";

/** Which detector triggered the signal */
export type DetectionSignalSource =
  | "pause"
  | "repeated_scroll"
  | "slow_progress";

export interface DetectionSignal {
  source: DetectionSignalSource;
  /** Chunk index where the signal fired */
  chunkIndex: number;
  /** Extra context depending on source */
  detail: string;
  timestamp: number;
}

export interface DetectionSettings {
  pauseDetectionEnabled: boolean;
  repeatedScrollingEnabled: boolean;
  progressTrackingEnabled: boolean;
  /** Seconds of inactivity before pause fires */
  pauseThresholdSeconds: number;
}

interface UseBehavioralDetectionOptions {
  /** Current chunk index (from scroll tracking) */
  currentIndex: number;
  /** Total number of chunks in the document */
  totalChunks: number;
  /** Settings from the RightPanel toggles */
  settings: DetectionSettings;
  /** Called when any detector fires */
  onSignal: (signal: DetectionSignal) => void;
}

/**
 * Behavioral detection engine.
 *
 * Fires signals that the parent can use to show interventions.
 * Detectors are designed to **re-fire** naturally so the popup can
 * reappear after being dismissed:
 *
 *   - Pause: fires once per chunk when the user is idle for the
 *     configured threshold. Resets when the user moves to a new chunk.
 *   - Repeated scroll: fires every time a section's revisit count
 *     crosses a multiple of 2 (2nd, 4th, 6th… visit).
 *   - Slow progress: fires when forward progress stalls, re-arms
 *     automatically once the user starts moving again.
 */
export function useBehavioralDetection({
  currentIndex,
  totalChunks,
  settings,
  onSignal,
}: UseBehavioralDetectionOptions) {
  // ---- Pause detection ----
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The chunk index for which we already fired a pause signal.
  // Resets to -1 whenever the user scrolls to a different chunk.
  const pauseFiredForIndexRef = useRef<number>(-1);

  // ---- Repeated scroll detection ----
  const visitCountRef = useRef<Map<number, number>>(new Map());
  const prevIndexRef = useRef<number>(currentIndex);
  const lastDirectionRef = useRef<"forward" | "backward" | null>(null);
  // Track the visit-count threshold at which we last signalled per section
  // so we can fire again at the *next* multiple of 2.
  const lastSignalledAtRef = useRef<Map<number, number>>(new Map());

  // ---- Slow progress detection ----
  const highWaterMarkRef = useRef<number>(currentIndex);
  const progressWindowRef = useRef<{ index: number; time: number }[]>([]);
  const slowProgressFiredRef = useRef<boolean>(false);

  // Stable refs so effects don't re-run on every render
  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ----------------------------------------------------------------
  // Pause detection
  // ----------------------------------------------------------------
  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const resetPauseTimer = useCallback(() => {
    clearPauseTimer();

    if (!settingsRef.current.pauseDetectionEnabled) return;

    pauseTimerRef.current = setTimeout(() => {
      const idx = prevIndexRef.current;
      // Only fire once per chunk — resets when user scrolls to a new chunk
      if (pauseFiredForIndexRef.current === idx) return;
      pauseFiredForIndexRef.current = idx;

      onSignalRef.current({
        source: "pause",
        chunkIndex: idx,
        detail: `User paused for ${settingsRef.current.pauseThresholdSeconds}s at chunk ${idx}`,
        timestamp: Date.now(),
      });
    }, settingsRef.current.pauseThresholdSeconds * 1000);
  }, [clearPauseTimer]);

  /** Call on every user interaction (scroll, mouse-move, key) */
  const handleUserActivity = useCallback(() => {
    resetPauseTimer();
  }, [resetPauseTimer]);

  // When the user scrolls to a new chunk, allow pause to fire again there
  // and restart the timer.
  useEffect(() => {
    if (currentIndex !== prevIndexRef.current) {
      pauseFiredForIndexRef.current = -1; // new chunk → allow pause again
    }
    resetPauseTimer();
    // prevIndexRef is updated in the repeated-scroll effect below
  }, [currentIndex, resetPauseTimer]);

  // ----------------------------------------------------------------
  // Repeated scroll detection
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!settings.repeatedScrollingEnabled) {
      prevIndexRef.current = currentIndex;
      return;
    }

    const prev = prevIndexRef.current;
    const direction =
      currentIndex > prev
        ? "forward"
        : currentIndex < prev
        ? "backward"
        : null;

    if (direction) {
      const reversed =
        lastDirectionRef.current !== null &&
        direction !== lastDirectionRef.current;
      lastDirectionRef.current = direction;

      if (reversed || direction === "backward") {
        const visits = visitCountRef.current;
        const count = (visits.get(currentIndex) ?? 0) + 1;
        visits.set(currentIndex, count);

        // Fire every time count crosses the next multiple of 2
        const lastThreshold = lastSignalledAtRef.current.get(currentIndex) ?? 0;
        if (count >= lastThreshold + 2) {
          lastSignalledAtRef.current.set(currentIndex, count);
          onSignalRef.current({
            source: "repeated_scroll",
            chunkIndex: currentIndex,
            detail: `User revisited chunk ${currentIndex} (${count} visits)`,
            timestamp: Date.now(),
          });
        }
      }
    }

    prevIndexRef.current = currentIndex;
  }, [currentIndex, settings.repeatedScrollingEnabled]);

  // ----------------------------------------------------------------
  // Slow progress detection
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!settings.progressTrackingEnabled) return;

    if (currentIndex > highWaterMarkRef.current) {
      highWaterMarkRef.current = currentIndex;
    }

    const now = Date.now();
    const win = progressWindowRef.current;

    win.push({ index: currentIndex, time: now });

    // Keep only the last 60 seconds
    const cutoff = now - 60_000;
    while (win.length > 0 && win[0].time < cutoff) {
      win.shift();
    }

    if (win.length < 2) return;
    const elapsed = (now - win[0].time) / 1000;
    if (elapsed < 30) return;

    const forwardChunks = highWaterMarkRef.current - win[0].index;

    if (
      forwardChunks < 2 &&
      highWaterMarkRef.current >= 3 &&
      !slowProgressFiredRef.current
    ) {
      slowProgressFiredRef.current = true;
      onSignalRef.current({
        source: "slow_progress",
        chunkIndex: currentIndex,
        detail: `User advanced only ${forwardChunks} chunks in ${Math.round(elapsed)}s`,
        timestamp: Date.now(),
      });
    }

    // Re-arm once the user starts moving forward again
    if (forwardChunks >= 3) {
      slowProgressFiredRef.current = false;
    }
  }, [currentIndex, settings.progressTrackingEnabled]);

  // ----------------------------------------------------------------
  // Cleanup
  // ----------------------------------------------------------------
  useEffect(() => {
    return () => clearPauseTimer();
  }, [clearPauseTimer]);

  return { handleUserActivity };
}
