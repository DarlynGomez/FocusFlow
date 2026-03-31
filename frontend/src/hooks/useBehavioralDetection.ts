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

type UserActivityKind = "scroll" | "pointer" | "keyboard" | "touch";

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

interface RevisitStats {
  entries: number;
  revisits: number;
  lastSignalledAt: number;
  lastEnteredAt: number;
}

const REPEATED_SCROLL_THRESHOLD = 2;
const REPEATED_SCROLL_SIGNAL_STEP = 2;
const REPEATED_SCROLL_REENTRY_DEBOUNCE_MS = 900;
const SLOW_PROGRESS_WINDOW_MS = 45_000;
const SLOW_PROGRESS_MIN_ELAPSED_MS = 30_000;
const SLOW_PROGRESS_MIN_FORWARD_CHUNKS = 2;
const SLOW_PROGRESS_REARM_CHUNKS = 3;

/**
 * Behavioral detection engine.
 *
 * Fires signals that the parent can use to show interventions:
 *   - Pause: fires after the configured idle threshold and re-arms on user activity.
 *   - Repeated scroll: fires when the reader has revisited the same section multiple times.
 *   - Slow progress: fires only after a sustained low forward-progress window.
 */
export function useBehavioralDetection({
  currentIndex,
  totalChunks,
  settings,
  onSignal,
}: UseBehavioralDetectionOptions) {
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseArmedRef = useRef(true);
  const activeIndexRef = useRef(currentIndex);

  const revisitStatsRef = useRef<Map<number, RevisitStats>>(new Map());
  const lastIndexRef = useRef(currentIndex);
  const repeatedScrollInitializedRef = useRef(false);

  const progressSamplesRef = useRef<{ index: number; time: number }[]>([]);
  const slowProgressFiredRef = useRef(false);
  const progressTrackingInitializedRef = useRef(false);

  const onSignalRef = useRef(onSignal);
  const settingsRef = useRef(settings);

  useEffect(() => {
    onSignalRef.current = onSignal;
    settingsRef.current = settings;
  }, [onSignal, settings]);

  const clampIndex = useCallback(
    (index: number) => {
      if (totalChunks <= 0) return 0;
      return Math.max(0, Math.min(index, totalChunks - 1));
    },
    [totalChunks]
  );

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
      if (!pauseArmedRef.current) return;
      pauseArmedRef.current = false;

      const idx = activeIndexRef.current;
      onSignalRef.current({
        source: "pause",
        chunkIndex: idx,
        detail: `User paused for ${settingsRef.current.pauseThresholdSeconds}s at chunk ${idx}`,
        timestamp: Date.now(),
      });
    }, settingsRef.current.pauseThresholdSeconds * 1000);
  }, [clearPauseTimer]);

  const resetProgressTracking = useCallback(
    (index: number) => {
      const now = Date.now();
      progressSamplesRef.current = [{ index: clampIndex(index), time: now }];
      slowProgressFiredRef.current = false;
    },
    [clampIndex]
  );

  const initializeRepeatedScrollTracking = useCallback(
    (index: number) => {
      const safeIndex = clampIndex(index);
      revisitStatsRef.current = new Map([
        [
          safeIndex,
          {
            entries: 1,
            revisits: 0,
            lastSignalledAt: 0,
            lastEnteredAt: Date.now(),
          },
        ],
      ]);
      lastIndexRef.current = safeIndex;
    },
    [clampIndex]
  );

  const handleUserActivity = useCallback(
    (kind: UserActivityKind = "pointer") => {
      void kind;
      pauseArmedRef.current = true;
      resetPauseTimer();
    },
    [resetPauseTimer]
  );

  useEffect(() => {
    activeIndexRef.current = clampIndex(currentIndex);
  }, [clampIndex, currentIndex]);

  useEffect(() => {
    pauseArmedRef.current = true;
    resetPauseTimer();
  }, [currentIndex, resetPauseTimer]);

  useEffect(() => {
    if (!settings.pauseDetectionEnabled) {
      pauseArmedRef.current = false;
      clearPauseTimer();
      return;
    }

    pauseArmedRef.current = true;
    resetPauseTimer();
  }, [
    clearPauseTimer,
    resetPauseTimer,
    settings.pauseDetectionEnabled,
    settings.pauseThresholdSeconds,
  ]);

  useEffect(() => {
    if (!settings.repeatedScrollingEnabled) {
      revisitStatsRef.current.clear();
      lastIndexRef.current = clampIndex(currentIndex);
      repeatedScrollInitializedRef.current = false;
      return;
    }

    if (repeatedScrollInitializedRef.current) return;

    initializeRepeatedScrollTracking(currentIndex);
    repeatedScrollInitializedRef.current = true;
  }, [
    clampIndex,
    currentIndex,
    initializeRepeatedScrollTracking,
    settings.repeatedScrollingEnabled,
  ]);

  useEffect(() => {
    if (!settings.repeatedScrollingEnabled) return;

    const nextIndex = clampIndex(currentIndex);
    const prevIndex = lastIndexRef.current;
    if (nextIndex === prevIndex) return;

    const now = Date.now();
    const currentStats = revisitStatsRef.current.get(nextIndex) ?? {
      entries: 0,
      revisits: 0,
      lastSignalledAt: 0,
      lastEnteredAt: 0,
    };

    if (
      currentStats.entries > 0 &&
      now - currentStats.lastEnteredAt >= REPEATED_SCROLL_REENTRY_DEBOUNCE_MS
    ) {
      currentStats.revisits += 1;
    }

    currentStats.entries += 1;
    currentStats.lastEnteredAt = now;
    revisitStatsRef.current.set(nextIndex, currentStats);

    if (
      currentStats.revisits >= REPEATED_SCROLL_THRESHOLD &&
      currentStats.revisits >=
        currentStats.lastSignalledAt + REPEATED_SCROLL_SIGNAL_STEP
    ) {
      currentStats.lastSignalledAt = currentStats.revisits;
      onSignalRef.current({
        source: "repeated_scroll",
        chunkIndex: nextIndex,
        detail: `User revisited chunk ${nextIndex} ${currentStats.revisits} times`,
        timestamp: now,
      });
    }

    lastIndexRef.current = nextIndex;
  }, [clampIndex, currentIndex, settings.repeatedScrollingEnabled]);

  useEffect(() => {
    if (!settings.progressTrackingEnabled) {
      progressSamplesRef.current = [];
      slowProgressFiredRef.current = false;
      progressTrackingInitializedRef.current = false;
      return;
    }

    if (progressTrackingInitializedRef.current) return;

    resetProgressTracking(currentIndex);
    progressTrackingInitializedRef.current = true;
  }, [
    currentIndex,
    resetProgressTracking,
    settings.progressTrackingEnabled,
  ]);

  useEffect(() => {
    if (!settings.progressTrackingEnabled) return;

    const nextIndex = clampIndex(currentIndex);
    const now = Date.now();
    const samples = progressSamplesRef.current;
    const lastSample = samples[samples.length - 1];

    if (!lastSample) {
      progressSamplesRef.current = [{ index: nextIndex, time: now }];
      return;
    }

    if (nextIndex < lastSample.index) {
      resetProgressTracking(nextIndex);
      return;
    }

    if (nextIndex === lastSample.index) return;

    samples.push({ index: nextIndex, time: now });

    const cutoff = now - SLOW_PROGRESS_WINDOW_MS;
    while (samples.length > 0 && samples[0].time < cutoff) {
      samples.shift();
    }

    if (samples.length < 2) return;

    const elapsed = now - samples[0].time;
    const forwardProgress = nextIndex - samples[0].index;

    if (
      elapsed >= SLOW_PROGRESS_MIN_ELAPSED_MS &&
      forwardProgress < SLOW_PROGRESS_MIN_FORWARD_CHUNKS &&
      nextIndex >= SLOW_PROGRESS_REARM_CHUNKS &&
      !slowProgressFiredRef.current
    ) {
      slowProgressFiredRef.current = true;
      onSignalRef.current({
        source: "slow_progress",
        chunkIndex: nextIndex,
        detail: `User advanced only ${forwardProgress} chunks in ${Math.round(elapsed / 1000)}s`,
        timestamp: now,
      });
    }

    if (forwardProgress >= SLOW_PROGRESS_REARM_CHUNKS) {
      resetProgressTracking(nextIndex);
    }
  }, [
    clampIndex,
    currentIndex,
    resetProgressTracking,
    settings.progressTrackingEnabled,
  ]);

  useEffect(() => {
    return () => clearPauseTimer();
  }, [clearPauseTimer]);

  return { handleUserActivity };
}
