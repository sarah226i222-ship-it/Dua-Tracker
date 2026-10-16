import { addDays, isDue } from './dates';
import type { Completion, Dua } from './types';

export interface DayStat { key: string; due: number; done: number; ratio: number | null }
export type Stats = ReturnType<typeof computeStats>;

/** Rates use today's schedules applied to past days, so editing a schedule also reshapes history. */
export function computeStats(duas: Dua[], history: Completion[], today: string, days: number) {
  const req = duas.filter(d => d.kind === 'required' && d.schedule);
  const optIds = new Set(duas.filter(d => d.kind === 'optional').map(d => d.id));
  const doneBy = new Map<string, Set<string>>();
  let optional = 0;
  for (const c of history) {
    if (optIds.has(c.duaId)) { optional++; continue; }
    let s = doneBy.get(c.dateKey); if (!s) { s = new Set(); doneBy.set(c.dateKey, s); }
    s.add(c.duaId);
  }
  const list: DayStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = addDays(today, -i);
    const due = req.filter(d => isDue(d.schedule!, key));
    const done = due.filter(d => doneBy.get(key)?.has(d.id)).length;
    list.push({ key, due: due.length, done, ratio: due.length ? done / due.length : null });
  }
  let streak = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i].ratio;
    if (r === null) continue;
    if (r === 1) { streak++; continue; }
    if (i === list.length - 1) continue; // today still in progress
    break;
  }
  let best = 0, run = 0, sd = 0, sn = 0;
  for (const d of list) { sd += d.done; sn += d.due; if (d.ratio === null) continue; run = d.ratio === 1 ? run + 1 : 0; best = Math.max(best, run); }
  return { days: list, streak, best, rate: sn ? sd / sn : 0, optional };
}
