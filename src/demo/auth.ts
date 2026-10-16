// Demo-only stand-in for firebase/auth.
export interface User { uid: string; email: string | null }
let cur: User | null = null;
const ls = new Set<(u: User | null) => void>();
const emit = () => ls.forEach(f => f(cur));
export const onAuthStateChanged = (_a: unknown, cb: (u: User | null) => void) => { ls.add(cb); queueMicrotask(() => cb(cur)); return () => { ls.delete(cb); }; };
const login = async (_a: unknown, email: string) => { cur = { uid: 'demo', email }; emit(); return { user: cur }; };
export const signInWithEmailAndPassword = login;
export const createUserWithEmailAndPassword = login;
export const signOut = async () => { cur = null; emit(); };
