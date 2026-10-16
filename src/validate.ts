import { DATE_RE } from './dates';
import type { DuaInput } from './types';

export const GROUP = 5;

const ID = /^[A-Za-z0-9-]{1,100}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
function validSchedule(s: unknown): boolean {
  if (s === null) return true;
  if (!isObj(s)) return false;
  if (s.type === 'daily') return true;
  if (s.type === 'weekly') return Array.isArray(s.days) && s.days.length > 0 && s.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6);
  if (s.type === 'everyN') return Number.isInteger(s.n) && (s.n as number) >= 1 && (s.n as number) <= 365 && typeof s.anchor === 'string' && DATE_RE.test(s.anchor);
  return false;
}
export function validate(raw: string) {
  let j: unknown;
  try { j = JSON.parse(raw); } catch { throw new Error('Not valid JSON.'); }
  if (!isObj(j) || j.version !== 1) throw new Error('Unsupported file: expected version 1.');
  if (!Array.isArray(j.duas) || !Array.isArray(j.completions)) throw new Error('Missing "duas" or "completions" list.');
  const seen = new Set<string>();
  j.duas.forEach((d, i) => {
    const ok = isObj(d) && typeof d.id === 'string' && ID.test(d.id) && typeof d.title === 'string' && d.title.trim() && d.title.length <= 200
      && typeof d.text === 'string' && d.text.length <= 5000 && (d.kind === 'required' || d.kind === 'optional')
      && typeof d.order === 'number' && Number.isFinite(d.order) && validSchedule(d.schedule ?? null) && !seen.has(d.id as string);
    if (!ok) throw new Error(`Dua #${i + 1} is invalid or has a duplicate ID.`);
    seen.add((d as { id: string }).id);
  });
  j.completions.forEach((c, i) => {
    if (!isObj(c) || typeof c.duaId !== 'string' || !ID.test(c.duaId) || typeof c.dateKey !== 'string' || !DATE_RE.test(c.dateKey)) throw new Error(`Completion #${i + 1} is invalid.`);
  });
  const r = j.rotation;
  if (r != null && !(isObj(r) && Array.isArray(r.activeIds) && r.activeIds.length <= GROUP && r.activeIds.every(a => seen.has(a as string)) && Array.isArray(r.doneIds) && r.doneIds.every(a => (r.activeIds as unknown[]).includes(a))))
    throw new Error('Rotation must reference at most 5 imported duas.');
  return j as { duas: DuaInput[] & { id: string }[]; completions: { duaId: string; dateKey: string }[]; rotation: { activeIds: string[]; doneIds: string[] } | null; prefs?: { largeText?: boolean } };
}

