import type { Schedule } from './types';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });
/** YYYY-MM-DD in Africa/Cairo. Every device uses this, so "today" is identical everywhere. */
export const cairoDateKey = (d = new Date()) => fmt.format(d);
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayNum = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
export const weekday = (k: string) => new Date(dayNum(k) * 86400000).getUTCDay();
export function isDue(s: Schedule, key: string): boolean {
  if (s.type === 'daily') return true;
  if (s.type === 'weekly') return s.days.includes(weekday(key));
  const diff = dayNum(key) - dayNum(s.anchor);
  return diff >= 0 && diff % s.n === 0;
}
export const HISTORY_DAYS = 35;
export const addDays = (k: string, n: number) => new Date((dayNum(k) + n) * 86400000).toISOString().slice(0, 10);
