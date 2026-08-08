import { useState, useEffect } from "react";

/*
  AnimatedNumber — counts up from 0 to `value` whenever it changes.
  Used by every dashboard/stat-card grid in the app.
*/
export default function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseInt(value);
    if (isNaN(end) || start === end) return;
    const step  = Math.max(1, Math.floor(end / 20));
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}</span>;
}
