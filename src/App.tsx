import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './firebase';
import { cairoDateKey, HISTORY_DAYS, isDue, weekday } from './dates';
import { computeStats } from './stats';
import type { Stats } from './stats';
import * as D from './data';
import type { Dua, DuaInput, Schedule } from './types';

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <main><p className="note">Loading…</p></main>;
  return user ? <Main user={user} /> : <SignIn />;
}

function SignIn() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [up, setUp] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await (up ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, email, pw); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return <main><h1>Dua Tracker</h1>
    <form className="f" onSubmit={submit}>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
      <input type="password" placeholder="Password (6+ characters)" value={pw} onChange={e => setPw(e.target.value)} required minLength={6} autoComplete={up ? 'new-password' : 'current-password'} />
      {err && <div className="banner err" role="alert">{err}</div>}
      <button className="btn" disabled={busy}>{up ? 'Create account' : 'Sign in'}</button>
      <button type="button" className="btn alt" onClick={() => setUp(!up)}>{up ? 'I already have an account' : 'Create a new account'}</button>
    </form></main>;
}

type Tab = 'today' | 'dashboard' | 'library' | 'backup';
const TABS: Tab[] = ['today', 'dashboard', 'library', 'backup'];
const LABEL: Record<Tab, string> = { today: 'Today', dashboard: 'Dashboard', library: 'Library', backup: 'Backup' };
const sty = (n: number) => ({ '--n': Math.min(n, 12) }) as CSSProperties;
function Main({ user }: { user: User }) {
  const uid = user.uid;
  const [today, setToday] = useState(cairoDateKey());
  useEffect(() => { const t = setInterval(() => setToday(cairoDateKey()), 30000); return () => clearInterval(t); }, []);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOnline(true), b = () => setOnline(false);
    addEventListener('online', a); addEventListener('offline', b);
    return () => { removeEventListener('online', a); removeEventListener('offline', b); };
  }, []);
  const d = D.useData(uid, today);
  const [tab, setTab] = useState<Tab>('today');
  const [actErr, setActErr] = useState('');
  const run = (p: Promise<unknown>) => { setActErr(''); p.catch(e => setActErr((e as Error).message)); };

  const pool = useMemo(() => d.duas.filter(x => x.kind === 'optional'), [d.duas]);
  const due = useMemo(() => d.duas.filter(x => x.kind === 'required' && x.schedule && isDue(x.schedule, today)), [d.duas, today]);
  const byId = useMemo(() => new Map(pool.map(x => [x.id, x])), [pool]);
  const active = (d.rot?.activeIds ?? []).map(id => byId.get(id)).filter(Boolean) as Dua[];
  const doneSet = new Set(d.rot?.doneIds ?? []);
  const stats = useMemo(() => computeStats(d.duas, d.history, today, HISTORY_DAYS), [d.duas, d.history, today]);

  useEffect(() => {
    if (!d.ready || !pool.length) return;
    if (d.rot === null) run(D.ensureRotation(uid, pool, null));
    else if (d.rot && active.length === 0) run(D.ensureRotation(uid, pool, d.rot.cycle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.ready, d.rot?.cycle, pool.length]);

  return <main className={d.prefs.largeText ? 'large' : ''}>
    <header><h1><svg className="moon" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M22 4a13 13 0 1 0 6 21 11 11 0 0 1-6-21z" fill="var(--gold)" /></svg>Dua Tracker</h1><button className="btn alt" onClick={() => signOut(auth)}>Sign out</button></header>
    <p className="note">{today} · Cairo</p>
    {!online && <div className="banner">You are offline. Required checkmarks and edits are saved on this device and will sync when you reconnect. Optional-group completion needs a connection.</div>}
    {online && d.fromCache && d.ready && <div className="banner">Showing saved data while connecting…</div>}
    {d.error && <div className="banner err" role="alert">Could not load your data: {d.error} <button className="btn alt" onClick={d.retry}>Retry</button></div>}
    {actErr && <div className="banner err" role="alert">{actErr}</div>}
    <nav style={{ '--i': TABS.indexOf(tab) } as CSSProperties}><i className="ind" aria-hidden="true" />{TABS.map(t => <button key={t} aria-current={tab === t} onClick={() => setTab(t)}>{LABEL[t]}</button>)}</nav>
    {!d.ready && !d.error ? <p className="note">Loading your duas…</p> : <div className="pane" key={tab}>
      {tab === 'today' && <>
        <h2>Required today <small>{due.filter(x => d.done.has(x.id)).length} of {due.length}</small></h2>
        {due.length === 0 && <p className="note">{d.duas.some(x => x.kind === 'required') ? 'No required duas are due today.' : 'No required duas yet. Add one in the Library.'}</p>}
        {due.map((x, i) => <div key={x.id} style={sty(i)} className={'item' + (d.done.has(x.id) ? ' done' : '')}>
          <input className="chk" type="checkbox" aria-label={`Mark ${x.title} done`} checked={d.done.has(x.id)} onChange={() => run(D.setRequiredDone(uid, x.id, today, !d.done.has(x.id)))} />
          <div className="grow"><div className="t">{x.title}</div><p className="dua" dir="auto">{x.text}</p></div></div>)}
        <h2>Optional group <small>{active.filter(x => doneSet.has(x.id)).length} of {active.length}</small></h2>
        {pool.length === 0 && <p className="note">No optional duas yet. Add some in the Library.</p>}
        {pool.length > 0 && active.length === 0 && <p className="note">Preparing your group…</p>}
        {active.map((x, i) => <div key={x.id} style={sty(i)} className={'item' + (doneSet.has(x.id) ? ' done' : '')}>
          <div className="grow"><div className="t">{x.title}</div><p className="dua" dir="auto">{x.text}</p></div>
          <button className="btn" disabled={doneSet.has(x.id) || !online} onClick={() => run(D.completeOptional(uid, x.id, today, pool))}>{doneSet.has(x.id) ? 'Done ✓' : 'Mark done'}</button></div>)}
      </>}
      {tab === 'dashboard' && <Dashboard stats={stats} active={active} doneSet={doneSet} />}
      {tab === 'library' && <Library uid={uid} duas={d.duas} today={today} run={run} />}
      {tab === 'backup' && <>
        <label className="row"><input className="chk" type="checkbox" checked={d.prefs.largeText} onChange={e => run(D.savePrefs(uid, { largeText: e.target.checked }))} /> Larger dua text</label>
        <Backup uid={uid} />
      </>}
    </div>}
  </main>;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function describe(s: Schedule | null) {
  if (!s) return 'Optional';
  return s.type === 'daily' ? 'Daily' : s.type === 'weekly' ? s.days.map(i => DAYS[i]).join(', ') : `Every ${s.n} days`;
}

function Library({ uid, duas, today, run }: { uid: string; duas: Dua[]; today: string; run: (p: Promise<unknown>) => void }) {
  const [q, setQ] = useState(''); const [limit, setLimit] = useState(50); const [edit, setEdit] = useState<Dua | null>(null); const [n, setN] = useState(0);
  const shown = useMemo(() => { const s = q.trim().toLowerCase(); return s ? duas.filter(x => (x.title + ' ' + x.text).toLowerCase().includes(s)) : duas; }, [duas, q]);
  const maxOrder = duas.reduce((m, x) => Math.max(m, x.order), 0);
  return <>
    <DuaForm key={`${edit?.id ?? 'new'}-${n}`} initial={edit} nextOrder={maxOrder + 1} today={today}
      onSave={v => { run(D.saveDua(uid, v)); setEdit(null); setN(n + 1); }} onCancel={() => setEdit(null)} />
    <input type="search" placeholder="Search duas" value={q} onChange={e => setQ(e.target.value)} />
    <p className="note">{shown.length} of {duas.length} duas</p>
    {duas.length === 0 && <p className="note">Your library is empty. Add your first dua above.</p>}
    {shown.slice(0, limit).map(x => <div className="item" key={x.id}>
      <div className="grow"><div className="t">{x.title}</div><div className="note">{describe(x.schedule)} · order {x.order}</div></div>
      <button className="btn alt" onClick={() => { setEdit(x); scrollTo(0, 0); }}>Edit</button>
      <button className="btn alt" onClick={() => confirm(`Delete "${x.title}"?`) && run(D.deleteDua(uid, x.id))}>Delete</button></div>)}
    {shown.length > limit && <button className="btn alt" onClick={() => setLimit(limit + 50)}>Show more</button>}
  </>;
}

function DuaForm({ initial, nextOrder, today, onSave, onCancel }: { initial: Dua | null; nextOrder: number; today: string; onSave: (v: DuaInput) => void; onCancel: () => void }) {
  const s0 = initial?.schedule ?? null;
  const [title, setTitle] = useState(initial?.title ?? ''); const [text, setText] = useState(initial?.text ?? '');
  const [kind, setKind] = useState<Dua['kind']>(initial?.kind ?? 'required');
  const [st, setSt] = useState<Schedule['type']>(s0?.type ?? 'daily');
  const [days, setDays] = useState<number[]>(s0?.type === 'weekly' ? s0.days : []);
  const [every, setEvery] = useState(s0?.type === 'everyN' ? s0.n : 2);
  const [order, setOrder] = useState(initial?.order ?? nextOrder);
  const req = kind === 'required';
  const valid = title.trim() && (!req || st !== 'weekly' || days.length > 0) && (!req || st !== 'everyN' || (Number.isInteger(every) && every >= 1 && every <= 365)) && Number.isFinite(order);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    let schedule: Schedule | null = null;
    if (req) schedule = st === 'daily' ? { type: 'daily' } : st === 'weekly' ? { type: 'weekly', days: [...days].sort() } : { type: 'everyN', n: every, anchor: s0?.type === 'everyN' ? s0.anchor : today };
    onSave({ id: initial?.id, title: title.trim(), text, kind, schedule, order });
  };
  return <form className="f" onSubmit={submit}>
    <strong>{initial ? 'Edit dua' : 'Add a dua'}</strong>
    <input type="text" placeholder="Title" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} />
    <textarea dir="auto" rows={3} placeholder="Dua text" value={text} maxLength={5000} onChange={e => setText(e.target.value)} />
    <div className="row">
      <label><input type="radio" checked={req} onChange={() => setKind('required')} /> Required</label>
      <label><input type="radio" checked={!req} onChange={() => setKind('optional')} /> Optional (rotating pool)</label>
    </div>
    {req && <div className="row">
      <select value={st} onChange={e => setSt(e.target.value as Schedule['type'])}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="everyN">Every N days</option></select>
      {st === 'weekly' && DAYS.map((l, i) => <label key={l}><input type="checkbox" checked={days.includes(i)} onChange={e => setDays(e.target.checked ? [...days, i] : days.filter(x => x !== i))} /> {l}</label>)}
      {st === 'everyN' && <label>Every <input style={{ width: 80 }} type="number" min={1} max={365} value={every} onChange={e => setEvery(Number(e.target.value))} /> days</label>}
    </div>}
    <label>Order <input style={{ width: 120 }} type="number" value={order} onChange={e => setOrder(Number(e.target.value))} /></label>
    <div className="row"><button className="btn" disabled={!valid}>{initial ? 'Save changes' : 'Add dua'}</button>{initial && <button type="button" className="btn alt" onClick={onCancel}>Cancel</button>}</div>
  </form>;
}

