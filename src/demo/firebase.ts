// Demo-only stand-in for ./firebase. Not used by the real build.
export const auth = {};
export const db = {};
if (typeof document !== 'undefined') {
  const bar = document.createElement('div');
  bar.setAttribute('style', 'background:#fff4d6;color:#3a2f10;border-bottom:1px solid #b8892b;padding:8px 12px;font:14px system-ui,sans-serif;display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap');
  bar.innerHTML = '<span>Demo mode: sample data stored only in this browser. Any email and password works. Nothing is sent to Firebase.</span>';
  const b = document.createElement('button');
  b.textContent = 'Reset demo';
  b.setAttribute('style', 'font:inherit;padding:4px 10px;cursor:pointer');
  b.onclick = () => { try { localStorage.removeItem('dua-demo-v1'); } catch { /* ignore */ } location.reload(); };
  bar.appendChild(b);
  document.body.prepend(bar);
}
