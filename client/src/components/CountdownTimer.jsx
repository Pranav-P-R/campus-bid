import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function CountdownTimer({ endTime, onExpire, compact = false }) {
  const [timeLeft, setTimeLeft] = useState(calculateTime(endTime));
  const [highlightExtension, setHighlightExtension] = useState(false);

  function calculateTime(target) {
    if (!target) return { total: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) {
      return { total: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { total: diff, hours, minutes, seconds, isExpired: false };
  }

  useEffect(() => {
    // Check if extended
    setTimeLeft(calculateTime(endTime));
    setHighlightExtension(true);
    const t = setTimeout(() => setHighlightExtension(false), 2000);
    return () => clearTimeout(t);
  }, [endTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTime(endTime);
      setTimeLeft(remaining);
      if (remaining.isExpired && onExpire) {
        onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, onExpire]);

  if (timeLeft.isExpired) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60">
        <Clock className="w-3.5 h-3.5" />
        Closed
      </span>
    );
  }

  const isUrgent = timeLeft.total <= 60000; // < 1 min
  const isClosingSoon = timeLeft.total <= 600000; // < 10 mins

  const pad = (n) => String(n).padStart(2, '0');

  let timeString = '';
  if (timeLeft.hours > 0) {
    timeString = `${pad(timeLeft.hours)}h ${pad(timeLeft.minutes)}m ${pad(timeLeft.seconds)}s`;
  } else {
    timeString = `${pad(timeLeft.minutes)}m ${pad(timeLeft.seconds)}s`;
  }

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-mono font-medium px-2 py-0.5 rounded transition-all duration-300 ${
          isUrgent
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
            : isClosingSoon
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            : 'bg-slate-800/80 text-slate-300'
        } ${highlightExtension ? 'ring-2 ring-amber-400 scale-105' : ''}`}
      >
        <Clock className="w-3 h-3" />
        {timeString}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-sm border transition-all duration-300 ${
        isUrgent
          ? 'bg-rose-950/90 text-rose-200 border-rose-700 animate-pulse ring-1 ring-rose-500'
          : isClosingSoon
          ? 'bg-amber-950/70 text-amber-200 border-amber-700/60'
          : 'bg-slate-900/90 text-slate-200 border-slate-700'
      } ${highlightExtension ? 'ring-2 ring-amber-400 scale-105' : ''}`}
    >
      <Clock className={`w-4 h-4 ${isUrgent ? 'text-rose-400 animate-spin' : 'text-amber-400'}`} />
      <span className="font-semibold">{timeString}</span>
      {isUrgent && (
        <span className="text-[10px] font-sans bg-rose-600/40 text-rose-200 uppercase tracking-wider px-1.5 py-0.5 rounded font-bold">
          Sniping Active
        </span>
      )}
    </div>
  );
}

