import { useEffect, useState } from 'react';

const fmtDate = (d: Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(d)
    .toLowerCase()
    .replace(/ /g, ' · ');

// Refresh roughly every minute so the date doesn't get stuck across midnight
// for long-lived tabs.
const REFRESH_MS = 60_000;

export const Footer = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="hint">
      <span>20 req/min on submit · 120 req/min on poll</span>
      <span>{fmtDate(now)}</span>
    </div>
  );
};
