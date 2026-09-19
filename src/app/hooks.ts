import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Shrinks a block's font size from `max` toward `min` until no single word overflows. */
export function useFitText(text: string, max = 64, min = 40) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(max);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure with normal wrapping so a long single word actually overflows;
    // only fall back to breaking inside a word once the minimum size is reached.
    el.style.overflowWrap = 'normal';
    let s = max;
    el.style.fontSize = `${s}px`;
    while (s > min && el.scrollWidth > el.clientWidth + 1) {
      s -= 2;
      el.style.fontSize = `${s}px`;
    }
    el.style.overflowWrap = el.scrollWidth > el.clientWidth + 1 ? 'anywhere' : 'normal';
    setSize(s);
  }, [text, max, min]);
  return { ref, size };
}

export interface Countdown {
  remaining: number;
  running: boolean;
  done: boolean;
  pause: () => void;
  resume: () => void;
}

/** Second-resolution countdown driven by wall-clock time, so background tabs stay accurate. */
export function useCountdown(totalSeconds: number, autoStart: boolean): Countdown {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(autoStart && totalSeconds > 0);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  useEffect(() => {
    if (!running) return;
    const end = Date.now() + remainingRef.current * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setRunning(false);
    };
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [running]);

  return {
    remaining,
    running,
    done: totalSeconds > 0 && remaining === 0,
    pause: () => setRunning(false),
    resume: () => {
      if (remainingRef.current > 0) setRunning(true);
    },
  };
}

interface WakeLockSentinel {
  release(): Promise<void>;
}

/** Holds a screen wake lock while the component is mounted, where the API exists. */
export function useWakeLock(): void {
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
    };
    if (!nav.wakeLock) return;
    let active = true;
    let lock: WakeLockSentinel | null = null;
    nav.wakeLock
      .request('screen')
      .then((l) => {
        if (active) lock = l;
        else l.release().catch(() => {});
      })
      .catch(() => {});
    return () => {
      active = false;
      lock?.release().catch(() => {});
    };
  }, []);
}

export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}

/** True once `ms` milliseconds have passed since mount (or since `key` changed). */
export function useDelay(ms: number, key: unknown = null): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const id = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(id);
  }, [ms, key]);
  return ready;
}
