import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';
import { db } from './firebase';
import { GROUP, validate } from './validate';
import { addDays, HISTORY_DAYS } from './dates';
export { GROUP };
import type { Completion, Dua, DuaInput, Prefs, Rotation } from './types';

const col = (uid: string, n: string) => collection(db, 'users', uid, n);
const rotRef = (uid: string) => doc(db, 'users', uid, 'settings', 'rotation');
const prefRef = (uid: string) => doc(db, 'users', uid, 'settings', 'prefs');
/** Deterministic ID: one completion per dua per day, so duplicates are impossible. */
const compRef = (uid: string, duaId: string, key: string) => doc(col(uid, 'completions'), `${duaId}_${key}`);

export function useData(uid: string, today: string) {
  const [duas, setDuas] = useState<Dua[]>([]);
  const [history, setHistory] = useState<Completion[]>([]);
  const [rot, setRot] = useState<Rotation | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ largeText: false });
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setError('');
    const fail = (e: Error) => setError(e.message);
    const mark = (k: string) => setLoaded(l => (l[k] ? l : { ...l, [k]: true }));
    const subs = [
      onSnapshot(query(col(uid, 'duas'), orderBy('order')), s => {
        setDuas(s.docs.map(d => ({ id: d.id, ...d.data() }) as Dua)); setFromCache(s.metadata.fromCache); mark('d');
      }, fail),
      onSnapshot(query(col(uid, 'completions'), where('dateKey', '>=', addDays(today, -(HISTORY_DAYS - 1)))), s => {
        setHistory(s.docs.map(d => ({ duaId: d.data().duaId, dateKey: d.data().dateKey }) as Completion)); mark('c');
      }, fail),
      onSnapshot(rotRef(uid), s => { setRot(s.exists() ? (s.data() as Rotation) : null); mark('r'); }, fail),
      onSnapshot(prefRef(uid), s => { if (s.exists()) setPrefs({ largeText: !!s.data().largeText }); mark('p'); }, fail),
    ];
    return () => subs.forEach(u => u());
  }, [uid, today, attempt]);
  return { duas, history, done: new Set(history.filter(c => c.dateKey === today).map(c => c.duaId)), rot, prefs, fromCache, error, ready: !!(loaded.d && loaded.c && loaded.r && loaded.p), retry: () => { setLoaded({}); setAttempt(a => a + 1); } };
}

const nextGroup = (pool: Dua[], start: number) => {
  if (!pool.length) return [];
  return Array.from({ length: Math.min(GROUP, pool.length) }, (_, i) => pool[(start + i) % pool.length].id);
};
const startAfter = (pool: Dua[], active: string[]) => {
  const idx = active.map(a => pool.findIndex(d => d.id === a)).filter(i => i >= 0);
  return idx.length ? Math.max(...idx) + 1 : 0;
};

/** Creates/advances the group only if `cycle` still equals what this device saw, so two devices can't both advance it. */
export function ensureRotation(uid: string, pool: Dua[], expected: number | null) {
  return runTransaction(db, async tx => {
    const snap = await tx.get(rotRef(uid));
    const cur = snap.exists() ? (snap.data() as Rotation) : null;
    if ((cur ? cur.cycle : null) !== expected) return;
    tx.set(rotRef(uid), { activeIds: nextGroup(pool, cur ? startAfter(pool, cur.activeIds) : 0), doneIds: [], cycle: (cur?.cycle ?? 0) + 1, updatedAt: serverTimestamp() });
  });
}

/** Marks one optional dua done and, in the same transaction, advances the group once all are done. Needs a connection by design. */
export function completeOptional(uid: string, id: string, key: string, pool: Dua[]) {
  return runTransaction(db, async tx => {
    const rs = await tx.get(rotRef(uid));
    const cs = await tx.get(compRef(uid, id, key));
    if (!rs.exists()) throw new Error('Optional group is not ready yet. Try again in a moment.');
    const r = rs.data() as Rotation;
    if (!r.activeIds.includes(id)) return;
    const ids = new Set(pool.map(d => d.id));
    const active = r.activeIds.filter(a => ids.has(a));
    const doneIds = Array.from(new Set([...r.doneIds, id]));
    if (!cs.exists()) tx.set(cs.ref, { duaId: id, dateKey: key, completedAt: serverTimestamp() });
    if (active.every(a => doneIds.includes(a))) {
      tx.set(rotRef(uid), { activeIds: nextGroup(pool, startAfter(pool, active)), doneIds: [], cycle: r.cycle + 1, updatedAt: serverTimestamp() });
    } else tx.update(rotRef(uid), { doneIds, updatedAt: serverTimestamp() });
  });
}

export const setRequiredDone = (uid: string, id: string, key: string, on: boolean) =>
  on ? setDoc(compRef(uid, id, key), { duaId: id, dateKey: key, completedAt: serverTimestamp() }) : deleteDoc(compRef(uid, id, key));
export const saveDua = (uid: string, v: DuaInput) =>
  setDoc(v.id ? doc(col(uid, 'duas'), v.id) : doc(col(uid, 'duas')), { title: v.title, text: v.text, kind: v.kind, schedule: v.schedule, order: v.order, updatedAt: serverTimestamp() });
export const deleteDua = (uid: string, id: string) => deleteDoc(doc(col(uid, 'duas'), id));
export const savePrefs = (uid: string, p: Prefs) => setDoc(prefRef(uid), p);

/* ---------- Export / import ---------- */
export async function exportAll(uid: string) {
  const [d, c, r, p] = await Promise.all([getDocs(col(uid, 'duas')), getDocs(col(uid, 'completions')), getDoc(rotRef(uid)), getDoc(prefRef(uid))]);
  return {
    version: 1, exportedAt: new Date().toISOString(),
    duas: d.docs.map(x => { const v = x.data(); return { id: x.id, title: v.title, text: v.text, kind: v.kind, schedule: v.schedule ?? null, order: v.order }; }),
    completions: c.docs.map(x => ({ duaId: x.data().duaId, dateKey: x.data().dateKey })),
    rotation: r.exists() ? { activeIds: r.data()!.activeIds, doneIds: r.data()!.doneIds } : null,
    prefs: { largeText: p.exists() ? !!p.data()!.largeText : false },
  };
}

/** Merges into the account; same IDs are overwritten, so re-importing is safe. */
export async function importAll(uid: string, raw: string) {
  const j = validate(raw);
  const ops: [DocumentReference, object][] = [
    ...j.duas.map(d => [doc(col(uid, 'duas'), d.id!), { title: d.title, text: d.text, kind: d.kind, schedule: d.schedule ?? null, order: d.order, updatedAt: serverTimestamp() }] as [DocumentReference, object]),
    ...j.completions.map(c => [compRef(uid, c.duaId, c.dateKey), { duaId: c.duaId, dateKey: c.dateKey, completedAt: serverTimestamp() }] as [DocumentReference, object]),
    [prefRef(uid), { largeText: !!j.prefs?.largeText }],
  ];
  if (j.rotation) ops.push([rotRef(uid), { activeIds: j.rotation.activeIds, doneIds: j.rotation.doneIds, cycle: Date.now(), updatedAt: serverTimestamp() }]);
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(([ref, data]) => b.set(ref, data));
    await b.commit();
  }
  return { duas: j.duas.length, completions: j.completions.length };
}
