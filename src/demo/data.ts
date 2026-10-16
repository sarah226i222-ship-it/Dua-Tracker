// Demo-only stand-in for ./data: same API, in-memory state persisted to localStorage.
import { useEffect, useState } from 'react';
import { addDays, cairoDateKey, isDue } from '../dates';
import { GROUP, validate } from '../validate';
import type { Completion, Dua, DuaInput, Prefs, Rotation } from '../types';
export { GROUP };

type Comp = { duaId: string; dateKey: string };
type S = { duas: Dua[]; comps: Comp[]; rot: Rotation | null; prefs: Prefs };
const K = 'dua-demo-v2';
const shift = (k: string, n: number) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10); };
const seed = (): S => {
  const t = cairoDateKey();
  const R = (id: string, title: string, text: string, schedule: Dua['schedule'], order: number): Dua => ({ id, title, text, kind: 'required', schedule, order });
  const O = (i: number, title: string, text: string): Dua => ({ id: 'opt' + i, title, text, kind: 'optional', schedule: null, order: 100 + i });
  const base: S = {
    duas: [
      R('r1', 'Morning remembrance (daily)', 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', { type: 'daily' }, 1),
      R('r2', 'Seeking forgiveness (daily)', 'أَسْتَغْفِرُ اللَّهَ', { type: 'daily' }, 2),
      R('r3', 'Friday blessings (weekly: Fri)', 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ', { type: 'weekly', days: [5] }, 3),
      R('r4', 'Every 3 days (due today)', 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', { type: 'everyN', n: 3, anchor: shift(t, 30) }, 4),
      R('r5', 'Every 2 days (not due today)', 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ', { type: 'everyN', n: 2, anchor: shift(t, 31) }, 5),
      O(1, 'Knowledge', 'رَبِّ زِدْنِي عِلْمًا'), O(2, 'Both worlds', 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ'),
      O(3, 'Ease', 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي'), O(4, 'Wellbeing', 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ'),
      O(5, 'Repentance', 'رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ'), O(6, 'Glorification', 'سُبْحَانَ اللَّهِ الْعَظِيمِ'),
      O(7, 'Oneness', 'لَا إِلَهَ إِلَّا اللَّهُ'), O(8, 'Reliance', 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ'),
    ],
    comps: [], rot: null, prefs: { largeText: false },
  };
  // Sample history so the dashboard has something to show.
  const req = base.duas.filter(d => d.kind === 'required');
  for (let i = 1; i <= 30; i++) {
    const key = addDays(t, -i);
    req.forEach((d, idx) => { if (isDue(d.schedule!, key) && (i * 7 + idx * 3) % 6 !== 0) base.comps.push({ duaId: d.id, dateKey: key }); });
    if (i % 2 === 0) base.comps.push({ duaId: 'opt' + (1 + (i % 8)), dateKey: key });
  }
  return base;
};
const load = (): S => { try { const r = localStorage.getItem(K); if (r) return JSON.parse(r) as S; } catch { /* ignore */ } return seed(); };
let s: S = load();
const ls = new Set<() => void>();
const set = (n: S) => { s = { ...n, duas: [...n.duas].sort((a, b) => a.order - b.order) }; try { localStorage.setItem(K, JSON.stringify(s)); } catch { /* ignore */ } ls.forEach(f => f()); };

export function useData(_uid: string, today: string) {
  const [, f] = useState(0);
  useEffect(() => { const l = () => f(x => x + 1); ls.add(l); return () => { ls.delete(l); }; }, []);
  return { duas: s.duas, history: s.comps as Completion[], done: new Set(s.comps.filter(c => c.dateKey === today).map(c => c.duaId)), rot: s.rot, prefs: s.prefs, fromCache: false, error: '', ready: true, retry: () => {} };
}

const nextGroup = (pool: Dua[], start: number) => pool.length ? Array.from({ length: Math.min(GROUP, pool.length) }, (_, i) => pool[(start + i) % pool.length].id) : [];
const startAfter = (pool: Dua[], active: string[]) => { const i = active.map(a => pool.findIndex(d => d.id === a)).filter(x => x >= 0); return i.length ? Math.max(...i) + 1 : 0; };

export async function ensureRotation(_u: string, pool: Dua[], expected: number | null) {
  if ((s.rot ? s.rot.cycle : null) !== expected) return;
  set({ ...s, rot: { activeIds: nextGroup(pool, s.rot ? startAfter(pool, s.rot.activeIds) : 0), doneIds: [], cycle: (s.rot?.cycle ?? 0) + 1 } });
}
export async function completeOptional(_u: string, id: string, key: string, pool: Dua[]) {
  const r = s.rot; if (!r) throw new Error('Optional group is not ready yet. Try again in a moment.');
  if (!r.activeIds.includes(id)) return;
  const ids = new Set(pool.map(d => d.id)); const active = r.activeIds.filter(a => ids.has(a));
  const doneIds = Array.from(new Set([...r.doneIds, id]));
  const comps = s.comps.some(c => c.duaId === id && c.dateKey === key) ? s.comps : [...s.comps, { duaId: id, dateKey: key }];
  const rot = active.every(a => doneIds.includes(a)) ? { activeIds: nextGroup(pool, startAfter(pool, active)), doneIds: [], cycle: r.cycle + 1 } : { ...r, doneIds };
  set({ ...s, comps, rot });
}
export async function setRequiredDone(_u: string, id: string, key: string, on: boolean) {
  const rest = s.comps.filter(c => !(c.duaId === id && c.dateKey === key));
  set({ ...s, comps: on ? [...rest, { duaId: id, dateKey: key }] : rest });
}
export async function saveDua(_u: string, v: DuaInput) {
  const id = v.id ?? Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  set({ ...s, duas: [...s.duas.filter(d => d.id !== id), { id, title: v.title, text: v.text, kind: v.kind, schedule: v.schedule, order: v.order }] });
}
export async function deleteDua(_u: string, id: string) { set({ ...s, duas: s.duas.filter(d => d.id !== id) }); }
export async function savePrefs(_u: string, p: Prefs) { set({ ...s, prefs: p }); }
export async function exportAll(_u: string) {
  return { version: 1, exportedAt: new Date().toISOString(), duas: s.duas.map(d => ({ id: d.id, title: d.title, text: d.text, kind: d.kind, schedule: d.schedule, order: d.order })), completions: s.comps, rotation: s.rot ? { activeIds: s.rot.activeIds, doneIds: s.rot.doneIds } : null, prefs: s.prefs };
}
export async function importAll(_u: string, raw: string) {
  const j = validate(raw);
  const incoming = j.duas.map(d => ({ id: d.id!, title: d.title, text: d.text, kind: d.kind, schedule: d.schedule ?? null, order: d.order }));
  const comps = [...s.comps]; j.completions.forEach(c => { if (!comps.some(x => x.duaId === c.duaId && x.dateKey === c.dateKey)) comps.push(c); });
  set({ duas: [...s.duas.filter(d => !incoming.some(x => x.id === d.id)), ...incoming], comps, rot: j.rotation ? { ...j.rotation, cycle: Date.now() } : s.rot, prefs: { largeText: !!j.prefs?.largeText } });
  return { duas: j.duas.length, completions: j.completions.length };
}