function Backup({ uid }: { uid: string }) {
  const [msg, setMsg] = useState('');
  const exp = async () => {
    try {
      const j = await D.exportAll(uid);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' }));
      a.download = `duas-${cairoDateKey()}.json`; a.click(); setMsg(`Exported ${j.duas.length} duas.`);
    } catch (e) { setMsg((e as Error).message); }
  };
  const imp = async (f?: File) => {
    if (!f || !confirm('Import merges into your account and overwrites items that share an ID. Continue?')) return;
    try { const r = await D.importAll(uid, await f.text()); setMsg(`Imported ${r.duas} duas and ${r.completions} completions.`); }
    catch (e) { setMsg(`Import failed: ${(e as Error).message}`); }
  };
  return <>
    <h2>Backup and restore</h2>
    <div className="row"><button className="btn" onClick={exp}>Export JSON</button>
      <label className="btn alt">Import JSON<input type="file" accept="application/json" hidden onChange={e => { imp(e.target.files?.[0]); e.target.value = ''; }} /></label></div>
    {msg && <p role="status">{msg}</p>}
  </>;
}

function Ring({ done, due }: { done: number; due: number }) {
  const [p, setP] = useState(0);
  const target = due ? done / due : 0;
  useEffect(() => { const t = setTimeout(() => setP(target), 60); return () => clearTimeout(t); }, [target]);
  const C = 2 * Math.PI * 52;
  return <div className="ring">
    <svg viewBox="0 0 120 120" width="150" height="150" role="img" aria-label={`${done} of ${due} required duas done today`}>
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--soft)" strokeWidth="12" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gold)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.3,1.2,.5,1)' }} />
    </svg>
    <div className="rt"><b>{due ? `${done}/${due}` : '–'}</b><span>{due ? (done === due ? 'all done' : 'today') : 'nothing due'}</span></div>
  </div>;
}

