import { useEffect, useState } from 'react';

/** Countdown in seconds. Calls onEnd once when it reaches zero. */
export function Timer({ seconds, running, onEnd, big = false }: { seconds: number; running: boolean; onEnd?: () => void; big?: boolean }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => setLeft(seconds), [seconds]);
  useEffect(() => {
    if (!running || left <= 0) return;
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, [running, left]);
  useEffect(() => {
    if (running && left === 0) onEnd?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running]);
  const m = Math.floor(left / 60);
  const s = left % 60;
  const danger = left <= 15;
  return (
    <span className={`font-mono tabular-nums ${big ? 'text-2xl font-semibold' : 'text-sm'} ${danger ? 'text-danger' : ''}`}>
      {m}:{s.toString().padStart(2, '0')}
    </span>
  );
}