function Dashboard({ stats, active, doneSet }: { stats: Stats; active: Dua[]; doneSet: Set<string> }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 60); return () => clearTimeout(t); }, []);
  const t = stats.days[stats.days.length - 1];
  const msg = t.due === 0 ? 'Nothing required today. Enjoy the quiet.' : t.done === t.due ? 'Everything for today is done. Well done.' : `${t.due - t.done} to go today.`;
  const tiles: [string, string][] = [[`${stats.streak}`, 'day streak'], [`${stats.best}`, 'best streak'], [`${Math.round(stats.rate * 100)}%`, `of required, last ${HISTORY_DAYS} days`], [`${stats.optional}`, 'optional duas finished']];
  const doneN = active.filter(x => doneSet.has(x.id)).length;
  return <>
    <section className="card hero"><Ring done={t.done} due={t.due} /><div><h3>Required today</h3><p className="note">{msg}</p></div></section>
    <div className="tiles">{tiles.map(([v, l], i) => <div className="card tile" key={l} style={sty(i)}><b>{v}</b><span>{l}</span></div>)}</div>
    <p className="note small">A day counts toward your streak when every required dua due that day was done. Days with nothing due are skipped.</p>
    <section className="card"><h3>Last 14 days</h3>
      <div className="bars">{stats.days.slice(-14).map((d, i) => <div className="col" key={d.key} title={`${d.key}: ${d.due ? `${d.done} of ${d.due}` : 'nothing due'}`}>
        <div className={'bar' + (d.ratio === null ? ' off' : '')} style={{ ...sty(i), height: on ? `${d.ratio === null ? 4 : Math.max(7, d.ratio * 100)}%` : '0%' }} /><span>{DAYS[weekday(d.key)][0]}</span></div>)}</div></section>
    <section className="card"><h3>Your garden <small>last {HISTORY_DAYS} days, oldest first</small></h3>
      <div className="garden">{stats.days.map((d, i) => <div key={d.key} className={'cell' + (i === stats.days.length - 1 ? ' now' : '')} title={`${d.key}: ${d.due ? `${d.done} of ${d.due}` : 'nothing due'}`}
        style={{ '--r': d.ratio ?? 0, '--n': i, opacity: on ? 1 : 0 } as CSSProperties} />)}</div></section>
    <section className="card"><h3>Optional group</h3>
      {active.length === 0 ? <p className="note">No optional group yet.</p> : <>
        <div className="dots">{active.map(x => <i key={x.id} className={'dot' + (doneSet.has(x.id) ? ' on' : '')} title={x.title} />)}</div>
        <p className="note">{doneN} of {active.length} done in this group.</p></>}</section>
  </>;
}
