/* hit100 — 학원용 모의고사 채점·분석·보고서 (전 과목) */
(() => {
'use strict';
const CFG = window.APP_CONFIG || {};
const DEMO = !(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
const root = document.getElementById('root');
const SRC = '<!DOCTYPE html>\n' + document.documentElement.outerHTML.replace(/ data-theme="(light|dark)"/, '').replace(/ class="fs-[sl]"/, '');

/* ---------- 공통 ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c === 'x' ? r : (r&3|8)).toString(16); }));
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = s => s ? String(s).replace(/-/g, '.') : '-';
const CIRC = ['–', '①', '②', '③', '④', '⑤'];
const CAUSES = ['개념 부족', '지문 이해', '선지 판단', '시간 부족', '실수'];
const ATT = ['성실하게 응시', '시간 부족', '시간 여유 있음', '집중력 저하', '검토 미흡', '마킹 실수'];
const KINDS = ['학평', '모평', '수능', '사설', '기타'];
function toast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1800); }
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); toast('복사했어요'); return; } catch (e) {}
  const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('복사했어요'); } catch (e) { toast('복사하지 못했어요'); }
  ta.remove();
}
const IC = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5"/>',
  file: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h6"/>',
  pen: '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M17 6l3 3M14 9l2 2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'
};
const icon = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;
const initial = n => esc(String(n || '?').trim().charAt(0) || '?');
function applyTheme(t) { const r = document.documentElement; if (t === 'light' || t === 'dark') r.dataset.theme = t; else delete r.dataset.theme; }
function curDark() { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
const FONTS = {heir: ['빛의 계승자', '', 'HeirofLight'],
  pre: ['Pretendard', 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css', '"Pretendard Variable",Pretendard'],
  suit: ['SUIT', 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css', '"SUIT Variable",SUIT'],
  round: ['나눔스퀘어라운드', 'https://hangeul.pstatic.net/hangeul_static/css/nanum-square-round.css', 'NanumSquareRound'],
  noto: ['본고딕(Noto)', 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap', '"Noto Sans KR"'],
  gowun: ['고운돋움', 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap', '"Gowun Dodum"']};
function applyFont(k) { const f = FONTS[k] || FONTS.heir, l = document.getElementById('font-css'); if (l && f[1]) l.href = f[1]; document.documentElement.style.setProperty('--font', f[2] + ',"Pretendard Variable",Pretendard'); }
function applyFs(f) { const r = document.documentElement; r.classList.remove('fs-s', 'fs-l'); if (f === 's' || f === 'l') r.classList.add('fs-' + f); }
const nums = s => String(s || '').split(/[^0-9]+/).filter(Boolean).map(Number);

/* ---------- 과목 · 시험 구조 ----------
   시험 하나 = 과목(subject) + 문항 구조(layout: 총 문항 수, 공통 문항 수, 선택과목 목록)
   + 선지 수, 기본 배점, 3점/4점 문항, 단답형 문항, 정답, 등급 방식, 등급컷, 영역. */
const SUBJECTS = {kor: '국어', math: '수학', eng: '영어', hist: '한국사', inq: '탐구', etc: '기타'};
const KOR_TR = {hj: '화작', em: '언매'};
const ABS_ENG = [90, 80, 70, 60, 50, 40, 30, 20], ABS_HIST = [40, 35, 30, 25, 20, 15, 10, 5];
function template(subj) {
  const mt = [['pr', '확통'], ['ca', '미적'], ['ge', '기하']];
  const T = {
    kor: {layout: {qcount: 45, common: 34, tracks: [{id: 'hj', name: '화작'}, {id: 'em', name: '언매'}]}, choices: 5, defPts: 2, max: 100, grading: 'relative',
      p3: {common: [], hj: [], em: []}, p4: {}, short: {}, areas: {common: '독서:1-17, 문학:18-34', hj: '화작:35-45', em: '언어:35-39, 매체:40-45'}, cuts: {hj: [], em: []}},
    math: {layout: {qcount: 30, common: 22, tracks: mt.map(([id, name]) => ({id, name}))}, choices: 5, defPts: 2, max: 100, grading: 'relative',
      p3: Object.assign({common: [3, 4, 5, 6, 7, 8, 16, 17, 18, 19]}, ...mt.map(([id]) => ({[id]: [24, 25, 26, 27]}))),
      p4: Object.assign({common: [9, 10, 11, 12, 13, 14, 15, 20, 21, 22]}, ...mt.map(([id]) => ({[id]: [28, 29, 30]}))),
      short: Object.assign({common: [16, 17, 18, 19, 20, 21, 22]}, ...mt.map(([id]) => ({[id]: [29, 30]}))),
      areas: Object.assign({common: '공통(수학Ⅰ·Ⅱ):1-22'}, ...mt.map(([id, n]) => ({[id]: n + ':23-30'}))), cuts: Object.assign({}, ...mt.map(([id]) => ({[id]: []})))},
    eng: {layout: {qcount: 45, common: 45, tracks: []}, choices: 5, defPts: 2, max: 100, grading: 'absolute', p3: {common: []}, p4: {}, short: {}, areas: {common: '듣기:1-17, 독해:18-45'}, cuts: {all: ABS_ENG.slice()}},
    hist: {layout: {qcount: 20, common: 20, tracks: []}, choices: 5, defPts: 2, max: 50, grading: 'absolute', p3: {common: []}, p4: {}, short: {}, areas: {common: '한국사:1-20'}, cuts: {all: ABS_HIST.slice()}},
    inq: {layout: {qcount: 20, common: 20, tracks: []}, choices: 5, defPts: 2, max: 50, grading: 'relative', p3: {common: []}, p4: {}, short: {}, areas: {common: '탐구:1-20'}, cuts: {all: []}},
    etc: {layout: {qcount: 20, common: 20, tracks: []}, choices: 5, defPts: 5, max: 100, grading: 'none', p3: {common: []}, p4: {}, short: {}, areas: {common: '전체:1-20'}, cuts: {all: []}}
  };
  return JSON.parse(JSON.stringify({subject: subj, subname: '', ...(T[subj] || T.etc)}));
}
/* 예전(국어 전용) 시험 데이터를 새 구조로 맞춘다 */
function normalizeExam(e) {
  if (!e) return e;
  if (e.spec && typeof e.spec === 'object') { Object.assign(e, e.spec); delete e.spec; }
  if (!e.layout) {
    const split = (e.tracks || ['hj', 'em']).includes('hj');
    e.layout = split ? {qcount: 45, common: 34, tracks: [{id: 'hj', name: '화작'}, {id: 'em', name: '언매'}]} : {qcount: 45, common: 45, tracks: []};
    e.subject = e.subject || 'kor'; e.choices = e.choices || 5; e.defPts = e.defPts || 2; e.max = e.max || 100; e.grading = e.grading || 'relative';
    e.p3 = e.p3 || e.points3 || {}; e.p4 = e.p4 || {}; e.short = e.short || {};
  }
  e.subject = e.subject || 'kor'; e.subname = e.subname || '';
  e.key = e.key || {}; e.cuts = e.cuts || {}; e.areas = e.areas || {}; e.p3 = e.p3 || {}; e.p4 = e.p4 || {}; e.short = e.short || {}; e.ext_rates = e.ext_rates || {}; e.types = e.types || {};
  e.choices = +e.choices || 5; e.defPts = +e.defPts || 2; e.max = +e.max || 100; e.grading = e.grading || 'relative';
  return e;
}
const SPEC_KEYS = ['subject', 'subname', 'layout', 'choices', 'defPts', 'max', 'grading', 'p3', 'p4', 'short', 'types'];
function examToRow(e) { const r = {id: e.id, academy_id: e.academy_id || null, title: e.title, year: e.year, grade: e.grade, month: e.month, kind: e.kind, key: e.key, cuts: e.cuts, areas: e.areas, ext_rates: e.ext_rates, source: e.source || '', spec: {}}; SPEC_KEYS.forEach(k => r.spec[k] = e[k]); return r; }

const QN = e => e.layout.qcount;
const commonLen = e => Math.min(e.layout.common, e.layout.qcount);
const isSplit = e => (e.layout.tracks || []).length > 0 && commonLen(e) < QN(e);
const trackIds = e => isSplit(e) ? e.layout.tracks.map(t => t.id) : [];
const trackFor = (e, want) => isSplit(e) ? (trackIds(e).includes(want) ? want : trackIds(e)[0]) : 'all';
const trackName = (e, tr) => { if (tr === 'all') return ''; const t = (e.layout.tracks || []).find(x => x.id === tr); return t ? t.name : (KOR_TR[tr] || tr); };
const examSubj = e => SUBJECTS[e.subject] + (e.subname ? ' ' + e.subname : '');
function secOf(e, tr, q) { const c = commonLen(e); return q <= c ? ['common', q - 1] : [tr, q - c - 1]; }
function keyOf(e, tr, q) { const [s, i] = secOf(e, tr, q), v = (e.key[s] || [])[i]; return v === null || v === undefined || v === '' ? null : Number(v); }
function hasKey(e, tr) { for (let q = 1; q <= QN(e); q++) if (keyOf(e, tr, q) === null) return false; return true; }
const inSec = (e, obj, tr, q) => { const s = secOf(e, tr, q)[0]; return ((obj || {})[s] || []).map(Number).includes(q); };
const isShort = (e, tr, q) => inSec(e, e.short, tr, q);
const pts = (e, tr, q) => inSec(e, e.p4, tr, q) ? 4 : inSec(e, e.p3, tr, q) ? 3 : e.defPts;
function totalPts(e, tr) { let t = 0; for (let q = 1; q <= QN(e); q++) t += pts(e, tr, q); return t; }
const fmtAns = (e, tr, q, v) => v === null || v === undefined || v === '' ? '–' : isShort(e, tr, q) ? String(v) : (CIRC[v] || String(v));
function parseAreas(s) { return String(s || '').split(',').map(x => { const m = x.trim().match(/^(.+?)\s*:\s*(\d+)\s*-\s*(\d+)$/); return m ? {n: m[1].trim(), a: +m[2], b: +m[3]} : null; }).filter(Boolean); }
function areasOf(e, tr) { return [...parseAreas(e.areas.common), ...(tr === 'all' ? [] : parseAreas(e.areas[tr]))]; }
function areaOf(e, tr, q) { const a = areasOf(e, tr).find(x => q >= x.a && q <= x.b); return a ? a.n : '-'; }
function cutsOf(e, tr) { return ((e.grading === 'absolute' || !isSplit(e) ? e.cuts.all : e.cuts[tr]) || []).map(Number); }
function gradeOf(e, tr, score) { if (e.grading === 'none') return null; const c = cutsOf(e, tr); if (!c.some(x => x > 0)) return null; for (let i = 0; i < 8; i++) if (c[i] > 0 && score >= c[i]) return i + 1; return 9; }
function adjCuts(e, tr, g) {
  if (e.grading === 'none') return '등급 없음';
  const c = cutsOf(e, tr); if (!g) return '등급컷 미입력';
  if (g === 1) return `1등급 ${c[0]} · 2등급 ${c[1]}`;
  if (g === 9) return `8등급 ${c[7]}`;
  return `${g-1}등급 ${c[g-2]} · ${g}등급 ${c[g-1]}`;
}
function wrongOf(e, tr, a) {
  const n = QN(e);
  if (a.mode === 'answers' && hasKey(e, tr)) { const w = []; for (let q = 1; q <= n; q++) { const v = (a.answers || [])[q-1]; if (v === null || v === undefined || v === '' || Number(v) !== keyOf(e, tr, q)) w.push(q); } return w; }
  return [...new Set((a.wrong || []).map(Number))].filter(q => q >= 1 && q <= n).sort((x, y) => x - y);
}
const scoreOf = (e, tr, wrong) => totalPts(e, tr) - wrong.reduce((s, q) => s + pts(e, tr, q), 0);
function areaCounts(e, tr, wrong) { return areasOf(e, tr).map(a => ({n: a.n, total: a.b - a.a + 1, c: wrong.filter(q => q >= a.a && q <= a.b).length})); }
function evalAttempt(a) {
  const e = examById(a.exam_id); if (!e) return null;
  const tr = trackFor(e, a.subject), wrong = wrongOf(e, tr, a), score = scoreOf(e, tr, wrong), g = gradeOf(e, tr, score);
  return {e, tr, wrong, score, g, adj: adjCuts(e, tr, g), areas: areaCounts(e, tr, wrong), total: totalPts(e, tr)};
}
const sk = (e, tr, q) => q > commonLen(e) ? tr + ':' + q : String(q);
function examStats(e) {
  const m = {}, atts = S.attempts.filter(a => a.exam_id === e.id && a.status === 'done');
  for (const a of atts) {
    const tr = trackFor(e, a.subject), w = new Set(wrongOf(e, tr, a));
    for (let q = 1; q <= QN(e); q++) {
      const k = sk(e, tr, q), o = m[k] || (m[k] = {n: 0, w: 0, ch: [0, 0, 0, 0, 0, 0]});
      o.n++; if (w.has(q)) o.w++;
      if (a.mode === 'answers' && !isShort(e, tr, q)) { const v = Number((a.answers || [])[q-1]); o.ch[v >= 1 && v <= 5 ? v : 0]++; }
    }
  }
  return {m, n: atts.length, atts};
}
function diff(e, tr, q, st) {
  const k = sk(e, tr, q), ext = e.ext_rates[k];
  if (ext !== undefined && ext !== null && ext !== '') { const r = 100 - Number(ext); return {rate: r, src: '외부', lv: lvOf(r)}; }
  const o = st && st.m[k];
  if (o && o.n >= 3) { const r = (o.n - o.w) / o.n * 100; return {rate: r, src: '학원', lv: lvOf(r), n: o.n}; }
  return {rate: null, src: '', lv: 'n'};
}
const lvOf = r => r < 50 ? '상' : r < 80 ? '중' : '하';
const lvBadge = d => `<span class="lv ${d.lv}" title="${d.rate == null ? '데이터 부족' : `정답률 ${Math.round(d.rate)}% (${d.src})`}">${d.lv === 'n' ? '–' : d.lv}</span>`;
/* 학생이 과목별로 고른 선택과목 기억 */
function prefTrack(s, e) { if (!s || !isSplit(e)) return trackFor(e, null); const p = e.subject === 'kor' ? s.subject : (s.tracks || {})[e.subject]; return trackFor(e, p); }

/* ---------- 로그인 유지 설정 ----------
   자동 로그인을 켜면 로그인 정보를 localStorage(앱을 껐다 켜도 유지),
   끄면 sessionStorage(창을 닫으면 로그아웃)에 저장한다. */
const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const ss = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
const mem = {};
const LS = {get: k => { try { return ls ? ls.getItem(k) : mem[k]; } catch (e) { return mem[k]; } }, set: (k, v) => { try { ls ? ls.setItem(k, v) : mem[k] = v; } catch (e) { mem[k] = v; } }, del: k => { try { ls && ls.removeItem(k); } catch (e) {} delete mem[k]; }};
const auto = () => LS.get('mc2-auto') === '1';
const PREF = {
  get: k => { try { return (ss && ss.getItem(k)) || (ls && ls.getItem(k)) || mem[k] || null; } catch (e) { return mem[k] || null; } },
  set: (k, v) => { try { if (auto()) { ls.setItem(k, v); ss && ss.removeItem(k); } else { (ss || ls).setItem(k, v); ls && ss && ls.removeItem(k); } } catch (e) { mem[k] = v; } },
  del: k => { try { ss && ss.removeItem(k); ls && ls.removeItem(k); } catch (e) {} delete mem[k]; }
};
const authStorage = {getItem: k => PREF.get(k), setItem: (k, v) => PREF.set(k, v), removeItem: k => PREF.del(k)};

/* ---------- 백엔드: 데모(로컬) ---------- */
let memDb = null;
/* 데모 저장소: 이미지가 많아질 수 있어 IndexedDB 사용 (없으면 localStorage) */
const IDB = {db: null,
  open() { return new Promise(res => { try { const r = indexedDB.open('hit100', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { this.db = r.result; res(true); }; r.onerror = () => res(false); } catch (e) { res(false); } }); },
  get(k) { return new Promise(res => { if (!this.db) return res(null); try { const t = this.db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); } catch (e) { res(null); } }); },
  set(k, v) { if (!this.db) return; try { this.db.transaction('kv', 'readwrite').objectStore('kv').put(JSON.parse(JSON.stringify(v)), k); } catch (e) { toast('저장하지 못했어요: ' + e.message); } }
};
const LB = {
  async genItems() { throw '데모 모드에선 AI 문제 만들기를 쓸 수 없어요. 서버를 연결하세요.'; },
  db() { if (memDb) return memDb; try { memDb = JSON.parse(localStorage.getItem('mc2-db') || 'null'); } catch (e) {} memDb = memDb || {users: [], session: null, academies: [], members: [], students: [], exams: [], attempts: []}; memDb.items = memDb.items || []; memDb.worksheets = memDb.worksheets || []; memDb.logs = memDb.logs || []; memDb.todos = memDb.todos || []; return memDb; },
  save() { if (IDB.db) { IDB.set('db', memDb); try { localStorage.removeItem('mc2-db'); } catch (e) {} return; } try { localStorage.setItem('mc2-db', JSON.stringify(memDb)); } catch (e) { toast('기기 저장 공간이 부족해요. 서버 연결을 권장해요'); } },
  h(s) { let h = 5381; for (const c of String(s)) h = (h * 33 ^ c.charCodeAt(0)) >>> 0; return 'h' + h.toString(36); },
  async init() { await IDB.open(); const v = await IDB.get('db'); if (v) memDb = v; this.db(); if (!v && IDB.db) IDB.set('db', memDb); },
  async session() { const d = this.db(), sid = PREF.get('mc2-sess'); return d.users.find(u => u.id === sid) || null; },
  async signUp(email, pw) { const d = this.db(); if (d.users.some(u => u.email === email)) throw '이미 가입된 이메일이에요.'; const u = {id: uid(), email, pw: this.h(pw)}; d.users.push(u); this.save(); PREF.set('mc2-sess', u.id); return u; },
  async signIn(email, pw) { const d = this.db(), u = d.users.find(x => x.email === email); if (!u || u.pw !== this.h(pw)) throw '이메일 또는 비밀번호가 맞지 않아요.'; PREF.set('mc2-sess', u.id); return u; },
  async signOut() { PREF.del('mc2-sess'); },
  async findEmail(code, name) { const d = this.db(), a = d.academies.find(x => x.invite_code === code.trim().toUpperCase()); if (!a) return []; return d.members.filter(m => m.academy_id === a.id && m.name === name.trim()).map(m => maskEmail(m.email || (d.users.find(u => u.id === m.user_id) || {}).email || '')); },
  async sendReset() { throw 'demo'; },
  async demoReset(email, code, name, pw) { const d = this.db(), u = d.users.find(x => x.email === email); const a = d.academies.find(x => x.invite_code === code.trim().toUpperCase());
    if (!u || !a || !d.members.some(m => m.user_id === u.id && m.academy_id === a.id && m.name === name.trim())) throw '입력한 정보와 맞는 계정이 없어요.'; u.pw = this.h(pw); this.save(); },
  async updateMember(m) { const d = this.db(), i = d.members.findIndex(x => x.user_id === m.user_id && x.academy_id === m.academy_id); if (i >= 0) d.members[i] = {...d.members[i], name: m.name}; this.save(); return d.members[i]; },
  async updateAcademy(a) { const d = this.db(), i = d.academies.findIndex(x => x.id === a.id); if (i >= 0) d.academies[i] = {...d.academies[i], name: a.name, settings: a.settings || d.academies[i].settings || {}}; this.save(); return d.academies[i]; },
  async changePassword(user, oldPw, pw) { const d = this.db(), u = d.users.find(x => x.id === user.id); if (!u || u.pw !== this.h(oldPw)) throw '현재 비밀번호가 맞지 않아요.'; u.pw = this.h(pw); this.save(); },
  async me(user) { const d = this.db(), ms = d.members.filter(x => x.user_id === user.id).map(m => ({member: m, academy: d.academies.find(a => a.id === m.academy_id)})).filter(x => x.academy); return {list: ms, isAdmin: true}; },
  async createAcademy(user, name, myName, title) {
    const d = this.db(), a = {id: uid(), name, invite_code: Math.random().toString(36).slice(2, 8).toUpperCase()};
    d.academies.push(a); d.members.push({user_id: user.id, academy_id: a.id, name: myName, title, role: 'owner', email: user.email}); this.save(); return a;
  },
  async joinAcademy(user, code, myName, title) {
    const d = this.db(), a = d.academies.find(x => x.invite_code === code.trim().toUpperCase()); if (!a) throw '초대 코드를 찾을 수 없어요.';
    if (d.members.some(m => m.user_id === user.id && m.academy_id === a.id)) throw '이미 이 학원에 소속돼 있어요.';
    d.members.push({user_id: user.id, academy_id: a.id, name: myName, title, role: 'teacher', email: user.email}); this.save(); return a;
  },
  async joinAsStudent(user, code, myName) {
    const d = this.db(), st = d.students.find(x => (x.link_code || '') === code.trim().toUpperCase()); if (!st) throw '학생 코드를 찾을 수 없어요. 선생님께 다시 확인하세요.';
    if (d.members.some(m => m.user_id === user.id && m.academy_id === st.academy_id)) throw '이미 이 학원에 소속돼 있어요.';
    d.members.push({user_id: user.id, academy_id: st.academy_id, name: myName, title: '학생', role: 'student', student_id: st.id, email: user.email}); this.save(); return d.academies.find(a => a.id === st.academy_id);
  },
  async setMember(aid, userId, patch) {
    const d = this.db(), list = d.members.filter(m => m.academy_id === aid), m = list.find(x => x.user_id === userId); if (!m) throw '선생님을 찾을 수 없어요.';
    if (patch.role === 'teacher' && m.role === 'owner' && list.filter(x => x.role === 'owner').length <= 1) throw '관리자가 최소 한 명은 있어야 해요. 다른 분을 먼저 관리자로 지정하세요.';
    Object.assign(m, patch); this.save(); return m;
  },
  async removeMember(aid, userId) {
    const d = this.db(), list = d.members.filter(m => m.academy_id === aid), m = list.find(x => x.user_id === userId); if (!m) return;
    if (m.role === 'owner' && list.length > 1 && list.filter(x => x.role === 'owner').length <= 1) throw '마지막 관리자는 나갈 수 없어요. 다른 분을 먼저 관리자로 지정하세요.';
    d.members = d.members.filter(x => !(x.academy_id === aid && x.user_id === userId)); this.save();
  },
  async loadAll(aid, me) { const d = this.db(), st = me && me.role === 'student' ? me.student_id : null, mine = x => x.academy_id === aid && (!st || x.student_id === st);
    return {students: d.students.filter(x => x.academy_id === aid && (!st || x.id === st)), exams: d.exams.filter(x => !x.academy_id || x.academy_id === aid), attempts: d.attempts.filter(mine), members: d.members.filter(x => x.academy_id === aid && (!st || x.role !== 'student')),
      worksheets: d.worksheets.filter(x => x.academy_id === aid && (!st || (x.student_ids || []).includes(st))), items: d.items.filter(x => x.academy_id === aid), logs: d.logs.filter(mine), todos: d.todos.filter(mine)}; },
  async upsert(t, row) { const d = this.db(), i = d[t].findIndex(x => x.id === row.id); const r = JSON.parse(JSON.stringify(row)); if (i >= 0) d[t][i] = r; else d[t].push(r); this.save(); return r; },
  async remove(t, id) { const d = this.db(); d[t] = d[t].filter(x => x.id !== id); if (t === 'students') d.attempts = d.attempts.filter(a => a.student_id !== id); if (t === 'exams') d.attempts = d.attempts.filter(a => a.exam_id !== id); this.save(); }
};

/* ---------- 백엔드: Supabase ---------- */
let sb = null;
const SB = {
  async init() {
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/dist/umd/supabase.min.js'; s.onload = ok; s.onerror = () => no('서버 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인하세요.'); document.head.appendChild(s); });
    const recovering = /type=recovery/.test(location.hash);
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {auth: {storage: authStorage, persistSession: true, autoRefreshToken: true}});
    if (recovering) S.recovery = true;
    sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') { S.recovery = true; renderAuth('newpw'); } });
  },
  chk(r) { if (r.error) throw r.error.message; return r.data; },
  async genItems(body) {
    if (body.kind === 'set' && !body.passage && !body.step) {
      const p = await this.genRaw({...body, step: 'passage'});
      if (!p.passage) throw '지문을 만들지 못했어요';
      body = {...body, passage: p.passage};
    }
    return (await this.genRaw(body)).items || [];
  },
  async genRaw(body) {
    const {data, error} = await sb.functions.invoke('gen-items', {body});
    if (error) { let m = error.message || String(error); try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (e) {}
      if (/404|not found/i.test(m)) m = 'AI 기능이 아직 서버에 설치되지 않았어요 (Edge Function gen-items).'; else if (/Failed to send|timeout|546|504|fetch/i.test(m)) m = '시간이 너무 오래 걸려 연결이 끊겼어요. 세트당 문항을 줄이거나 단일 문항으로 다시 해보세요.'; throw m; }
    if (data && data.error) throw data.error; if (body.step === 'passage' && !(data && data.passage)) throw '구버전 AI 함수예요. gen-items 코드를 새로 배포하세요.'; return data || {};
  },
  async session() { const {data} = await sb.auth.getSession(); return data.session ? data.session.user : null; },
  async signUp(email, pw) { const d = this.chk(await sb.auth.signUp({email, password: pw})); if (!d.session) throw '확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인하세요.'; return d.user; },
  async signIn(email, pw) { return this.chk(await sb.auth.signInWithPassword({email, password: pw})).user; },
  async signOut() { await sb.auth.signOut(); },
  async findEmail(code, name) { return (this.chk(await sb.rpc('find_email', {p_code: code.trim().toUpperCase(), p_name: name.trim()})) || []); },
  async sendReset(email) { this.chk(await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname})); },
  async setNewPassword(pw) { this.chk(await sb.auth.updateUser({password: pw})); },
  async updateMember(m) { return this.chk(await sb.rpc('update_my_name', {p_academy: m.academy_id, p_name: m.name})); },
  async updateAcademy(a) { return this.chk(await sb.from('academies').update({name: a.name, settings: a.settings || {}}).eq('id', a.id).select().single()); },
  async changePassword(user, oldPw, pw) { this.chk(await sb.auth.signInWithPassword({email: user.email, password: oldPw})); this.chk(await sb.auth.updateUser({password: pw})); },
  async me(user) {
    const ms = this.chk(await sb.from('members').select('*').eq('user_id', user.id));
    const ad = this.chk(await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle());
    const ids = ms.map(m => m.academy_id), acs = ids.length ? this.chk(await sb.from('academies').select('*').in('id', ids)) : [];
    return {list: ms.map(m => ({member: m, academy: acs.find(a => a.id === m.academy_id)})).filter(x => x.academy), isAdmin: !!ad};
  },
  async createAcademy(user, name, myName, title) { return this.chk(await sb.rpc('create_academy', {p_name: name, p_member: myName, p_title: title})); },
  async joinAcademy(user, code, myName, title) { return this.chk(await sb.rpc('join_academy', {p_code: code.trim().toUpperCase(), p_member: myName, p_title: title})); },
  async joinAsStudent(user, code, myName) { return this.chk(await sb.rpc('join_as_student', {p_code: code.trim().toUpperCase(), p_member: myName})); },
  async setMember(aid, userId, patch) { return this.chk(await sb.rpc('set_member', {p_academy: aid, p_user: userId, p_role: patch.role || null, p_title: patch.title || null})); },
  async removeMember(aid, userId) { this.chk(await sb.rpc('remove_member', {p_academy: aid, p_user: userId})); },
  async loadAll(aid, me) {
    const [s, e, a, m, it, ws, lg, td] = await Promise.all([sb.from('students').select('*').eq('academy_id', aid), sb.from('exams').select('*').or(`academy_id.is.null,academy_id.eq.${aid}`), sb.from('attempts').select('*').eq('academy_id', aid), sb.from('members').select('*').eq('academy_id', aid), sb.from('items').select('*').eq('academy_id', aid), sb.from('worksheets').select('*').eq('academy_id', aid), sb.from('logs').select('*').eq('academy_id', aid), sb.from('todos').select('*').eq('academy_id', aid)]);
    return {students: this.chk(s), exams: this.chk(e).map(normalizeExam), attempts: this.chk(a), members: this.chk(m), items: this.chk(it), worksheets: this.chk(ws), logs: this.chk(lg), todos: this.chk(td)};
  },
  async upsert(t, row) { const r = t === 'exams' ? examToRow(row) : row; const out = this.chk(await sb.from(t).upsert(r).select().single()); return t === 'exams' ? normalizeExam(out) : out; },
  async remove(t, id) { this.chk(await sb.from(t).delete().eq('id', id)); }
};
const API = DEMO ? LB : SB;

/* ---------- 상태 ---------- */
const S = {user: null, member: null, academy: null, isAdmin: false, students: [], exams: [], attempts: [], members: [], items: [], worksheets: [], view: 'home', p: null, tab: null, g: null, q: '', f: {}};
const examById = id => S.exams.find(e => e.id === id);
const stuById = id => S.students.find(s => s.id === id);
function replace(list, row) { const i = list.findIndex(x => x.id === row.id); if (i >= 0) list[i] = row; else list.push(row); }
async function save(t, row) { try { let r = await API.upsert(t, row); if (t === 'exams') r = normalizeExam(r); replace(S[t], r); return r; } catch (e) { toast('저장 실패: ' + e); throw e; } }
async function del(t, id) {
  try { await API.remove(t, id); S[t] = S[t].filter(x => x.id !== id); if (t === 'students') S.attempts = S.attempts.filter(a => a.student_id !== id); if (t === 'exams') S.attempts = S.attempts.filter(a => a.exam_id !== id); }
  catch (e) { toast('삭제 실패: ' + e); throw e; }
}
const canEditExam = e => e.academy_id ? true : S.isAdmin;
const examTitle = e => e ? e.title : '(삭제된 시험)';

/* ---------- 예시 데이터 (데모용) ---------- */
function seedDemo(aid) {
  let x = 7; const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const key = n => Array.from({length: n}, () => 1 + Math.floor(rnd() * 5));
  const kor = normalizeExam({id: uid(), academy_id: aid, title: '예시 · 고2 11월 학평 국어 (가상 데이터)', year: 2026, grade: 2, month: 11, kind: '학평', ext_rates: {}, source: '예시 데이터', ...template('kor')});
  kor.key = {common: key(34), hj: key(11), em: key(11)}; kor.p3 = {common: [4, 9, 13, 16, 21, 27, 31, 34], hj: [38, 43], em: [37, 40]};
  kor.cuts = {hj: [92, 85, 77, 67, 56, 44, 32, 21], em: [90, 83, 75, 65, 54, 42, 30, 20]};
  const math = normalizeExam({id: uid(), academy_id: aid, title: '예시 · 고2 11월 학평 수학 (가상 데이터)', year: 2026, grade: 2, month: 11, kind: '학평', ext_rates: {}, source: '예시 데이터', ...template('math')});
  const mk = (from, to) => Array.from({length: to - from + 1}, (_, i) => { const q = from + i; return q >= 16 && q <= 22 || q >= 29 ? 1 + Math.floor(rnd() * 99) : 1 + Math.floor(rnd() * 5); });
  math.key = {common: mk(1, 22), pr: mk(23, 30), ca: mk(23, 30), ge: mk(23, 30)}; math.cuts = {pr: [88, 80, 70, 58, 45, 33, 22, 14], ca: [84, 76, 66, 54, 42, 30, 20, 12], ge: [85, 77, 67, 55, 43, 31, 21, 13]};
  const d = LB.db(); d.exams.push(kor, math);
  const hard = new Set([8, 13, 15, 16, 21, 22, 27, 29, 30, 31, 33, 38, 40, 43]);
  const take = (ex, tr, skill) => { const a = []; for (let q = 1; q <= QN(ex); q++) { const k = keyOf(ex, tr, q), p = hard.has(q) ? skill - .35 : skill; a.push(rnd() < p ? k : (isShort(ex, tr, q) ? k + 1 : 1 + (k % 5))); } return a; };
  [['김하늘', 'OO고', 2, 'hj', 'ca', .93], ['이준서', 'OO고', 2, 'em', 'pr', .82], ['박서윤', '△△고', 2, 'hj', 'pr', .72], ['최도윤', '△△고', 2, 'em', 'ca', .88]].forEach(([n, sc, gr, kt, mt, skill], i) => {
    const st = {id: uid(), academy_id: aid, name: n + ' (예시)', school: sc, grade: gr, subject: kt, tracks: {math: mt}, memo: ''}; d.students.push(st);
    d.attempts.push({id: uid(), academy_id: aid, student_id: st.id, exam_id: kor.id, status: 'done', planned_date: null, taken_date: today(), subject: kt, mode: 'answers', answers: take(kor, kt, skill), wrong: [], attitude: ATT[i % 3], picks: [], notes: {}});
    d.attempts.push({id: uid(), academy_id: aid, student_id: st.id, exam_id: math.id, status: 'done', planned_date: null, taken_date: today(), subject: mt, mode: 'answers', answers: take(math, mt, skill - .05), wrong: [], attitude: ATT[(i + 1) % 3], picks: [], notes: {}});
    if (i < 2) d.attempts.push({id: uid(), academy_id: aid, student_id: st.id, exam_id: kor.id, status: 'planned', planned_date: today(), taken_date: null, subject: kt, mode: 'answers', answers: [], wrong: [], attitude: '', picks: [], notes: {}});
  });
  LB.save();
}

/* ---------- 부팅 ---------- */
async function boot() {
  try { await API.init(); S.user = await API.session(); } catch (e) { return renderFatal(e); }
  if (S.recovery) return renderAuth('newpw');
  if (!S.user) return renderAuth('in');
  await afterLogin();
}
async function afterLogin() {
  try {
    const me = await API.me(S.user); S.isAdmin = me.isAdmin; S.myAcads = me.list;
    if (!me.list.length) return renderOnboard();
    const want = LS.get('mc2-acad'), cur = me.list.find(x => x.academy.id === want) || me.list[0];
    S.member = cur.member; S.academy = cur.academy; LS.set('mc2-acad', cur.academy.id);
    Object.assign(S, {logs: [], todos: []}, await API.loadAll(S.academy.id, S.member)); S.exams.forEach(normalizeExam);
    go(isStudent() ? 'today' : 'home');
  } catch (e) { renderFatal(e); }
}
function renderFatal(e) { root.innerHTML = `<div class="auth" style="grid-template-columns:1fr"><div class="formside"><div class="box"><div class="logo">문제가 생겼어요</div><p>${esc(e)}</p><button class="btn r" onclick="location.reload()">다시 시도</button></div></div></div>`; }

/* ---------- 로그인 / 회원가입 / 학원 ---------- */
function renderAuth(mode) {
  if (mode === 'findId' || mode === 'reset' || mode === 'newpw') return renderRecover(mode);
  root.innerHTML = `<div class="auth"><div class="brandside"><div class="row" style="gap:12px"><img src="icon-192.png" alt="" style="width:48px;height:48px;border-radius:14px;background:#fff"><b class="lvl" style="font-size:22px">${esc(CFG.APP_NAME || 'hit100')}</b></div>
  <h1>모든 과목 모의고사,<br>채점부터 보고서까지 한 번에</h1>
  <ul><li><span>${icon('pen', 16)}</span>국어·수학·영어·한국사·탐구 전 과목 채점</li><li><span>${icon('check', 16)}</span>답만 입력하면 점수·등급·영역 분석 자동</li><li><span>${icon('chart', 16)}</span>학생별 성적 추이와 약점 분석</li><li><span>${icon('file', 16)}</span>문항별 난이도 상·중·하와 오답노트</li><li><span>${icon('users', 16)}</span>선생님 여러 명이 함께 쓰는 학원 계정</li></ul></div>
  <div class="formside"><form class="box" id="authf">
  <div class="seg" style="display:flex"><button type="button" class="${mode === 'in' ? 'on' : ''}" data-mode="in" style="flex:1">로그인</button><button type="button" class="${mode === 'up' ? 'on' : ''}" data-mode="up" style="flex:1">회원가입</button></div>
  <h1 style="font-size:1.4rem;margin:4px 0 0">${mode === 'in' ? '다시 오셨네요' : '계정 만들기'}</h1><p class="small" style="margin:0">${mode === 'in' ? '이메일과 비밀번호로 로그인하세요.' : '이메일로 가입하고 학원을 만들거나 참여하세요.'}</p>
  ${mode === 'up' ? `<div><span class="small">나는</span><div class="seg" style="display:flex;margin-top:4px">${[['staff', '선생님 · 직원'], ['student', '학생']].map(([k, l]) => `<button type="button" class="${(LS.get('hit100-who') || 'staff') === k ? 'on' : ''}" data-who="${k}" style="flex:1">${l}</button>`).join('')}</div></div>` : ''}
  <label>이메일<input name="email" type="email" autocomplete="email" required value="${esc(mode === 'in' ? LS.get('mc2-email') || '' : '')}"></label>
  <label>비밀번호<span class="pwbox"><input name="pw" type="password" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" minlength="6" required><button type="button" class="pweye" data-act="pwEye">보기</button></span></label>
  ${mode === 'up' ? '<label>비밀번호 확인<span class="pwbox"><input name="pw2" type="password" autocomplete="new-password" minlength="6" required><button type="button" class="pweye" data-act="pwEye">보기</button></span></label>' : ''}
  <div class="row" style="gap:18px">
  <label class="row" style="color:var(--ink);font-size:14px;gap:6px;cursor:pointer"><input type="checkbox" name="remember" ${LS.get('mc2-email') ? 'checked' : ''} style="width:20px;height:20px;min-height:0;margin:0"> 아이디 저장</label>
  <label class="row" style="color:var(--ink);font-size:14px;gap:6px;cursor:pointer"><input type="checkbox" name="auto" ${auto() ? 'checked' : ''} style="width:20px;height:20px;min-height:0;margin:0"> 자동 로그인</label></div>
  <div class="err" id="aerr"></div>
  <button class="btn r" type="submit">${mode === 'in' ? '로그인' : '가입하기'}</button>
  ${mode === 'in' ? '<div class="row" style="justify-content:center;gap:6px;font-size:14px"><button type="button" class="linkbtn" data-mode="findId">아이디 찾기</button><span class="small">|</span><button type="button" class="linkbtn" data-mode="reset">비밀번호 찾기</button></div>' : ''}
  ${DEMO ? '<p class="small">데모 모드: 계정과 데이터가 이 기기에만 저장돼요. 서버를 연결하면 어디서든 같은 계정으로 쓸 수 있어요.</p>' : ''}
  <button type="button" class="btn o s" data-act="saveApp">앱을 파일로 저장하기</button>
  </form></div></div>`;
  root.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => renderAuth(b.dataset.mode));
  root.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { LS.set('hit100-who', b.dataset.who); root.querySelectorAll('[data-who]').forEach(x => x.classList.toggle('on', x === b)); });
  document.getElementById('authf').onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target), err = document.getElementById('aerr');
    const email = String(f.get('email')).trim().toLowerCase(), pw = String(f.get('pw'));
    if (mode === 'up' && pw !== f.get('pw2')) { err.textContent = '비밀번호가 서로 달라요.'; return; }
    err.textContent = '';
    if (f.get('remember')) LS.set('mc2-email', email); else LS.del('mc2-email');
    if (f.get('auto')) LS.set('mc2-auto', '1'); else LS.del('mc2-auto');
    try { S.user = mode === 'in' ? await API.signIn(email, pw) : await API.signUp(email, pw); await afterLogin(); } catch (e) { err.textContent = String(e); }
  };
}
const TITLES_JOB = ['원장', '부원장', '실장', '선생님'];
function maskEmail(e) { const [u, d] = String(e).split('@'); if (!d) return e; return (u.length <= 2 ? u[0] + '*' : u.slice(0, 2) + '*'.repeat(Math.min(6, u.length - 2))) + '@' + d; }
/* 아이디 찾기 · 비밀번호 재설정 · 새 비밀번호 */
function renderRecover(mode) {
  const wrap = inner => `<div class="auth" style="grid-template-columns:1fr"><div class="formside"><form class="box" id="rcf"><div class="logo"><img src="icon-192.png" alt=""><span class="lvl">${esc(CFG.APP_NAME || 'hit100')}</span></div>${inner}<div class="err" id="rerr"></div><button type="button" class="btn o s" data-mode="in">← 로그인으로</button></form></div></div>`;
  const pw2 = `<label>새 비밀번호 (6자 이상)<span class="pwbox"><input name="pw" type="password" autocomplete="new-password" minlength="6" required><button type="button" class="pweye" data-act="pwEye">보기</button></span></label>
    <label>새 비밀번호 확인<span class="pwbox"><input name="pw2" type="password" autocomplete="new-password" minlength="6" required><button type="button" class="pweye" data-act="pwEye">보기</button></span></label>`;
  if (mode === 'findId') root.innerHTML = wrap(`<h1 style="font-size:1.4rem;margin:4px 0 0">아이디 찾기</h1><p class="small" style="margin:0">아이디는 가입할 때 쓴 이메일이에요. 소속 학원의 초대 코드와 앱에 등록한 내 이름으로 찾을 수 있어요. 초대 코드는 같은 학원 선생님이나 원장님 화면 왼쪽 아래에 있어요.</p>
    <label>학원 초대 코드<input name="code" required placeholder="예: K3F9QZ"></label><label>내 이름<input name="name" required placeholder="앱에 등록한 이름"></label>
    <div id="rres"></div><button class="btn r" type="submit">찾기</button>`);
  else if (mode === 'reset') root.innerHTML = wrap(`<h1 style="font-size:1.4rem;margin:4px 0 0">비밀번호 찾기</h1>
    ${DEMO ? `<p class="small" style="margin:0">데모 모드에선 메일을 보낼 수 없어서, 가입 이메일 · 학원 초대 코드 · 내 이름이 모두 맞으면 바로 새 비밀번호로 바꿔요.</p>
    <label>가입한 이메일<input name="email" type="email" required></label><label>학원 초대 코드<input name="code" required></label><label>내 이름<input name="name" required></label>${pw2}<button class="btn r" type="submit">비밀번호 바꾸기</button>`
    : `<p class="small" style="margin:0">가입한 이메일로 비밀번호 재설정 링크를 보내드려요. 메일의 링크를 누르면 새 비밀번호를 정하는 화면이 열려요.</p><label>가입한 이메일<input name="email" type="email" required value="${esc(LS.get('mc2-email') || '')}"></label><div id="rres"></div><button class="btn r" type="submit">재설정 메일 보내기</button>`}`);
  else root.innerHTML = wrap(`<h1 style="font-size:1.4rem;margin:4px 0 0">새 비밀번호 정하기</h1><p class="small" style="margin:0">메일 인증이 확인됐어요. 새로 쓸 비밀번호를 입력하세요.</p>${pw2}<button class="btn r" type="submit">저장하고 로그인</button>`);
  root.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { S.recovery = false; renderAuth(b.dataset.mode); });
  const err = document.getElementById('rerr'), res = document.getElementById('rres');
  document.getElementById('rcf').onsubmit = async ev => {
    ev.preventDefault(); const f = new FormData(ev.target); err.textContent = '';
    try {
      if (mode === 'findId') {
        const list = await API.findEmail(String(f.get('code')), String(f.get('name')));
        res.innerHTML = list.length ? `<div class="card" style="box-shadow:none"><span class="small">찾은 아이디</span>${list.map(e => `<div style="font-size:18px;font-weight:700;margin-top:4px">${esc(e)}</div>`).join('')}<p class="small" style="margin:6px 0 0">보안을 위해 일부를 가렸어요.</p></div>` : '<p class="small" style="color:var(--red)">일치하는 계정이 없어요. 초대 코드와 이름을 다시 확인하세요.</p>';
      } else if (mode === 'reset') {
        if (DEMO) { if (f.get('pw') !== f.get('pw2')) throw '새 비밀번호가 서로 달라요.'; await LB.demoReset(String(f.get('email')).trim().toLowerCase(), String(f.get('code')), String(f.get('name')), String(f.get('pw'))); toast('비밀번호를 바꿨어요. 새 비밀번호로 로그인하세요'); renderAuth('in'); }
        else { await API.sendReset(String(f.get('email')).trim().toLowerCase()); res.innerHTML = '<p class="small" style="color:var(--ok)">메일을 보냈어요. 받은편지함(없으면 스팸함)에서 링크를 눌러주세요.</p>'; }
      } else {
        if (f.get('pw') !== f.get('pw2')) throw '새 비밀번호가 서로 달라요.';
        await API.setNewPassword(String(f.get('pw'))); S.recovery = false; history.replaceState(null, '', location.pathname); toast('비밀번호를 바꿨어요');
        S.user = await API.session(); if (S.user) await afterLogin(); else renderAuth('in');
      }
    } catch (e) { err.textContent = String(e); }
  };
}
function renderOnboard(adding) {
  const prevName = S.member ? S.member.name : '', who = LS.get('hit100-who') || 'staff', stu = who === 'student';
  root.innerHTML = `<div class="auth" style="grid-template-columns:1fr"><div class="formside"><div class="box">
  <div class="logo"><img src="icon-192.png" alt="">${adding ? '학원 추가' : stu ? '학생 연결' : '학원 연결'}</div>
  <div class="seg" style="display:flex">${[['staff', '선생님 · 직원'], ['student', '학생']].map(([k, l]) => `<button type="button" class="${who === k ? 'on' : ''}" data-who="${k}" style="flex:1">${l}</button>`).join('')}</div>
  ${stu ? `<p class="small" style="margin:0">선생님께 받은 <b>학생 코드</b>를 넣으면 내 성적·약점 분석·플래너·공부 타이머를 쓸 수 있어요.</p>
  <label>내 이름<input id="ob-me" value="${esc(prevName)}" placeholder="홍길동"></label>
  <label>학생 코드<input id="ob-scode" placeholder="예: 7KQ2MX" style="text-transform:uppercase;letter-spacing:.1em"></label>
  <button class="btn r" id="ob-sjoin">시작하기</button>
  <p class="small" style="margin:0">학생 코드는 선생님 화면의 학생 페이지 위쪽에 있어요. 모르면 선생님께 물어보세요.</p>`
  : `<p class="small" style="margin:0">학원이 이미 앱을 쓰고 있으면 <b>초대 코드로 참여</b>하세요. 처음 쓰는 학원이면 새로 만들면 돼요. 한 계정으로 여러 학원에 소속될 수 있어요.</p>
  <div class="fields"><label>내 이름<input id="ob-me" value="${esc(prevName)}" placeholder="홍길동"></label>
  <label>직책<select id="ob-title">${TITLES_JOB.map(t => `<option ${t === '선생님' ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
  <h3>초대 코드로 참여</h3>
  <div class="row"><input id="ob-code" placeholder="예: K3F9QZ" style="flex:1"><button class="btn r" id="ob-join">참여</button></div>
  <h3>새 학원 만들기</h3>
  <label>학원 이름<input id="ob-name" placeholder="OO국어학원"></label>
  <p class="small" style="margin:0">학원을 만든 사람은 <b>관리자</b>가 돼요. 나중에 원장님이 참여하면 설정에서 관리자 권한을 넘기고 직책도 바꿀 수 있어요.</p>
  ${DEMO ? '<label class="row" style="color:var(--ink)"><input type="checkbox" id="ob-seed" checked style="width:auto;min-height:0"> 예시 학생·시험 넣기</label>' : ''}
  <button class="btn" id="ob-create">학원 만들기</button>`}
  <div class="err" id="oerr"></div>
  <div class="row">${adding ? '<button class="btn o s" id="ob-back">← 돌아가기</button>' : ''}<button class="btn o s" id="ob-out">로그아웃</button></div>
  </div></div></div>`;
  root.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { LS.set('hit100-who', b.dataset.who); renderOnboard(adding); });
  const err = document.getElementById('oerr'), me = () => document.getElementById('ob-me').value.trim(), title = () => (document.getElementById('ob-title') || {}).value || '선생님';
  const on = (id, f) => { const el = document.getElementById(id); if (el) el.onclick = f; };
  on('ob-create', async () => {
    const n = document.getElementById('ob-name').value.trim(); if (!me() || !n) { err.textContent = '내 이름과 학원 이름을 입력하세요.'; return; }
    try { const a = await API.createAcademy(S.user, n, me(), title()); const seed = document.getElementById('ob-seed'); if (DEMO && seed && seed.checked) seedDemo(a.id); LS.set('mc2-acad', a.id); await afterLogin(); } catch (e) { err.textContent = String(e); }
  });
  on('ob-sjoin', async () => {
    const c = document.getElementById('ob-scode').value.trim(); if (!me() || !c) { err.textContent = '내 이름과 학생 코드를 입력하세요.'; return; }
    try { const a = await API.joinAsStudent(S.user, c, me()); LS.set('mc2-acad', a.id); await afterLogin(); } catch (e) { err.textContent = String(e); }
  });
  on('ob-join', async () => {
    const c = document.getElementById('ob-code').value.trim(); if (!me() || !c) { err.textContent = '내 이름과 초대 코드를 입력하세요.'; return; }
    try { const a = await API.joinAcademy(S.user, c, me(), title()); LS.set('mc2-acad', a.id); await afterLogin(); } catch (e) { err.textContent = String(e); }
  });
  document.getElementById('ob-out').onclick = async () => { await API.signOut(); S.user = null; renderAuth('in'); };
  const bk = document.getElementById('ob-back'); if (bk) bk.onclick = () => go('home');
}

/* ---------- 라우팅 / 셸 ---------- */
const NAV = [['home', '홈', 'home'], ['students', '학생', 'users'], ['exams', '시험', 'file'], ['grade', '채점', 'pen'], ['bank', '문제은행', 'box'], ['settings', '설정', 'gear']];
const STUDENT_NAV = [['today', '오늘', 'home'], ['planner', '플래너', 'cal'], ['analysis', '내 분석', 'chart'], ['settings', '설정', 'gear']];
const TITLES = {today: '오늘', planner: '플래너', analysis: '내 분석', home: '홈', students: '학생', student: '학생', exams: '시험', exam: '시험', examEdit: '시험', grade: '채점', report: '보고서', settings: '설정', bank: '문제은행', itemEdit: '문제은행', sheet: '시험지', sheetView: '시험지', aiReview: '문제은행'};
const navOf = v => ({analysis: 'analysis', student: isStudent() ? 'analysis' : 'students', exam: 'exams', examEdit: 'exams', report: 'students', itemEdit: 'bank', sheet: 'bank', sheetView: 'bank', aiReview: 'bank'}[v] || v);
function go(view, p = null, tab = null) {
  if (view === 'grade' && !(p && p.keep)) S.g = p && p.g ? p.g : (S.g && !p ? S.g : newDraft(p || {}));
  S.menu = false; S.view = view; S.p = p; S.tab = tab; render(); window.scrollTo(0, 0);
}
const roleName = m => m ? (m.title || (m.role === 'owner' ? '원장' : '선생님')) : '';
const honor = t => /님$/.test(t) ? t : t + '님';
const PERMS = [
  ['all_students', '모든 학생 보기', '끄면 담당 학생만 보여요'],
  ['student_edit', '학생 추가 · 수정 · 시험 배정', ''],
  ['student_delete', '학생 삭제', ''],
  ['grade', '채점 · 채점 수정', ''],
  ['attempt_delete', '채점 기록 삭제', ''],
  ['exam_edit', '시험 등록 · 수정', ''],
  ['exam_delete', '시험 삭제', ''],
  ['bank_edit', '문제은행 추가 · 수정', ''],
  ['bank_delete', '문제은행 삭제', ''],
  ['sheet', '시험지 만들기', ''],
  ['manage_members', '선생님 관리 · 초대 코드', '직책 변경, 내보내기'],
  ['academy_settings', '학원 이름 변경', ''],
  ['backup', '데이터 백업 · 불러오기', '']
];
const ALL_ON = Object.fromEntries(PERMS.map(([k]) => [k, true]));
const DEFAULT_PERMS = {
  원장: {...ALL_ON},
  부원장: {...ALL_ON, backup: false},
  실장: {...ALL_ON, attempt_delete: false, exam_delete: false, bank_edit: false, bank_delete: false, academy_settings: false, backup: false},
  선생님: {...ALL_ON, all_students: false, student_delete: false, attempt_delete: false, exam_delete: false, bank_delete: false, manage_members: false, academy_settings: false, backup: false}
};
function permsFor(title) { const st = ((S.academy || {}).settings || {}).perms || {}; return {...(DEFAULT_PERMS[title] || DEFAULT_PERMS.선생님), ...(st[title] || {})}; }
function can(k) { if (!S.member) return false; if (S.member.role === 'student') return false; if (S.member.role === 'owner') return true; return !!permsFor(roleName(S.member))[k]; }
const ACT_PERM = {newStudent: 'student_edit', editStudent: 'student_edit', delStudent: 'student_delete', assign: 'student_edit', newExam: 'exam_edit', editExam: 'exam_edit', delExam: 'exam_delete', saveExam: 'exam_edit',
  gradeStudent: 'grade', gradeExam: 'grade', gradePlanned: 'grade', editAttempt: 'grade', gSave: 'grade', delAttempt: 'attempt_delete', newItem: 'bank_edit', bulkAdd: 'bank_edit', aiGen: 'bank_edit', aiSave: 'bank_edit', aiSaveCart: 'bank_edit', editItem: 'bank_edit', saveItem: 'bank_edit', saveItemNext: 'bank_edit', delItem: 'bank_delete',
  noteCause: 'grade', copyCode: 'manage_members', genLink: 'student_edit', openCart: 'sheet', cartToggle: 'sheet', clinicSheet: 'sheet', editSheet: 'sheet', delSheet: 'sheet', sheetSave: 'sheet', sheetPreview: 'sheet', mKick: 'manage_members', saveAcademy: 'academy_settings', bkCopy: 'backup', bkLoad: 'backup', leaveAcad: null};
const actAllowed = el => { const a = el.dataset.act; if (a === 'nav' && el.dataset.v === 'grade') return can('grade'); const p = ACT_PERM[a]; return !p || can(p); };
const visibleStudents = () => can('all_students') ? S.students : S.students.filter(s => (s.teacher_ids || []).includes(S.user.id) || s.created_by === S.user.id);
const canSeeStu = id => visibleStudents().some(s => s.id === id);
const isOwner = () => S.member && S.member.role === 'owner';
function userMenu() {
  return `<div class="umenu" id="umenu"><div class="uh"><div class="av lg">${initial(S.member.name)}</div><div><b>${esc(S.member.name)} ${roleName(S.member)}</b><span>${esc(S.user.email)}</span><br><span>${esc(S.academy.name)}</span></div></div>
  ${(S.myAcads || []).length > 1 ? `<div class="small" style="padding:6px 10px 2px">내 학원</div>${S.myAcads.map(x => `<button class="mi" data-act="switchAcad" data-id="${x.academy.id}">${icon(x.academy.id === S.academy.id ? 'check' : 'home', 18)} ${esc(x.academy.name)} <span class="small" style="margin-left:auto">${esc(roleName(x.member))}</span></button>`).join('')}<div style="border-top:1px solid var(--hair);margin:6px 0"></div>` : ''}
  <button class="mi" data-act="addAcad">${icon('plus', 18)} 다른 학원 추가 (참여·만들기)</button>
  <button class="mi" data-act="nav" data-v="settings" data-sec="profile">${icon('user', 18)} 내 프로필</button>
  <button class="mi" data-act="nav" data-v="settings">${icon('gear', 18)} 설정</button>
  <button class="mi" data-act="toggleTheme">${icon(curDark() ? 'sun' : 'moon', 18)} ${curDark() ? '밝은 화면으로' : '어두운 화면으로'}</button>
  <button class="mi" data-act="copyCode">${icon('key', 18)} 초대 코드 복사 <span class="small" style="margin-left:auto">${esc(S.academy.invite_code)}</span></button>
  <button class="mi r" data-act="logout">${icon('logout', 18)} 로그아웃</button></div>`;
}
function render() {
  const nv = navOf(S.view), NAVS = isStudent() ? STUDENT_NAV : NAV;
  if (isStudent() && !['today', 'planner', 'analysis', 'settings', 'report', 'sheetView'].includes(S.view)) S.view = 'today';
  const body = ({today: vToday, planner: vPlanner, analysis: vAnalysis, home: vHome, students: vStudents, student: vStudent, exams: vExams, exam: vExam, examEdit: vExamEdit, grade: vGrade, report: vReport, settings: vSettings, bank: vBank, itemEdit: vItemEdit, sheet: vSheet, sheetView: vSheetView, aiReview: vAiReview}[S.view] || vHome)();
  root.innerHTML = `<div class="app">
  <aside class="side"><div class="brand"><img src="icon-192.png" alt=""><div><b>${esc(CFG.APP_NAME || 'hit100')}</b><span>${esc(S.academy.name)}</span></div></div>
  ${NAVS.map(([k, l, i]) => `<button class="nav ${nv === k ? 'on' : ''}" data-act="nav" data-v="${k}">${icon(i)}${l}</button>`).join('')}
  <div class="sp"></div>
  ${can('manage_members') ? `<div class="invite">초대 코드<b>${esc(S.academy.invite_code)}</b><span>선생님을 학원에 초대할 때 알려주세요</span></div>` : ''}
  <button class="nav" data-act="logout">${icon('logout')}로그아웃</button></aside>
  <div class="col">
  <header class="hdr noprint"><div class="crumb">${esc(S.academy.name)} · <b>${TITLES[S.view] || ''}</b><br><span>${fmtDate(today())}</span></div>
  <div class="hdr-r"><button class="ibtn" data-act="toggleTheme" title="화면 밝기">${icon(curDark() ? 'sun' : 'moon')}</button>
  <button class="uchip" data-act="menu" aria-haspopup="true" aria-expanded="${!!S.menu}"><span class="av">${initial(S.member.name)}</span><span class="who"><b>${esc(S.member.name)}</b><span>${roleName(S.member)}</span></span>${icon('chev', 16)}</button>
  ${S.menu ? userMenu() : ''}</div></header>
  <main class="main">${DEMO ? `<div class="demo noprint">${icon('info', 16)} 데모 모드 · 데이터가 이 기기에만 저장돼요. 설정에서 백업할 수 있어요.</div>` : ''}${body}</main></div>
  <nav class="bnav">${NAVS.map(([k, l, i]) => `<button class="${nv === k ? 'on' : ''}" data-act="nav" data-v="${k}">${icon(i, 22)}${l}</button>`).join('')}</nav></div>`;
  afterRender();
}
function afterRender() {
  if (isStudent()) document.querySelectorAll('.staff-only').forEach(el => el.remove());
  document.querySelectorAll('[data-act]').forEach(el => { if (!actAllowed(el)) el.remove(); });
  const fig = document.getElementById('trend'); if (fig) drawTrend(fig);
  if (S.view === 'grade') gradeDyn();
}

/* ---------- 홈 ---------- */
function vHome() {
  const done = S.attempts.filter(a => a.status === 'done' && canSeeStu(a.student_id)), planned = S.attempts.filter(a => a.status === 'planned' && canSeeStu(a.student_id)).sort((a, b) => String(a.planned_date).localeCompare(String(b.planned_date)));
  const month = today().slice(0, 7), mDone = done.filter(a => String(a.taken_date || '').startsWith(month));
  const recent = [...done].sort((a, b) => String(b.taken_date).localeCompare(String(a.taken_date))).slice(0, 6);
  const watch = visibleStudents().flatMap(s => { const d = doneOf(s.id).map(evalAttempt).filter(Boolean), out = []; for (const sub of new Set(d.map(r => r.e.subject))) { const ds = d.filter(r => r.e.subject === sub); if (ds.length < 2) continue; const l = ds[ds.length - 1], p = ds[ds.length - 2]; if (l.score - p.score <= -5) out.push({s, l, p, sub}); } return out; });
  const hour = new Date().getHours(), hi = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '오늘도 수고 많으셨어요';
  return `<div class="hero"><div><h1>${hi}, ${esc(S.member.name)} ${esc(honor(roleName(S.member)))}</h1><p>${planned.length ? `채점할 시험이 ${planned.length}건 있어요.` : '오늘 예정된 채점이 없어요.'}</p></div>
  <div class="row"><button class="btn o" data-act="newStudent">${icon('plus', 18)}학생 추가</button><button class="btn" data-act="nav" data-v="grade">${icon('pen', 18)}채점하기</button></div></div>
  <div class="kpis"><div class="kpi"><span class="ic">${icon('users')}</span><div><span class="small">학생</span><b>${S.students.length}</b></div></div>
  <div class="kpi"><span class="ic y">${icon('cal')}</span><div><span class="small">예정된 시험</span><b>${planned.length}</b></div></div>
  <div class="kpi"><span class="ic g">${icon('check')}</span><div><span class="small">이번 달 채점</span><b>${mDone.length}</b></div></div>
  <div class="kpi"><span class="ic b">${icon('file')}</span><div><span class="small">등록된 시험</span><b>${S.exams.length}</b></div></div></div>
  ${watch.length ? `<h2>관심 필요 학생 <span class="small">직전 시험보다 5점 이상 떨어졌어요</span></h2><div class="cards">${watch.map(w => `<button class="item" data-act="openStudent" data-id="${w.s.id}"><span class="kpi ic" style="width:38px;height:38px;border:0;box-shadow:none;padding:0;display:grid;place-items:center;background:var(--redt);color:var(--red);border-radius:12px">${icon('alert', 18)}</span><span class="grow"><b>${esc(w.s.name)}</b><br><span class="small">${SUBJECTS[w.sub]} ${w.p.score}점 → ${w.l.score}점</span></span><span class="tag r">${w.l.score - w.p.score}</span></button>`).join('')}</div>` : ''}
  <h2>예정된 시험</h2>${planned.length ? `<div class="list">${planned.map(a => attItem(a, true)).join('')}</div>` : '<div class="empty">예정된 시험이 없어요. 학생 페이지에서 시험을 배정하세요.</div>'}
  <h2>최근 채점</h2>${recent.length ? `<div class="list">${recent.map(a => attItem(a, true)).join('')}</div>` : '<div class="empty">아직 채점 기록이 없어요.</div>'}`;
}
function attItem(a, withName) {
  const s = stuById(a.student_id), e = examById(a.exam_id), r = a.status === 'done' ? evalAttempt(a) : null;
  return `<button class="item" data-act="${a.status === 'done' ? 'openReport' : 'gradePlanned'}" data-id="${a.id}">
  <span class="grow"><b>${withName ? esc(s ? s.name : '(삭제된 학생)') + ' · ' : ''}${esc(examTitle(e))}</b><br><span class="small">${a.status === 'done' ? '응시 ' + fmtDate(a.taken_date) : '예정 ' + fmtDate(a.planned_date)}${e ? ' · ' + esc(examSubj(e)) + (isSplit(e) ? ' ' + esc(trackName(e, trackFor(e, a.subject))) : '') : ''}</span></span>
  ${r ? `<span class="tag r">${r.score}점${r.g ? ' · ' + r.g + '등급' : ''}</span>` : '<span class="tag y">예정 · 채점하기</span>'}</button>`;
}

/* ---------- 학생 ---------- */
function vStudents() {
  const q = S.q.trim(), list = visibleStudents().filter(s => !q || (s.name + s.school).includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return `<div class="top"><div><h1>학생</h1><div class="small">${visibleStudents().length}명${can('all_students') ? '' : ' · 담당 학생만 보여요'}</div></div><button class="btn r" data-act="newStudent">학생 추가</button></div>
  <input data-in="q" value="${esc(S.q)}" placeholder="이름이나 학교로 검색" style="margin-bottom:12px">
  ${list.length ? `<div class="cards">${list.map(s => { const last = lastDone(s.id), r = last && evalAttempt(last);
    return `<button class="item" data-act="openStudent" data-id="${s.id}"><span class="grow"><b>${esc(s.name)}</b><br><span class="small">${esc(s.school)} ${esc(s.grade)}학년</span></span>${r ? `<span class="tag r">${r.g ? r.g + '등급' : r.score + '점'}</span>` : '<span class="tag">기록 없음</span>'}</button>`; }).join('')}</div>` : '<div class="empty">학생이 없어요. 학생 추가를 눌러 등록하세요.</div>'}`;
}
const doneOf = sid => S.attempts.filter(a => a.student_id === sid && a.status === 'done').sort((a, b) => String(a.taken_date).localeCompare(String(b.taken_date)));
const lastDone = sid => { const d = doneOf(sid); return d[d.length - 1]; };
function studentForm(s) {
  s = s || {name: '', school: '', grade: 2, subject: 'hj', memo: ''};
  modal(`<h2 style="margin:0">${s.id ? '학생 수정' : '학생 추가'}</h2>
  <div class="fields"><label>이름<input id="sf-name" value="${esc(s.name)}"></label><label>학교<input id="sf-school" value="${esc(s.school)}"></label>
  <label>학년<select id="sf-grade">${[1, 2, 3].map(g => `<option ${+s.grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
  <label>국어 선택<select id="sf-subj"><option value="hj" ${s.subject === 'hj' ? 'selected' : ''}>화작</option><option value="em" ${s.subject === 'em' ? 'selected' : ''}>언매</option></select></label>
  <label>수학 선택<select id="sf-math">${[['pr', '확통'], ['ca', '미적'], ['ge', '기하']].map(([v, l]) => `<option value="${v}" ${(s.tracks || {}).math === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  <div><span class="small">담당 선생님</span><div class="chips" id="sf-teachers" style="margin-top:6px">${S.members.map(m => { const on = (s.teacher_ids || (s.id ? [] : [S.user.id])).includes(m.user_id); return `<button type="button" class="chip ${on ? 'on' : ''}" data-u="${esc(m.user_id)}" onclick="this.classList.toggle('on')">${esc(m.name)} ${esc(roleName(m))}</button>`; }).join('')}</div></div>
  <label>메모<textarea id="sf-memo">${esc(s.memo)}</textarea></label>
  <div class="row"><button class="btn r" id="sf-save">저장</button><button class="btn o" data-act="closeModal">취소</button></div>`);
  document.getElementById('sf-save').onclick = async () => {
    const v = id => document.getElementById(id).value.trim(); if (!v('sf-name')) { toast('이름을 입력하세요'); return; }
    const row = {...s, id: s.id || uid(), academy_id: S.academy.id, name: v('sf-name'), school: v('sf-school'), grade: +v('sf-grade'), subject: v('sf-subj'), tracks: {...(s.tracks || {}), math: v('sf-math')}, memo: v('sf-memo'), teacher_ids: [...document.querySelectorAll('#sf-teachers .chip.on')].map(b => b.dataset.u), created_by: s.created_by || S.user.id};
    await save('students', row); closeModal(); toast('저장했어요'); go('student', row.id, S.tab);
  };
}
function vStudent() {
  const s = stuById(S.p); if (!s) return '<div class="empty">학생을 찾을 수 없어요.</div>';
  const tab = S.tab || 'plan', done = doneOf(s.id), evalsAll = done.map(a => ({a, r: evalAttempt(a)})).filter(x => x.r);
  const subs = [...new Set(evalsAll.map(x => x.r.e.subject))], tsub = subs.includes(S.f.tsub) ? S.f.tsub : (evalsAll.length ? evalsAll[evalsAll.length - 1].r.e.subject : '');
  const evals = tab === 'plan' || tab === 'study' ? evalsAll : evalsAll.filter(x => x.r.e.subject === tsub);
  const subSeg = tab !== 'plan' && tab !== 'study' && subs.length > 1 ? `<div class="seg" style="margin-bottom:12px">${subs.map(k => `<button class="${tsub === k ? 'on' : ''}" data-act="tsub" data-v="${k}">${SUBJECTS[k]}</button>`).join('')}</div>` : '';
  const planned = S.attempts.filter(a => a.student_id === s.id && a.status === 'planned').sort((a, b) => String(a.planned_date).localeCompare(String(b.planned_date)));
  const kev = evalsAll.filter(x => x.r.e.subject === tsub), last = kev[kev.length - 1], prev = kev[kev.length - 2];
  const avg = kev.length ? Math.round(kev.reduce((t, x) => t + x.r.score, 0) / kev.length) : null;
  let body = '';
  if (tab === 'plan') {
    body = `<div class="row" style="margin-bottom:10px"><button class="btn r s" data-act="assign" data-id="${s.id}">시험 배정</button><button class="btn o s" data-act="gradeStudent" data-id="${s.id}">바로 채점</button></div>
    <h3>예정</h3>${planned.length ? `<div class="list">${planned.map(a => `<div class="item" style="cursor:default"><span class="grow"><b>${esc(examTitle(examById(a.exam_id)))}</b><br><span class="small">예정 ${fmtDate(a.planned_date)}</span></span><button class="btn s r" data-act="gradePlanned" data-id="${a.id}">채점</button><button class="btn s o" data-act="delAttempt" data-id="${a.id}">삭제</button></div>`).join('')}</div>` : '<div class="empty">예정된 시험이 없어요.</div>'}
    <h3>응시 기록</h3>${evals.length ? `<div class="list">${[...evals].reverse().map(x => attItem(x.a, false)).join('')}</div>` : '<div class="empty">아직 응시 기록이 없어요.</div>'}
    ${s.memo ? `<h3>메모</h3><div class="card" style="white-space:pre-wrap">${esc(s.memo)}</div>` : ''}`;
  } else if (tab === 'trend') {
    body = evals.length ? `<div class="card"><div class="fig" id="trend" data-sid="${s.id}" data-sub="${esc(tsub)}"></div></div>
    <div class="scroll tbl" style="margin-top:12px"><table><thead><tr><th>응시일</th><th>시험</th><th class="n">점수</th><th class="n">등급</th><th class="n">틀린 개수</th></tr></thead><tbody>
    ${[...evals].reverse().map(x => `<tr><td>${fmtDate(x.a.taken_date)}</td><td>${esc(x.r.e.title)}</td><td class="n">${x.r.score}</td><td class="n">${x.r.g || '-'}</td><td class="n">${x.r.wrong.length}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">응시 기록이 쌓이면 추이 그래프가 나와요.</div>';
  } else if (tab === 'weak') {
    const ar = {}, causes = {}, lvs = {상: 0, 중: 0, 하: 0, n: 0};
    for (const x of evals) {
      const st = examStats(x.r.e);
      x.r.areas.forEach(a => { const o = ar[a.n] || (ar[a.n] = {w: 0, t: 0}); o.w += a.c; o.t += a.total; });
      x.r.wrong.forEach(q => { lvs[diff(x.r.e, x.r.tr, q, st).lv]++; const n = (x.a.notes || {})[q]; ((n && n.causes) || []).forEach(c => causes[c] = (causes[c] || 0) + 1); });
    }
    const arr = Object.entries(ar).map(([n, o]) => ({n, r: o.t ? o.w / o.t : 0, ...o})).sort((a, b) => b.r - a.r);
    const totW = lvs.상 + lvs.중 + lvs.하 + lvs.n;
    body = evals.length ? `${weakTypesBlock(s.id, tsub)}<h3>영역별 오답률</h3><div class="list">${arr.map(a => `<div class="row"><span style="width:56px;font-weight:600">${esc(a.n)}</span><div class="bar" style="flex:1"><span style="width:${(a.r * 100).toFixed(1)}%"></span></div><span class="small" style="width:120px;text-align:right">${a.w}/${a.t}문항 · ${Math.round(a.r * 100)}%</span></div>`).join('')}</div>
    <h3>틀린 문항 난이도</h3><div class="row">${['상', '중', '하'].map(l => `<span class="tag ${l === '상' ? 'r' : l === '중' ? 'y' : 'g'}">${l} ${lvs[l]}개</span>`).join('')}${lvs.n ? `<span class="tag">판정 전 ${lvs.n}개</span>` : ''}</div>
    <p class="small">${totW && lvs.하 / totW >= .3 ? '쉬운(하) 문항 오답 비중이 높아요. 실수나 기본 개념 점검이 먼저예요.' : totW && lvs.상 / totW >= .5 ? '오답 대부분이 고난도(상) 문항이에요. 고난도 지문 훈련이 효과적이에요.' : '난이도는 정답률 기준이에요: 상 50% 미만 · 중 50~80% · 하 80% 이상.'}</p>
    <h3>오답 원인</h3>${Object.keys(causes).length ? `<div class="row">${Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<span class="tag r">${esc(c)} ${n}</span>`).join('')}</div>` : '<p class="small">오답노트에서 원인을 체크하면 여기에 모여요.</p>'}` : '<div class="empty">응시 기록이 쌓이면 약점 분석이 나와요.</div>';
  } else if (tab === 'study') {
    body = calendar(s.id);
  } else {
    body = wrongNote(s, evals);
  }
  return `<div class="top"><div>${isStudent() ? '' : '<button class="btn o s noprint" data-act="nav" data-v="students">← 학생 목록</button>'}<h1 style="margin-top:10px">${esc(s.name)}</h1>
  <div class="small">${esc(s.school)} ${esc(s.grade)}학년 · 국어 ${KOR_TR[s.subject] || '-'} · 수학 ${({pr: '확통', ca: '미적', ge: '기하'})[(s.tracks || {}).math] || '-'}</div></div>
  <div class="row">${!isStudent() && can('student_edit') ? `<span class="small">학생 앱 코드</span>${s.link_code ? `<b style="letter-spacing:.08em">${esc(s.link_code)}</b><button class="btn o s" data-act="copyLink" data-v="${esc(s.link_code)}">복사</button>` : `<button class="btn o s" data-act="genLink" data-id="${s.id}">학생 코드 만들기</button>`}` : ''}<button class="btn o s" data-act="editStudent" data-id="${s.id}">수정</button><button class="btn o s" data-act="delStudent" data-id="${s.id}">삭제</button></div></div>
  <div class="kpis"><div class="kpi"><span class="small">최근 점수${tsub ? ' · ' + SUBJECTS[tsub] : ''}</span><b>${last ? last.r.score : '-'}</b></div><div class="kpi"><span class="small">최근 등급</span><b>${last && last.r.g ? last.r.g : '-'}</b></div>
  <div class="kpi"><span class="small">직전 대비</span><b>${last && prev ? (last.r.score - prev.r.score >= 0 ? '+' : '') + (last.r.score - prev.r.score) : '-'}</b></div><div class="kpi"><span class="small">평균 점수</span><b>${avg ?? '-'}</b></div></div>
  <div class="tabs">${[['plan', isStudent() ? '응시 기록' : '플래너'], ...(isStudent() ? [] : [['study', '공부 기록']]), ['trend', '성적 추이'], ['weak', '약점 분석'], ['note', '오답노트']].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>${subSeg}${body}`;
}
function wrongNote(s, evals) {
  const f = S.f, items = [];
  for (const x of evals) {
    const st = examStats(x.r.e);
    for (const q of x.r.wrong) {
      const d = diff(x.r.e, x.r.tr, q, st), n = (x.a.notes || {})[q] || {}, area = areaOf(x.r.e, x.r.tr, q);
      if (f.exam && f.exam !== x.a.exam_id) continue; if (f.area && f.area !== area) continue; if (f.lv && f.lv !== d.lv) continue; if (f.cause && !(n.causes || []).includes(f.cause)) continue;
      items.push({x, q, d, n, area});
    }
  }
  const exams = [...new Map(evals.map(x => [x.a.exam_id, x.r.e])).values()], areas = [...new Set(evals.flatMap(x => areasOf(x.r.e, x.r.tr).map(a => a.n)))];
  const sel = (k, opts, lab) => `<label>${lab}<select data-in="f" data-k="${k}"><option value="">전체</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${f[k] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  return `<div class="fields" style="margin-bottom:12px">${sel('exam', exams.map(e => [e.id, e.title]), '시험')}${sel('area', areas.map(a => [a, a]), '영역')}${sel('lv', [['상', '상'], ['중', '중'], ['하', '하']], '난이도')}${sel('cause', CAUSES.map(c => [c, c]), '원인')}</div>
  <p class="small">${items.length}문항</p>
  ${items.length ? `<div class="list">${items.map(({x, q, d, n, area}) => { const ans = (x.a.answers || [])[q-1], k = keyOf(x.r.e, x.r.tr, q);
    return `<div class="wq"><div class="h"><b>${q}번</b>${lvBadge(d)}<span class="tag">${esc(area)}</span><span class="tag">${pts(x.r.e, x.r.tr, q)}점</span>${k !== null ? `<span class="tag g">정답 ${esc(fmtAns(x.r.e, x.r.tr, q, k))}</span>` : ''}${x.a.mode === 'answers' ? `<span class="tag r">학생 ${esc(fmtAns(x.r.e, x.r.tr, q, ans))}</span>` : ''}<span class="small">${esc(x.r.e.title)} · ${fmtDate(x.a.taken_date)}</span></div>
    <div class="chips">${CAUSES.map(c => `<button class="chip ${(n.causes || []).includes(c) ? 'on' : ''}" data-act="noteCause" data-a="${x.a.id}" data-q="${q}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <input data-in="noteMemo" ${can('grade') ? '' : 'disabled'} data-a="${x.a.id}" data-q="${q}" value="${esc(n.memo || '')}" placeholder="메모 (예: 선지 ③과 헷갈림, 개념 복습 필요)"></div>`; }).join('')}</div>` : '<div class="empty">조건에 맞는 오답이 없어요.</div>'}`;
}
function drawTrend(fig) {
  const ev = doneOf(fig.dataset.sid).map(a => ({a, r: evalAttempt(a)})).filter(x => x.r && (!fig.dataset.sub || x.r.e.subject === fig.dataset.sub));
  const draw = () => {
    const W = fig.clientWidth, H = fig.clientHeight, pl = 34, pr = 14, pt = 18, pb = 30, n = ev.length;
    const xs = i => n === 1 ? (W + pl - pr) / 2 : pl + i * (W - pl - pr) / (n - 1), mxs = Math.max(100, ...ev.map(x => x.r.e.max || 100)), ys = v => pt + (mxs - v) * (H - pt - pb) / mxs;
    let g = ''; for (const v of [0, .25, .5, .75, 1].map(f => Math.round(f * mxs))) g += `<line x1="${pl}" x2="${W - pr}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--hair)"/><text x="${pl - 6}" y="${ys(v) + 4}" font-size="11" text-anchor="end" fill="var(--mut)">${v}</text>`;
    const pth = ev.map((x, i) => `${i ? 'L' : 'M'}${xs(i)},${ys(x.r.score)}`).join('');
    const pts_ = ev.map((x, i) => `<circle cx="${xs(i)}" cy="${ys(x.r.score)}" r="5" fill="var(--red)"/><text x="${xs(i)}" y="${ys(x.r.score) - 10}" font-size="12" font-weight="700" text-anchor="middle" fill="var(--ink)">${x.r.score}${x.r.g ? '·' + x.r.g : ''}</text>${W > 520 || i === n - 1 || i === 0 ? `<text x="${xs(i)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="var(--mut)">${esc(String(x.a.taken_date || '').slice(5).replace('-', '/'))}</text>` : ''}`).join('');
    fig.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}<path d="${pth}" fill="none" stroke="var(--red)" stroke-width="2.5"/>${pts_}</svg>`;
  };
  draw(); if (window.ResizeObserver) { const ro = new ResizeObserver(draw); ro.observe(fig); }
}
function assignForm(sid) {
  const ex = [...S.exams].sort((a, b) => (b.year - a.year) || (b.month - a.month));
  modal(`<h2 style="margin:0">시험 배정</h2><p class="small">${esc(stuById(sid).name)} 학생에게 풀 시험과 날짜를 정해요.</p>
  <label>시험<select id="as-exam">${ex.map(e => `<option value="${e.id}">[${esc(examSubj(e))}] ${esc(e.title)}</option>`).join('')}</select></label>
  <label>예정일<input id="as-date" type="date" value="${today()}"></label>
  <div class="row"><button class="btn r" id="as-save" ${ex.length ? '' : 'disabled'}>배정</button><button class="btn o" data-act="closeModal">취소</button></div>${ex.length ? '' : '<p class="small">먼저 시험 탭에서 시험을 등록하세요.</p>'}`);
  document.getElementById('as-save').onclick = async () => {
    const s = stuById(sid);
    await save('attempts', {id: uid(), academy_id: S.academy.id, student_id: sid, exam_id: document.getElementById('as-exam').value, status: 'planned', planned_date: document.getElementById('as-date').value || today(), taken_date: null, subject: prefTrack(s, examById(document.getElementById('as-exam').value)), mode: 'answers', answers: [], wrong: [], attitude: '', picks: [], notes: {}});
    closeModal(); toast('배정했어요'); render();
  };
}

/* ---------- 시험 ---------- */
function parseQuery(q) {
  const o = {}; let m;
  if ((m = q.match(/(20\d{2})/))) o.year = +m[1]; else if ((m = q.match(/(?:^|\D)(\d{2})\s*년/))) o.year = 2000 + +m[1];
  if ((m = q.match(/고\s*([123])/))) o.grade = +m[1];
  if ((m = q.match(/(\d{1,2})\s*월/))) o.month = +m[1];
  for (const k of KINDS) if (q.includes(k)) o.kind = k;
  if (/모의평가/.test(q)) o.kind = '모평'; if (/학력평가/.test(q)) o.kind = '학평';
  for (const [k, v] of Object.entries(SUBJECTS)) if (q.includes(v)) o.subject = k;
  if (/사탐|과탐|윤리|사회|지리|물리|화학|생명|지구|경제|정치/.test(q)) o.subject = 'inq';
  return o;
}
const QWORDS = /20\d{2}|\d{1,2}\s*월|고\s*[123]|\d{2}\s*년|학평|모평|수능|사설|모의고사|학력평가|모의평가|년|국어|수학|영어|한국사|탐구|기타/g;
function vExams() {
  const q = S.q.trim(), pq = parseQuery(q), words = q.replace(QWORDS, ' ').split(/\s+/).filter(Boolean), fs = S.f.esub || pq.subject || '';
  const list = S.exams.filter(e => (!pq.year || e.year === pq.year) && (!pq.grade || e.grade === pq.grade) && (!pq.month || e.month === pq.month) && (!pq.kind || e.kind === pq.kind) && (!fs || e.subject === fs) && words.every(w => (e.title + e.subname).includes(w)))
    .sort((a, b) => (b.year - a.year) || (b.month - a.month) || (a.grade - b.grade));
  return `<div class="top"><div><h1>시험</h1><div class="small">한 번 등록한 시험은 모든 학생 채점에 그대로 쓰여요.</div></div><button class="btn r" data-act="newExam">${icon('plus', 18)}새 시험 등록</button></div>
  <input data-in="q" value="${esc(S.q)}" placeholder="예: 2026 고2 9월 수학" style="margin-bottom:10px">
  <div class="seg" style="margin-bottom:14px">${[['', '전체'], ...Object.entries(SUBJECTS)].map(([k, l]) => `<button class="${fs === k ? 'on' : ''}" data-act="esub" data-v="${k}">${l}</button>`).join('')}</div>
  ${list.length ? `<div class="list">${list.map(e => { const n = S.attempts.filter(a => a.exam_id === e.id && a.status === 'done').length;
    return `<button class="item" data-act="openExam" data-id="${e.id}"><span class="grow"><b>${esc(e.title)}</b><br><span class="small">${QN(e)}문항${isSplit(e) ? ' · ' + e.layout.tracks.map(t => esc(t.name)).join('/') : ''} · ${e.grading === 'absolute' ? '절대평가' : e.grading === 'none' ? '등급 없음' : '상대평가'} · 응시 ${n}명</span></span>
    <span class="tag b">${esc(examSubj(e))}</span>${e.academy_id ? '' : '<span class="tag g">공용</span>'}${hasKey(e, trackFor(e, null)) ? '' : '<span class="tag y">정답 미입력</span>'}</button>`; }).join('')}</div>`
    : `<div class="empty">찾는 시험이 아직 없어요.<br><button class="btn r" style="margin-top:12px" data-act="newExam">"${esc(q || '새 시험')}" 등록하기</button></div>`}`;
}
function vExam() {
  const e = examById(S.p); if (!e) return '<div class="empty">시험을 찾을 수 없어요.</div>';
  const st = examStats(e), tab = S.tab || 'ana', tr = isSplit(e) ? trackFor(e, S.f.etr) : 'all';
  const scores = st.atts.map(a => evalAttempt(a)).filter(Boolean), avg = scores.length ? (scores.reduce((t, r) => t + r.score, 0) / scores.length).toFixed(1) : '-';
  const trSeg = isSplit(e) ? `<div class="seg" style="margin-bottom:10px">${e.layout.tracks.map(t => `<button class="${tr === t.id ? 'on' : ''}" data-act="etr" data-v="${esc(t.id)}">${esc(t.name)}</button>`).join('')}</div>` : '';
  let body = '';
  if (tab === 'ana') {
    const rows = []; for (let q = 1; q <= QN(e); q++) { const d = diff(e, tr, q, st), o = st.m[sk(e, tr, q)] || {n: 0, w: 0, ch: [0, 0, 0, 0, 0, 0]}, k = keyOf(e, tr, q), mx = Math.max(1, ...o.ch.slice(1)), sh = isShort(e, tr, q);
      rows.push(`<tr><td>${q}${sh ? ' <span class="tag">단답</span>' : ''}</td><td>${esc(typeOf(e, tr, q))}</td><td class="n">${pts(e, tr, q)}</td><td class="n">${k === null ? '-' : fmtAns(e, tr, q, k)}</td><td class="n">${d.rate == null ? '-' : Math.round(d.rate) + '%'}<br><span class="small">${d.src}${d.n ? ' ' + d.n + '명' : ''}</span></td><td>${lvBadge(d)}</td>
      <td>${sh ? '<span class="small">-</span>' : `<div class="dist" title="선지 선택 비율">${Array.from({length: e.choices}, (_, i) => i + 1).map(c => `<span class="${c === k ? 'k' : ''}" style="height:${(o.ch[c] / mx * 100).toFixed(0)}%"></span>`).join('')}</div>`}</td></tr>`); }
    body = `${trSeg}<div class="kpis"><div class="kpi"><span class="ic">${icon('users')}</span><div><span class="small">응시자</span><b>${st.n}</b></div></div><div class="kpi"><span class="ic b">${icon('chart')}</span><div><span class="small">평균 점수</span><b>${avg}</b></div></div></div>
    <p class="small">난이도 = 정답률 기준 (상 50% 미만 · 중 50~80% · 하 80% 이상). 외부 오답률이 입력돼 있으면 그걸 쓰고, 없으면 우리 학원 응시자 3명 이상부터 자동 계산해요. 초록 막대가 정답 선지예요.</p>
    <div class="scroll tbl"><table><thead><tr><th>번호</th><th>유형</th><th class="n">배점</th><th class="n">정답</th><th class="n">정답률</th><th>난이도</th><th>선지 분포</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  } else {
    const c = cutsOf(e, tr), list = n => { const a = []; for (let q = 1; q <= QN(e); q++) if (pts(e, tr, q) === n) a.push(q); return a.join(', ') || '-'; };
    const sh = []; for (let q = 1; q <= QN(e); q++) if (isShort(e, tr, q)) sh.push(q);
    body = `${trSeg}<div class="card"><div class="kv"><span>과목</span><b>${esc(examSubj(e))}</b></div><div class="kv"><span>문항 · 만점</span><b>${QN(e)}문항 · ${totalPts(e, tr)}점 (${e.choices}지선다)</b></div>
    ${[2, 3, 4, 5].filter(n => list(n) !== '-').map(n => `<div class="kv"><span>${n}점 문항</span><b>${list(n)}</b></div>`).join('')}
    ${sh.length ? `<div class="kv"><span>단답형</span><b>${sh.join(', ')}</b></div>` : ''}
    <div class="kv"><span>영역</span><b>${areasOf(e, tr).map(a => `${esc(a.n)} ${a.a}–${a.b}`).join(' · ') || '-'}</b></div>
    <div class="kv"><span>등급</span><b>${e.grading === 'none' ? '등급 없음' : (e.grading === 'absolute' ? '절대평가 · ' : '상대평가 · ') + (c.some(x => x > 0) ? c.map((v, i) => `${i + 1}등급 ${v}`).join(' · ') : '등급컷 미입력')}</b></div><div class="kv"><span>출처</span><b>${esc(e.source || '-')}</b></div></div>
    <h3>정답</h3><div class="grid">${Array.from({length: QN(e)}, (_, i) => { const q = i + 1, k = keyOf(e, tr, q), p = pts(e, tr, q); return `<div class="q ${p > e.defPts ? 't' : ''}">${q}<small>${k === null ? '-' : fmtAns(e, tr, q, k)}</small>${p > e.defPts ? `<i>${p}</i>` : ''}</div>`; }).join('')}</div>`;
  }
  return `<div class="top"><div><button class="btn o s" data-act="nav" data-v="exams">← 시험 목록</button><h1 style="margin-top:10px">${esc(e.title)}</h1><div class="small">${esc(examSubj(e))} · ${e.academy_id ? '우리 학원 시험' : '공용 시험'}</div></div>
  <div class="row"><button class="btn r s" data-act="gradeExam" data-id="${e.id}">이 시험으로 채점</button>${canEditExam(e) ? `<button class="btn o s" data-act="editExam" data-id="${e.id}">수정</button><button class="btn o s" data-act="delExam" data-id="${e.id}">삭제</button>` : ''}</div></div>
  <div class="tabs">${[['ana', '문항 분석'], ['info', '정답 · 배점 · 등급컷']].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
}
function examDraft(src) {
  if (src) return normalizeExam(JSON.parse(JSON.stringify(src)));
  const pq = parseQuery(S.q || ''), subj = S.f.esub || pq.subject || 'kor';
  return normalizeExam({id: null, academy_id: S.academy.id, year: pq.year || new Date().getFullYear(), grade: pq.grade || 2, month: pq.month || 3, kind: pq.kind || '학평', title: '', key: {}, ext_rates: {}, source: '', ...template(subj)});
}
const autoTitle = d => `${d.year}년 고${d.grade} ${d.month}월 ${d.kind} ${SUBJECTS[d.subject] || ''}${d.subname ? ' ' + d.subname : ''}`;
/* 편집기용 섹션 목록: 공통 + 선택과목 */
function edSecs(d) {
  const c = commonLen(d), n = QN(d), out = [{id: 'common', name: isSplit(d) ? '공통' : '전체', from: 1, to: c}];
  if (isSplit(d)) d.layout.tracks.forEach(t => out.push({id: t.id, name: t.name, from: c + 1, to: n}));
  return out;
}
const keyText = (d, sec) => { const arr = d.key[sec.id] || [], len = sec.to - sec.from + 1, hasShort = (d.short[sec.id] || []).length > 0, v = Array.from({length: len}, (_, i) => arr[i] === null || arr[i] === undefined ? (hasShort ? '0' : '0') : String(arr[i])); return hasShort ? v.join(' ') : v.join(''); };
function parseKey(str, len, spaced) {
  const t = String(str || '').trim(); let toks;
  if (spaced || /[\s,]/.test(t)) toks = t.split(/[\s,]+/).filter(Boolean); else toks = t.replace(/[^0-9]/g, '').split('');
  return Array.from({length: len}, (_, i) => { const v = toks[i]; return v === undefined || v === '' || !/^\d+$/.test(v) || (+v === 0 && !spaced) ? null : +v; });
}
function vExamEdit() {
  const d = S.ed, secs = edSecs(d), trs = isSplit(d) ? d.layout.tracks : [{id: 'all', name: ''}];
  const extTxt = Object.entries(d.ext_rates || {}).map(([k, v]) => `${k} ${v}`).join('\n');
  const cutTr = d.grading === 'absolute' || !isSplit(d) ? [{id: 'all', name: ''}] : trs;
  const cutRow = t => `<div class="card"><b>${t.name ? esc(t.name) + ' ' : ''}등급컷 (원점수 이상)</b><div class="fields" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:8px">${Array.from({length: 8}, (_, i) => `<label>${i + 1}등급<input type="number" inputmode="numeric" data-in="edCut" data-t="${esc(t.id)}" data-i="${i}" value="${esc((d.cuts[t.id] || [])[i] || '')}"></label>`).join('')}</div></div>`;
  const listIn = (kind, sec) => `<label>${esc(sec.name)} (${sec.from}–${sec.to})<input data-in="edList" data-k="${kind}" data-t="${esc(sec.id)}" value="${esc(((d[kind] || {})[sec.id] || []).join(', '))}" placeholder="번호를 쉼표로"></label>`;
  return `<div class="top"><div><button class="btn o s" data-act="cancelExam">← 취소</button><h1 style="margin-top:10px">${d.id ? '시험 수정' : '새 시험 등록'}</h1></div></div>
  <div class="card"><h3>과목</h3><div class="seg">${Object.entries(SUBJECTS).map(([k, l]) => `<button class="${d.subject === k ? 'on' : ''}" data-act="edTpl" data-v="${k}">${l}</button>`).join('')}</div>
  <p class="small" style="margin-bottom:0">과목을 고르면 그 과목의 기본 문항 구조·배점·등급 방식이 채워져요. 실제 시험지와 다르면 아래에서 고치세요.</p>
  ${d.subject === 'inq' || d.subject === 'etc' ? `<label style="margin-top:10px">과목명<input data-in="ed" data-k="subname" value="${esc(d.subname)}" placeholder="${d.subject === 'inq' ? '예: 생활과 윤리, 지구과학Ⅰ' : '예: 중2 국어 단원평가'}"></label>` : ''}</div>
  <h2>기본 정보</h2>
  <div class="fields"><label>연도<input type="number" data-in="ed" data-k="year" value="${esc(d.year)}"></label><label>학년<select data-in="ed" data-k="grade">${[1, 2, 3].map(g => `<option ${+d.grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
  <label>월<select data-in="ed" data-k="month">${Array.from({length: 12}, (_, i) => `<option ${+d.month === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
  <label>종류<select data-in="ed" data-k="kind">${KINDS.map(k => `<option ${d.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
  <label style="margin-top:10px">시험 이름<input data-in="ed" data-k="title" value="${esc(d.title)}" placeholder="${esc(autoTitle(d))}"></label>
  <h2>문항 구조</h2>
  <div class="fields"><label>총 문항 수<input type="number" min="1" max="100" data-in="edLay" data-k="qcount" value="${QN(d)}"></label>
  <label>공통 문항 수<input type="number" min="1" max="100" data-in="edLay" data-k="common" value="${d.layout.common}"></label>
  <label>선지 수<select data-in="ed" data-k="choices">${[4, 5].map(n => `<option value="${n}" ${d.choices === n ? 'selected' : ''}>${n}지선다</option>`).join('')}</select></label>
  <label>기본 배점<input type="number" min="1" max="20" data-in="ed" data-k="defPts" value="${d.defPts}"></label></div>
  <label style="margin-top:10px">선택과목 <span class="small">(쉼표로 구분 · 없으면 비워두세요. 공통 문항 뒤 번호부터 선택과목이에요)</span><input data-in="edTracks" value="${esc((d.layout.tracks || []).map(t => t.name).join(', '))}" placeholder="예: 화작, 언매 / 확통, 미적, 기하"></label>
  <div class="row" style="margin-top:8px"><button class="btn o s" data-act="edApply">구조 적용</button><span class="small">문항 수나 선택과목을 바꾼 뒤 눌러주세요.</span></div>
  <h2>정답</h2><p class="small">객관식만 있으면 숫자를 이어서 (예: 3512…), 단답형이 있으면 띄어쓰기로 구분 (예: 3 5 1 24 117). 모르는 칸은 0.</p>
  <div class="fields">${secs.map(sec => `<label>${esc(sec.name)} ${sec.from}–${sec.to}번 (${sec.to - sec.from + 1}개)<textarea data-in="edKey" data-t="${esc(sec.id)}" data-from="${sec.from}" data-to="${sec.to}">${esc(keyText(d, sec))}</textarea></label>`).join('')}</div>
  <div id="ed-keyinfo" class="small"></div>
  <h2>배점</h2><p class="small">기본 배점(${d.defPts}점)이 아닌 문항만 적으면 돼요.</p>
  <h3>3점 문항</h3><div class="fields">${secs.map(sec => listIn('p3', sec)).join('')}</div>
  <h3>4점 문항</h3><div class="fields">${secs.map(sec => listIn('p4', sec)).join('')}</div>
  <h3>단답형(주관식) 문항</h3><div class="fields">${secs.map(sec => listIn('short', sec)).join('')}</div>
  <div class="row" style="margin-top:8px"><label style="max-width:180px">만점<input type="number" data-in="ed" data-k="max" value="${d.max}"></label><div id="ed-tot" class="small"></div></div>
  <h2>등급</h2><div class="seg">${[['relative', '상대평가 (원점수 컷)'], ['absolute', '절대평가'], ['none', '등급 없음']].map(([k, l]) => `<button class="${d.grading === k ? 'on' : ''}" data-act="edGrading" data-v="${k}">${l}</button>`).join('')}</div>
  ${d.grading === 'none' ? '<p class="small">점수만 계산하고 등급은 표시하지 않아요.</p>' : `<div class="list" style="margin-top:10px">${cutTr.map(cutRow).join('')}</div>`}
  <h2>영역 구분</h2><p class="small">형식: 영역명:시작-끝, 쉼표로 구분</p>
  <div class="fields">${secs.map(sec => `<label>${esc(sec.name)}<input data-in="edArea" data-t="${esc(sec.id)}" value="${esc(d.areas[sec.id] || '')}"></label>`).join('')}</div>
  <h2>문항별 유형</h2><p class="small">유형을 넣어두면 학생 취약 유형 분석과 유사 문제 추천이 정확해져요. 비워두면 영역 이름으로 분석해요.</p>
  <div class="row" style="margin-bottom:8px"><button class="btn o s" data-act="edTypesArea">빈 칸을 영역 이름으로 채우기</button></div>
  ${secs.map(sec => `<div class="card" style="margin-bottom:8px"><b>${esc(sec.name)}</b><div class="fields" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr));margin-top:8px">${Array.from({length: sec.to - sec.from + 1}, (_, i) => `<label>${sec.from + i}번<input list="taxo-${d.subject}" data-in="edType" data-t="${esc(sec.id)}" data-i="${i}" value="${esc(((d.types || {})[sec.id] || [])[i] || '')}"></label>`).join('')}</div></div>`).join('')}
  ${taxoDatalists()}
  <h2>외부 오답률 (선택)</h2><p class="small">한 줄에 "번호 오답률". 선택과목 문항은 "선택과목코드:번호 오답률" (코드: ${isSplit(d) ? d.layout.tracks.map(t => `${esc(t.name)}=${esc(t.id)}`).join(', ') : '없음'}). 비워두면 학원 응시 결과로 계산해요.</p>
  <textarea data-in="edExt">${esc(extTxt)}</textarea>
  <label style="margin-top:10px">출처 메모<input data-in="ed" data-k="source" value="${esc(d.source || '')}" placeholder="예: EBSi 정답표, 2026.09.04 확인"></label>
  ${S.isAdmin && !DEMO ? `<label class="row" style="margin-top:10px;color:var(--ink)"><input type="checkbox" data-in="edPublic" ${d.academy_id ? '' : 'checked'} style="width:auto;min-height:0"> 공용 시험으로 등록 (모든 학원에 공개)</label>` : ''}
  <div class="row" style="margin-top:16px"><button class="btn r" data-act="saveExam">저장</button><button class="btn o" data-act="cancelExam">취소</button></div>`;
}
function edInfo() {
  const d = S.ed, el = document.getElementById('ed-keyinfo'), tot = document.getElementById('ed-tot'); if (!el) return;
  const secs = edSecs(d);
  el.textContent = '입력된 정답: ' + secs.map(sec => `${sec.name} ${(d.key[sec.id] || []).filter(v => v !== null && v !== undefined).length}/${sec.to - sec.from + 1}`).join(' · ');
  const trs = isSplit(d) ? d.layout.tracks.map(t => t.id) : ['all'];
  const sums = trs.map(t => ({t, v: totalPts(d, t)})), bad = sums.some(x => x.v !== +d.max);
  const txt = '배점 합계: ' + sums.map(x => (x.t === 'all' ? '' : trackName(d, x.t) + ' ') + x.v + '점').join(' · ');
  tot.innerHTML = bad ? `<span style="color:var(--red)">${esc(txt)} — 만점 ${esc(d.max)}점과 달라요. 배점을 확인하세요.</span>` : esc(txt) + ' ✓';
}
function applyLayout(d) {
  const n = Math.max(1, Math.min(100, +d.layout.qcount || 1)); let c = Math.max(1, Math.min(n, +d.layout.common || n));
  if (!(d.layout.tracks || []).length) c = n;
  d.layout.qcount = n; d.layout.common = c;
  const ids = ['common', ...(d.layout.tracks || []).map(t => t.id)];
  for (const k of ['key', 'p3', 'p4', 'short', 'areas']) for (const id of Object.keys(d[k])) if (!ids.includes(id)) delete d[k][id];
  d.key.common = (d.key.common || []).slice(0, c);
  (d.layout.tracks || []).forEach(t => d.key[t.id] = (d.key[t.id] || []).slice(0, n - c));
}

/* ---------- 채점 ---------- */
function newDraft(o) {
  const s = o.student_id ? stuById(o.student_id) : null, e = o.exam_id ? examById(o.exam_id) : null;
  return {id: o.id || null, student_id: o.student_id || '', exam_id: o.exam_id || '', subject: o.subject || (e ? prefTrack(s, e) : 'hj'), mode: o.mode || 'answers', answers: (o.answers || []).slice(), wrong: (o.wrong || []).slice(),
    cur: 1, picks: (o.picks || []).slice(), picksTouched: !!(o.picks && o.picks.length), notes: JSON.parse(JSON.stringify(o.notes || {})), attitude: o.attitude || '', taken_date: o.taken_date || today(), planned_date: o.planned_date || null};
}
function gCtx() {
  const g = S.g, e = examById(g.exam_id); if (!e) return null;
  const tr = trackFor(e, g.subject), key = hasKey(e, tr), mode = key ? g.mode : 'wrong', a = {...g, mode};
  const wrong = wrongOf(e, tr, a), score = scoreOf(e, tr, wrong), gr = gradeOf(e, tr, score), st = examStats(e);
  const blank = mode === 'answers' ? Array.from({length: QN(e)}, (_, i) => g.answers[i]).filter(v => v === null || v === undefined || v === '').length : 0;
  let picks = g.picks.filter(q => wrong.includes(q));
  if (!g.picksTouched) picks = [...wrong].sort((x, y) => { const dx = diff(e, tr, x, st).rate, dy = diff(e, tr, y, st).rate; return ((dx ?? 101) - (dy ?? 101)) || (pts(e, tr, y) - pts(e, tr, x)) || x - y; }).slice(0, 3);
  return {e, tr, key, mode, wrong, score, gr, st, blank, picks, adj: adjCuts(e, tr, gr), areas: areaCounts(e, tr, wrong), total: totalPts(e, tr)};
}
function vGrade() {
  const g = S.g, studs = [...visibleStudents()].sort((a, b) => a.name.localeCompare(b.name, 'ko')), exs = [...S.exams].sort((a, b) => (b.year - a.year) || (b.month - a.month));
  const c = gCtx(), e = c && c.e;
  return `<div class="top"><div><h1>${g.id ? '채점 수정' : '채점'}</h1><div class="small">학생과 시험을 고르고 학생이 고른 답을 입력하세요.</div></div></div>
  <div class="fields"><label>학생<select data-in="gStu"><option value="">학생 선택</option>${studs.map(s => `<option value="${s.id}" ${g.student_id === s.id ? 'selected' : ''}>${esc(s.name)} · ${esc(s.school)} ${s.grade}</option>`).join('')}</select></label>
  <label>시험<select data-in="gExam"><option value="">시험 선택</option>${exs.map(x => `<option value="${x.id}" ${g.exam_id === x.id ? 'selected' : ''}>[${esc(examSubj(x))}] ${esc(x.title)}</option>`).join('')}</select></label>
  ${e && isSplit(e) ? `<label>선택과목<select data-in="gSubj">${e.layout.tracks.map(t => `<option value="${esc(t.id)}" ${c.tr === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
  <label>응시일<input type="date" data-in="gDate" value="${esc(g.taken_date)}"></label></div>
  ${!c ? `<div class="empty" style="margin-top:14px">${S.exams.length ? '시험을 선택하세요.' : '등록된 시험이 없어요. 시험 탭에서 먼저 등록하세요.'}</div>` : `
  <div class="row" style="margin:14px 0 10px"><div class="seg"><button class="${c.mode === 'answers' ? 'on' : ''}" data-act="gMode" data-v="answers" ${c.key ? '' : 'disabled'}>답 입력</button><button class="${c.mode === 'wrong' ? 'on' : ''}" data-act="gMode" data-v="wrong">틀린 문항만 표시</button></div>
  ${c.key ? '' : '<span class="small">이 시험은 정답이 다 입력되지 않아서 틀린 문항 표시만 돼요.</span>'}</div>
  <div class="work"><div class="omr" id="g-omr"></div><div class="res" id="g-res"></div></div>
  <h2>오답 정리 <span class="small" id="g-wcount"></span></h2><p class="small">원인을 체크하고, ★로 보고서에 넣을 어려운 문제 3개를 고르세요 (기본: 난이도 높은 순).</p>
  <div class="list" id="g-wrong"></div>
  <h2>시험응시태도</h2><div class="chips" id="g-att"></div>
  <textarea data-in="gAtt" style="margin-top:8px" placeholder="예: 후반부 시간 부족, 마킹 실수 1개">${esc(g.attitude)}</textarea>
  <div class="row" style="margin-top:16px"><button class="btn r" data-act="gSave" ${g.student_id ? '' : 'disabled'} id="g-savebtn">저장하고 보고서 보기</button><button class="btn o" data-act="gReset">처음부터</button></div>`}`;
}
function setAns(v) {
  const g = S.g, c = gCtx(); if (!c) return; const n = QN(c.e);
  g.answers[g.cur - 1] = v === null || v === '' || v === undefined ? null : +v;
  if (v !== null && v !== '' && g.cur < n) g.cur++;
  gradeDyn();
  if (isShort(c.e, c.tr, g.cur)) { const i = document.getElementById('g-short'); if (i) i.focus(); }
}
function gradeDyn() {
  const c = gCtx(); if (!c) return; const g = S.g, el = id => document.getElementById(id), e = c.e, n = QN(e);
  if (g.cur > n) g.cur = n;
  const wset = new Set(c.wrong), extra = q => { const p = pts(e, c.tr, q); return p > e.defPts ? `<i>${p}</i>` : ''; };
  let omr;
  if (c.mode === 'answers') {
    const sh = isShort(e, c.tr, g.cur), cv = g.answers[g.cur - 1];
    omr = `<h3>${g.cur}번 ${sh ? '(단답형) 답 입력' : '답 입력'} · <span class="small">${sh ? '숫자를 치고 Enter' : `키보드 1~${e.choices}, ←/→ 이동, 0은 비움`}</span></h3>
    ${sh ? `<div class="pad"><input id="g-short" inputmode="numeric" value="${cv === null || cv === undefined ? '' : esc(cv)}" placeholder="정수 입력" style="font-size:22px;text-align:center;min-height:56px"><button data-act="gShortOk" style="flex:0 0 110px;font-size:17px">입력</button></div>`
      : `<div class="pad">${Array.from({length: e.choices}, (_, i) => i + 1).map(v => `<button data-act="gAns" data-v="${v}" ${Number(cv) === v ? 'style="background:var(--red);color:#fff"' : ''}>${CIRC[v]}</button>`).join('')}</div>`}
    <div class="row" style="margin-bottom:10px"><button class="btn o s" data-act="gMove" data-v="-1">← 이전</button><button class="btn o s" data-act="gAns" data-v="0">비우기</button><button class="btn o s" data-act="gMove" data-v="1">다음 →</button>
    <input data-in="gPaste" placeholder="${(e.short.common || []).length || Object.values(e.short).some(x => (x || []).length) ? '한 번에: 띄어쓰기로 구분 후 Enter' : '한 번에: 숫자 이어서 치고 Enter'} (빈칸 0)" style="flex:1;min-width:200px"></div>
    <div class="grid">${Array.from({length: n}, (_, i) => { const q = i + 1, v = g.answers[i], on = v !== null && v !== undefined && v !== '';
      return `<button class="q ${on && wset.has(q) ? 'x' : ''} ${on && !wset.has(q) ? 'ok' : ''} ${g.cur === q ? 'cur' : ''}" data-act="gCur" data-q="${q}">${q}<small>${on ? esc(fmtAns(e, c.tr, q, v)) : '·'}</small>${extra(q)}</button>`; }).join('')}</div>`;
  } else {
    omr = `<h3>틀린 문항을 눌러 표시 · <span class="small">빨간 숫자 = 배점</span></h3><div class="grid">${Array.from({length: n}, (_, i) => { const q = i + 1;
      return `<button class="q ${wset.has(q) ? 'x' : ''}" data-act="gWrong" data-q="${q}" aria-pressed="${wset.has(q)}">${q}${extra(q)}</button>`; }).join('')}</div>
    <div class="row" style="margin-top:10px"><button class="btn o s" data-act="gClear">표시 모두 지우기</button></div>`;
  }
  el('g-omr').innerHTML = omr;
  el('g-res').innerHTML = `<div class="small">${esc(examSubj(e))}${c.tr !== 'all' ? ' · ' + esc(trackName(e, c.tr)) : ''}</div><div class="big"><span class="score">${c.score}</span><span class="grade">${c.gr ? c.gr + '등급' : (e.grading === 'none' ? '/ ' + c.total : '등급 -')}</span></div>
  <div class="kv"><span>틀린 문항</span><b>${c.wrong.length}개</b></div><div class="kv"><span>인접 등급컷</span><b>${esc(c.adj)}</b></div>
  ${c.areas.map(a => `<div class="kv"><span>${esc(a.n)}</span><b>${a.c}개</b></div>`).join('')}
  ${c.blank ? `<div class="warn">아직 ${c.blank}문항이 비어 있어요. 빈 문항은 틀린 것으로 계산돼요.</div>` : ''}
  ${c.total !== +e.max ? `<div class="warn">이 시험의 배점 합계(${c.total}점)가 만점(${esc(e.max)}점)과 달라요. 시험 설정을 확인하세요.</div>` : ''}`;
  el('g-wcount').textContent = `${c.wrong.length}문항`;
  el('g-wrong').innerHTML = c.wrong.length ? c.wrong.map(q => { const d = diff(e, c.tr, q, c.st), nt = g.notes[q] || {}, k = keyOf(e, c.tr, q), v = g.answers[q - 1], star = c.picks.includes(q);
    return `<div class="wq"><div class="h"><button class="chip ${star ? 'on' : ''}" data-act="gPick" data-q="${q}" title="보고서 오답">★</button><b>${q}번</b>${lvBadge(d)}<span class="tag">${esc(typeOf(e, c.tr, q))}</span><span class="tag">${pts(e, c.tr, q)}점</span>${k !== null ? `<span class="tag g">정답 ${esc(fmtAns(e, c.tr, q, k))}</span>` : ''}${c.mode === 'answers' ? `<span class="tag r">학생 ${esc(fmtAns(e, c.tr, q, v))}</span>` : ''}</div>
    <div class="chips">${CAUSES.map(cs => `<button class="chip ${(nt.causes || []).includes(cs) ? 'on' : ''}" data-act="gCause" data-q="${q}" data-c="${esc(cs)}">${esc(cs)}</button>`).join('')}</div>
    <input data-in="gMemo" data-q="${q}" value="${esc(nt.memo || '')}" placeholder="메모"></div>`; }).join('') : '<div class="empty">틀린 문항이 없어요.</div>';
  const chips = String(g.attitude).split(',').map(x => x.trim());
  el('g-att').innerHTML = ATT.map(a => `<button class="chip ${chips.includes(a) ? 'on' : ''}" data-act="gAttChip" data-v="${esc(a)}">${esc(a)}</button>`).join('');
  const sbt = el('g-savebtn'); if (sbt) sbt.disabled = !g.student_id;
}
async function gSave() {
  const c = gCtx(), g = S.g; if (!c || !g.student_id) { toast('학생과 시험을 선택하세요'); return; }
  const n = QN(c.e);
  const row = {id: g.id || uid(), academy_id: S.academy.id, student_id: g.student_id, exam_id: g.exam_id, status: 'done', planned_date: g.planned_date, taken_date: g.taken_date || today(), subject: c.tr, mode: c.mode,
    answers: c.mode === 'answers' ? Array.from({length: n}, (_, i) => { const v = g.answers[i]; return v === null || v === undefined || v === '' ? null : +v; }) : [], wrong: c.wrong.slice(), attitude: g.attitude.trim(), picks: c.picks.slice(), notes: g.notes};
  for (const q of Object.keys(row.notes)) if (!c.wrong.includes(+q)) delete row.notes[q];
  const r = await save('attempts', row);
  const s = stuById(g.student_id);
  if (s && isSplit(c.e)) {
    const cur = c.e.subject === 'kor' ? s.subject : (s.tracks || {})[c.e.subject];
    if (cur !== c.tr) { const ns = {...s, tracks: {...(s.tracks || {})}}; if (c.e.subject === 'kor') ns.subject = c.tr; else ns.tracks[c.e.subject] = c.tr; try { await save('students', ns); } catch (e) {} }
  }
  S.g = null; toast('저장했어요'); go('report', r.id);
}

/* ---------- 보고서 ---------- */
function reportFields(a, r) {
  const s = stuById(a.student_id) || {name: '(삭제된 학생)', school: '', grade: ''};
  const tn = r.tr !== 'all' ? ` (${trackName(r.e, r.tr)})` : '';
  return [['이름', `${s.name} (${s.school}·${s.grade}학년)`], ['시험명', r.e.title], ['과목', examSubj(r.e) + tn], ['시험응시태도', a.attitude || '-'], ['점수 · 등급', `${r.score}점${r.e.max !== 100 ? ' / ' + r.e.max + '점' : ''}${r.g ? ' · ' + r.g + '등급' : ''}`], ['인접 등급컷', r.adj],
    ['영역별 틀린 개수', r.areas.map(x => `${x.n}-${x.c}`).join(', ')], ['오답', (a.picks || []).length ? [...a.picks].sort((x, y) => x - y).map(q => q + '번').join(', ') : '-'], ['작성 날짜', fmtDate(a.taken_date)]];
}
function vReport() {
  const a = S.attempts.find(x => x.id === S.p), r = a && evalAttempt(a); if (!r) return '<div class="empty">보고서를 찾을 수 없어요.</div>';
  const st = examStats(r.e);
  return `<div class="top noprint"><div><button class="btn o s" data-act="openStudent" data-id="${a.student_id}">← 학생 페이지</button></div>
  <div class="row"><button class="btn r s" data-act="copyReport" data-id="${a.id}">텍스트 복사</button><button class="btn o s" data-act="print">인쇄</button><button class="btn o s" data-act="editAttempt" data-id="${a.id}">채점 수정</button><button class="btn o s" data-act="delAttempt" data-id="${a.id}">삭제</button></div></div>
  <div class="report"><div class="title">클리닉 보고 (모의고사 편)</div><table>${reportFields(a, r).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table><div class="foot">${esc(S.academy.name)}</div></div>
  ${(() => { const tc = {}; r.wrong.forEach(q => { const t = typeOf(r.e, r.tr, q); tc[t] = (tc[t] || 0) + 1; }); const arr = Object.entries(tc).sort((a, b) => b[1] - a[1]); return arr.length ? `<h2>유형별 오답</h2><div class="row">${arr.map(([t, n]) => `<span class="tag r">${esc(t)} ${n}</span>`).join('')}</div><div class="row noprint" style="margin-top:10px"><button class="btn r s" data-act="clinicSheet" data-id="${a.student_id}" data-sub="${r.e.subject}">${icon('file', 16)}이 학생 맞춤 시험지 만들기</button></div>` : ''; })()}
  <h2>전체 오답 (${r.wrong.length}문항)</h2>
  ${r.wrong.length ? `<div class="scroll tbl"><table><thead><tr><th>번호</th><th>영역</th><th class="n">배점</th><th>난이도</th><th class="n">정답</th><th class="n">학생 답</th><th>원인 · 메모</th></tr></thead><tbody>
  ${r.wrong.map(q => { const d = diff(r.e, r.tr, q, st), n = (a.notes || {})[q] || {}, k = keyOf(r.e, r.tr, q);
    return `<tr><td>${q}${(a.picks || []).includes(q) ? ' ★' : ''}</td><td>${esc(areaOf(r.e, r.tr, q))}</td><td class="n">${pts(r.e, r.tr, q)}</td><td>${lvBadge(d)}</td><td class="n">${k === null ? '-' : esc(fmtAns(r.e, r.tr, q, k))}</td><td class="n">${a.mode === 'answers' ? esc(fmtAns(r.e, r.tr, q, (a.answers || [])[q-1])) : '-'}</td><td>${esc([(n.causes || []).join(', '), n.memo].filter(Boolean).join(' · ')) || '-'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">만점이에요!</div>'}`;
}

/* ---------- 유형 체계 · 취약 유형 ---------- */
const TAXO = {
  kor: ['독서>인문', '독서>사회', '독서>과학', '독서>기술', '독서>예술', '독서>융합', '문학>현대시', '문학>고전시가', '문학>현대소설', '문학>고전소설', '문학>수필', '문학>극·시나리오', '화법', '작문', '화법·작문 통합', '문법>음운', '문법>형태', '문법>통사', '문법>의미·담화', '문법>중세국어', '매체'],
  math: ['공통수학>다항식', '공통수학>방정식·부등식', '공통수학>도형의 방정식', '공통수학>집합·명제', '공통수학>함수', '공통수학>경우의 수', '공통수학>행렬', '수학Ⅰ>지수·로그', '수학Ⅰ>지수·로그함수', '수학Ⅰ>삼각함수', '수학Ⅰ>수열', '수학Ⅱ>함수의 극한·연속', '수학Ⅱ>미분', '수학Ⅱ>적분', '확률과통계>경우의 수', '확률과통계>확률', '확률과통계>통계', '미적분>수열의 극한', '미적분>미분법', '미적분>적분법', '기하>이차곡선', '기하>평면벡터', '기하>공간도형·좌표'],
  eng: ['듣기', '목적', '심경', '주장', '요지', '주제', '제목', '도표', '내용일치', '어법', '어휘', '빈칸 추론', '흐름 무관', '글의 순서', '문장 삽입', '요약문', '장문'],
  hist: ['선사·고조선', '삼국·남북국', '고려', '조선 전기', '조선 후기', '개항기', '일제강점기', '현대'],
  inq: [], etc: []
};
function typeList(subj) {
  const set = new Set(TAXO[subj] || []);
  S.exams.filter(e => e.subject === subj).forEach(e => Object.values(e.types || {}).forEach(a => (a || []).forEach(t => t && set.add(t))));
  (S.items || []).filter(i => i.subject === subj).forEach(i => i.type && set.add(i.type));
  return [...set];
}
const taxoDatalists = () => Object.keys(SUBJECTS).map(k => `<datalist id="taxo-${k}">${typeList(k).map(t => `<option value="${esc(t)}">`).join('')}</datalist>`).join('');
function typeOf(e, tr, q) { const [s, i] = secOf(e, tr, q), t = ((e.types || {})[s] || [])[i]; return t || areaOf(e, tr, q); }
/* 학생의 유형별 정답률 (과목별) */
function weakTypes(sid, subj) {
  const m = {};
  for (const a of doneOf(sid)) {
    const r = evalAttempt(a); if (!r || (subj && r.e.subject !== subj)) continue;
    const w = new Set(r.wrong);
    for (let q = 1; q <= QN(r.e); q++) { const t = typeOf(r.e, r.tr, q); if (!t || t === '-') continue; const k = r.e.subject + '|' + t, o = m[k] || (m[k] = {subject: r.e.subject, type: t, n: 0, w: 0}); o.n++; if (w.has(q)) o.w++; }
  }
  return Object.values(m).filter(o => o.w > 0).map(o => ({...o, rate: (o.n - o.w) / o.n})).sort((a, b) => a.rate - b.rate || b.w - a.w);
}
const typeMatch = (a, b) => a === b || a.startsWith(b + '>') || b.startsWith(a + '>');
function usedBy(sid) { const u = new Set(); (S.worksheets || []).filter(w => (w.student_ids || []).includes(sid)).forEach(w => (w.items || []).forEach(i => u.add(i))); return u; }
function recItems(subj, type, sid) {
  const used = sid ? usedBy(sid) : new Set();
  return (S.items || []).filter(i => i.subject === subj && i.type && typeMatch(i.type, type)).sort((a, b) => (used.has(a.id) - used.has(b.id)) || (i => ({상: 0, 중: 1, 하: 2})[i.level] ?? 3)(a) - (i => ({상: 0, 중: 1, 하: 2})[i.level] ?? 3)(b));
}

/* ---------- 문제은행 ---------- */
S.cart = (() => { try { return JSON.parse(LS.get('mc2-cart') || '[]'); } catch (e) { return []; } })();
const saveCart = () => LS.set('mc2-cart', JSON.stringify(S.cart));
const itemQCount = it => (it.questions || []).length || 1;
function thumb(it) {
  const img = it.passage_img || ((it.questions || [])[0] || {}).img;
  if (img) return `<img src="${esc(img)}" alt="" style="width:100%;height:140px;object-fit:cover;object-position:top;border-radius:10px;border:1px solid var(--hair);background:#fff">`;
  const txt = it.passage_text || ((it.questions || [])[0] || {}).text || '';
  return `<div style="height:140px;overflow:hidden;border-radius:10px;border:1px solid var(--hair);background:var(--soft);padding:10px;font-size:13px;white-space:pre-wrap;color:var(--mut)">${esc(txt.slice(0, 220)) || '(내용 없음)'}</div>`;
}
const LV_ORDER = ['상', '중', '하'];
function vBank() {
  const tab = S.tab || 'items';
  const tabs = `<div class="tabs">${[['items', '문제'], ['sheets', '시험지']].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</div>`;
  const cartBtn = `<button class="btn r" data-act="openCart">${icon('file', 18)}시험지 만들기${S.cart.length ? ` (${S.cart.length})` : ''}</button>`;
  if (tab === 'sheets') {
    const ws = [...(S.worksheets || [])].sort((a, b) => String(b.created_at || b.date || '').localeCompare(String(a.created_at || a.date || '')));
    return `<div class="top"><div><h1>문제은행</h1><div class="small">만든 시험지는 다시 열어서 인쇄하거나 고칠 수 있어요.</div></div>${cartBtn}</div>${tabs}
    ${ws.length ? `<div class="list">${ws.map(w => `<button class="item" data-act="openSheet" data-id="${w.id}"><span class="grow"><b>${esc(w.title)}</b><br><span class="small">${fmtDate(w.date)} · ${(w.items || []).length}세트 · ${(w.student_ids || []).map(id => (stuById(id) || {}).name).filter(Boolean).map(esc).join(', ') || '대상 미지정'}</span></span><span class="tag">${w.cols === 1 ? '1단' : '2단'}</span></button>`).join('')}</div>` : '<div class="empty">아직 만든 시험지가 없어요. 문제 탭에서 문제를 담아 만들어보세요.</div>'}`;
  }
  const f = S.f, subj = f.bsub || '', q = (S.q || '').trim();
  const list = (S.items || []).filter(i => (!subj || i.subject === subj) && (!f.btype || (i.type && typeMatch(i.type, f.btype))) && (!f.blv || i.level === f.blv) && (!q || [i.type, i.source, i.passage_text, ...(i.questions || []).map(x => x.text)].join(' ').includes(q)))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return `<div class="top"><div><h1>문제은행</h1><div class="small">학원 자료를 올려두면 학생 취약 유형에 맞춰 추천하고 시험지로 만들 수 있어요.</div></div>
  <div class="row"><button class="btn r" data-act="aiGen">✨ AI로 문제 만들기</button><button class="btn o" data-act="bulkAdd">${icon('plus', 18)}이미지 여러 장 추가</button><button class="btn o" data-act="newItem">${icon('plus', 18)}문제 추가</button>${cartBtn}</div></div>${tabs}
  <div class="seg" style="margin-bottom:10px">${[['', '전체'], ...Object.entries(SUBJECTS)].map(([k, l]) => `<button class="${subj === k ? 'on' : ''}" data-act="bsub" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="fields" style="margin-bottom:12px"><label>유형<input data-in="btype" list="taxo-${subj || 'kor'}" value="${esc(f.btype || '')}" placeholder="예: 독서>과학"></label>
  <label>난이도<select data-in="blv"><option value="">전체</option>${LV_ORDER.map(l => `<option ${f.blv === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>검색<input data-in="q" value="${esc(S.q)}" placeholder="출처·지문 내용"></label></div>
  <p class="small">${list.length}개</p>
  ${list.length ? `<div class="cards">${list.map(it => { const inCart = S.cart.includes(it.id);
    return `<div class="card" style="padding:12px;display:grid;gap:8px">${thumb(it)}<div class="row" style="gap:6px"><span class="tag b">${esc(SUBJECTS[it.subject] || '')}${it.subname ? ' ' + esc(it.subname) : ''}</span>${it.type ? `<span class="tag">${esc(it.type)}</span>` : ''}${it.level ? `<span class="lv ${it.level}">${it.level}</span>` : ''}<span class="tag">${it.kind === 'set' ? '지문 세트 · ' + itemQCount(it) + '문항' : '단일'}</span></div>
    ${it.source ? `<span class="small">${esc(it.source)}</span>` : ''}<div class="row"><button class="btn s ${inCart ? '' : 'r'}" data-act="cartToggle" data-id="${it.id}">${inCart ? '담김 ✓' : '담기'}</button><button class="btn o s" data-act="editItem" data-id="${it.id}">수정</button><button class="btn o s" data-act="delItem" data-id="${it.id}">삭제</button></div></div>`; }).join('')}</div>`
    : `<div class="empty">${(S.items || []).length ? '조건에 맞는 문제가 없어요.' : '아직 문제가 없어요.<br><b>✨ AI로 문제 만들기</b>로 원하는 유형의 새 문제를 바로 만들거나,<br>학원 자료를 캡처해 <b>문제 추가</b>로 올리세요.'}</div>`}${taxoDatalists()}`;
}
/* 이미지 줄이기 (최대 폭 1400px, JPEG) */
function compressImage(file) {
  return new Promise((ok, no) => {
    const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = () => {
      const max = 1400, sc = Math.min(1, max / im.width), c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .85)); };
      im.onerror = () => no('이미지를 읽지 못했어요'); im.src = rd.result; };
    rd.onerror = () => no('파일을 읽지 못했어요'); rd.readAsDataURL(file);
  });
}
function itemDraft(src) {
  if (src) return JSON.parse(JSON.stringify(src));
  const subj = S.f.bsub || 'kor';
  return {id: null, academy_id: S.academy.id, subject: subj, subname: '', type: S.f.btype || '', level: '', source: '', kind: subj === 'kor' || subj === 'eng' ? 'set' : 'single', passage_img: '', passage_text: '', questions: [{img: '', text: '', answer: ''}]};
}
const dropZone = (key, img, label) => `<div class="drop ${S.dropKey === key ? 'on' : ''}" data-act="dropSel" data-k="${key}" tabindex="0">${img ? `<img src="${esc(img)}" alt="">` : `<span>${label}<br><span class="small">클릭한 뒤 Ctrl+V(⌘+V)로 캡처 붙여넣기, 또는 파일 선택</span></span>`}</div>
  <div class="row" style="margin-top:6px"><label class="btn o s" style="display:inline-flex;align-items:center">파일 선택<input type="file" accept="image/*" data-in="dropFile" data-k="${key}" style="display:none"></label>${img ? `<button class="btn o s" data-act="dropClear" data-k="${key}">이미지 지우기</button>` : ''}</div>`;
function vItemEdit() {
  const it = S.it, isSet = it.kind === 'set';
  return `<div class="top"><div><button class="btn o s" data-act="cancelItem">← 취소</button><h1 style="margin-top:10px">${it.id ? '문제 수정' : '문제 추가'}</h1></div></div>
  <div class="card"><div class="fields"><label>과목<select data-in="it" data-k="subject">${Object.entries(SUBJECTS).map(([k, l]) => `<option value="${k}" ${it.subject === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  ${it.subject === 'inq' || it.subject === 'etc' ? `<label>과목명<input data-in="it" data-k="subname" value="${esc(it.subname)}" placeholder="예: 생활과 윤리"></label>` : ''}
  <label>유형<input data-in="it" data-k="type" list="taxo-${it.subject}" value="${esc(it.type)}" placeholder="목록에서 고르거나 직접 입력"></label>
  <label>난이도<select data-in="it" data-k="level"><option value="">미정</option>${LV_ORDER.map(l => `<option ${it.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  <label style="margin-top:10px">출처<input data-in="it" data-k="source" value="${esc(it.source)}" placeholder="예: 2025 고2 9월 학평 31번, 학원 자체 제작"></label>
  <div class="row" style="margin-top:12px"><div class="seg">${[['single', '단일 문제'], ['set', '지문 세트 (지문 + 여러 문제)']].map(([k, l]) => `<button class="${it.kind === k ? 'on' : ''}" data-act="itKind" data-v="${k}">${l}</button>`).join('')}</div></div></div>
  ${isSet ? `<h2>지문</h2><div class="card">${dropZone('p', it.passage_img, '지문 이미지')}<label style="margin-top:10px">지문 텍스트 (선택 · 이미지가 없을 때)<textarea data-in="itPText" style="min-height:120px">${esc(it.passage_text)}</textarea></label></div>` : ''}
  <h2>${isSet ? '문제' : '문제 내용'}</h2>
  <div class="list">${it.questions.map((qq, i) => `<div class="card"><div class="row" style="justify-content:space-between"><b>${isSet ? `${i + 1}번째 문제` : '문제'}</b>${isSet && it.questions.length > 1 ? `<button class="btn o s" data-act="itQDel" data-i="${i}">삭제</button>` : ''}</div>
    <div style="margin-top:8px">${dropZone('q' + i, qq.img, '문제 이미지')}</div>
    <label style="margin-top:10px">문제 텍스트 (선택)<textarea data-in="itQ" data-i="${i}" data-k="text">${esc(qq.text)}</textarea></label>
    <div class="fields" style="margin-top:8px"><label>정답<input data-in="itQ" data-i="${i}" data-k="answer" value="${esc(qq.answer)}" placeholder="예: ③ 또는 24"></label></div>
    <label style="margin-top:8px">해설 (선택)<textarea data-in="itQ" data-i="${i}" data-k="explain">${esc(qq.explain || '')}</textarea></label></div>`).join('')}</div>
  ${isSet ? '<div class="row" style="margin-top:10px"><button class="btn o" data-act="itQAdd">+ 문제 추가</button></div>' : ''}
  <div class="row" style="margin-top:16px"><button class="btn r" data-act="saveItem">저장</button>${it.id ? '' : '<button class="btn o" data-act="saveItemNext">저장하고 하나 더</button>'}<button class="btn o" data-act="cancelItem">취소</button></div>${taxoDatalists()}`;
}
function setDropImg(key, data) { const it = S.it; if (!it) return; if (key === 'p') it.passage_img = data; else { const i = +key.slice(1); if (it.questions[i]) it.questions[i].img = data; } render(); }
function bulkForm() {
  const subj = S.f.bsub || 'kor';
  modal(`<h2 style="margin:0">이미지 여러 장 추가</h2><p class="small" style="margin:0">잘라둔 문제 이미지를 한 번에 올려요. 이미지 한 장이 문제 하나가 돼요.</p>
  <div class="fields"><label>과목<select id="bk-sub">${Object.entries(SUBJECTS).map(([k, l]) => `<option value="${k}" ${subj === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>난이도<select id="bk-lv"><option value="">미정</option>${LV_ORDER.map(l => `<option>${l}</option>`).join('')}</select></label></div>
  <label>유형<input id="bk-type" list="taxo-${subj}" placeholder="예: 빈칸 추론"></label><label>출처<input id="bk-src" placeholder="예: 2025 고3 6월 모평"></label>
  <label>이미지 파일 (여러 장 선택 가능)<input id="bk-files" type="file" accept="image/*" multiple></label>
  <div class="row"><button class="btn r" id="bk-go">올리기</button><button class="btn o" data-act="closeModal">취소</button></div>${taxoDatalists()}`);
  document.getElementById('bk-go').onclick = async () => {
    const files = [...document.getElementById('bk-files').files]; if (!files.length) { toast('이미지를 선택하세요'); return; }
    const sub = document.getElementById('bk-sub').value, type = document.getElementById('bk-type').value.trim(), lv = document.getElementById('bk-lv').value, src = document.getElementById('bk-src').value.trim();
    const btn = document.getElementById('bk-go'); btn.disabled = true;
    let n = 0;
    for (const f of files) { try { btn.textContent = `올리는 중 ${++n}/${files.length}`; const img = await compressImage(f);
      await save('items', {id: uid(), academy_id: S.academy.id, subject: sub, subname: '', type, level: lv, source: src || f.name.replace(/\.[^.]+$/, ''), kind: 'single', passage_img: '', passage_text: '', questions: [{img, text: '', answer: ''}], created_at: new Date().toISOString()}); } catch (e) {} }
    closeModal(); toast(`${n}개 올렸어요. 정답은 각 문제의 수정에서 넣을 수 있어요`); S.f.bsub = sub; render();
  };
}
/* ---------- AI 문제 만들기 ---------- */
function aiForm(o = {}, lead = '') {
  const subj = o.subject || S.f.bsub || 'kor', lvl = o.level || '중';
  const setOk = s => ['kor', 'eng', 'inq', 'hist', 'etc'].includes(s);
  modal(`<h2 style="margin:0">✨ AI로 문제 만들기</h2>${lead ? `<p style="margin:0">${esc(lead)}</p>` : ''}
  <p class="small" style="margin:0">수능·모의고사 형식의 새 문제를 만들어요. 저장하기 전에 확인하고 고를 수 있어요.</p>
  <div class="fields"><label>과목<select id="ai-sub">${Object.entries(SUBJECTS).map(([k, l]) => `<option value="${k}" ${subj === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label>난이도<select id="ai-lv">${LV_ORDER.map(l => `<option ${lvl === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  <label id="ai-subname-w" style="${subj === 'inq' || subj === 'etc' ? '' : 'display:none'}">과목명<input id="ai-subname" placeholder="예: 생활과 윤리, 물리학Ⅰ" value="${esc(o.subname || '')}"></label>
  <label>유형${o.types && o.types.length > 1 ? ' <span class="small">(학생 약점: ' + o.types.slice(0, 4).map(esc).join(', ') + ')</span>' : ''}<input id="ai-type" list="taxo-${subj}" value="${esc(o.type || S.f.btype || '')}" placeholder="예: 독서>과학, 빈칸 추론, 수열"></label>
  <div class="fields"><label>형태<select id="ai-kind">${setOk(subj) ? `<option value="set" ${subj === 'kor' || subj === 'eng' ? 'selected' : ''}>지문 세트 (지문 + 여러 문항)</option>` : ''}<option value="single" ${subj === 'kor' || subj === 'eng' ? '' : 'selected'}>단일 문항</option></select></label>
  <label><span id="ai-cnt-l">${subj === 'kor' || subj === 'eng' ? '세트 수' : '문항 수'}</span><input id="ai-cnt" type="number" min="1" max="10" value="${subj === 'kor' || subj === 'eng' ? 2 : 5}"></label>
  <label id="ai-per-w">세트당 문항<input id="ai-per" type="number" min="2" max="5" value="3"></label></div>
  <label>품질<select id="ai-q"><option value="best" ${(LS.get('hit100-aiq') || 'best') === 'best' ? 'selected' : ''}>최고 (가장 정교함 · 느리고 비쌈)</option><option value="std" ${LS.get('hit100-aiq') === 'std' ? 'selected' : ''}>표준</option><option value="fast" ${LS.get('hit100-aiq') === 'fast' ? 'selected' : ''}>빠름 (저렴)</option></select></label>
  <label>추가 요청 (선택)<textarea id="ai-note" placeholder="예: 경제 제재로, 그래프 해석 포함 / 함정 선지 많이">${esc(o.note || '')}</textarea></label>
  <div class="row"><button class="btn r" id="ai-go">만들기</button><button class="btn o" data-act="closeModal">취소</button></div>
  <p class="small" id="ai-msg" style="margin:0"></p>${taxoDatalists()}`);
  const $ = id => document.getElementById(id);
  const sync = () => { const set = $('ai-kind').value === 'set'; $('ai-per-w').style.display = set ? '' : 'none'; $('ai-cnt-l').textContent = set ? '세트 수' : '문항 수'; $('ai-cnt').max = set ? 4 : 10; };
  $('ai-kind').onchange = sync; sync();
  $('ai-sub').onchange = () => { const v = $('ai-sub').value; closeModal(); aiForm({...o, subject: v, type: ''}, lead); };
  $('ai-go').onclick = async () => {
    const sub = $('ai-sub').value, kind = $('ai-kind').value, lv = $('ai-lv').value, type = $('ai-type').value.trim(), subname = ($('ai-subname') || {}).value || '';
    const n = Math.max(1, Math.min(kind === 'set' ? 4 : 10, +$('ai-cnt').value || 1)), per = +$('ai-per').value || 3, note = $('ai-note').value.trim(), quality = $('ai-q').value; LS.set('hit100-aiq', quality);
    if (!type) { $('ai-msg').textContent = '유형을 입력하세요.'; return; }
    const btn = $('ai-go'); btn.disabled = true;
    const jobs = kind === 'set' ? Array.from({length: n}, () => 1) : (() => { const a = []; let r = n; while (r > 0) { a.push(Math.min(5, r)); r -= 5; } return a; })();
    let done = 0, out = [], errs = [];
    const tick = () => { $('ai-msg').textContent = `만드는 중… ${done}/${jobs.length} (지문 → 문제 순서로 만들어서 1~3분 걸려요)`; }; tick();
    const snip = it => (it.passage_text || ((it.questions || [])[0] || {}).text || '').replace(/\s+/g, ' ').slice(0, 70);
    const avoid = [...(S.aiRes || []), ...(S.items || [])].filter(it => it.subject === sub && (!type || !it.type || typeMatch(it.type, type))).map(snip).filter(Boolean).slice(0, 25);
    await Promise.all(jobs.map((c, ji) => API.genItems({academy_id: S.academy.id, subject: sub, subname, type, level: lv, kind, count: c, perSet: per, quality, note: [note, jobs.length > 1 ? `(이번 요청은 ${jobs.length}개 중 ${ji + 1}번째. 다른 요청과 소재가 겹치지 않게)` : ''].filter(Boolean).join(' '), avoid})
      .then(r => { out = out.concat(r); }).catch(e => errs.push(String(e))).finally(() => { done++; tick(); })));
    if (!out.length) { btn.disabled = false; $('ai-msg').textContent = '실패: ' + (errs[0] || '결과가 없어요'); return; }
    closeModal(); S.aiRes = out.map(it => ({...it, _id: uid()})); S.aiPick = new Set(S.aiRes.map(x => x._id)); S.aiFor = o.sid || null; S.aiLast = {...o, subject: sub, type, level: lv};
    if (errs.length) toast(`일부 실패 (${errs.length}건): ${errs[0]}`); go('aiReview');
  };
}
function vAiReview() {
  const res = S.aiRes || [], pick = S.aiPick || new Set(), sel = res.filter(x => pick.has(x._id)).length;
  const qHtml = (q, n) => `<div style="margin-top:10px"><div style="white-space:pre-wrap"><b>${n}.</b> ${esc(q.text)}</div><div class="small" style="margin-top:6px"><b>정답 ${esc(q.answer || '-')}</b>${q.explain ? ` · <span style="white-space:pre-wrap">${esc(q.explain)}</span>` : ''}</div></div>`;
  return `<div class="top"><div><button class="btn o s" data-act="nav" data-v="bank">← 문제은행</button><h1 style="margin-top:10px">AI가 만든 문제</h1><div class="small">${res.length}개 중 ${sel}개 선택 · 마음에 안 드는 건 체크를 풀고 저장하세요. 저장한 뒤에도 수정할 수 있어요.</div></div>
  <div class="row"><button class="btn o" data-act="aiGen">다시 만들기</button><button class="btn o" data-act="aiSave" ${sel ? '' : 'disabled'}>문제은행에 저장</button><button class="btn r" data-act="aiSaveCart" ${sel ? '' : 'disabled'}>저장하고 시험지 만들기</button></div></div>
  <p class="small">AI가 만든 문제는 가끔 틀릴 수 있어요. 특히 수학은 정답을 한 번 확인해 주세요.</p>
  <div class="list">${res.map(it => `<div class="card"><label class="row" style="gap:8px;color:var(--ink);cursor:pointer"><input type="checkbox" data-in="aiPick" data-id="${it._id}" ${pick.has(it._id) ? 'checked' : ''} style="width:auto;min-height:0">
    <span class="tag b">${esc(SUBJECTS[it.subject] || '')}${it.subname ? ' ' + esc(it.subname) : ''}</span><span class="tag">${esc(it.type)}</span><span class="lv ${it.level}">${it.level}</span><span class="tag">${it.kind === 'set' ? '지문 세트 · ' + it.questions.length + '문항' : '단일'}</span></label>
    ${it.passage_text ? `<div class="pt" style="white-space:pre-wrap;margin-top:10px;padding:12px;border:1px solid var(--hair);border-radius:10px;background:var(--soft);font-size:14px">${esc(it.passage_text)}</div>` : ''}
    ${it.questions.map((q, i) => qHtml(q, i + 1)).join('')}</div>`).join('')}</div>`;
}
async function aiSaveSel() {
  const res = (S.aiRes || []).filter(x => (S.aiPick || new Set()).has(x._id)), ids = [];
  for (const it of res) { const {_id, ...row} = it; row.id = uid(); row.academy_id = S.academy.id; row.created_at = new Date().toISOString(); await save('items', row); ids.push(row.id); }
  S.aiRes = (S.aiRes || []).filter(x => !(S.aiPick || new Set()).has(x._id)); S.aiPick = new Set(); return ids;
}

/* ---------- 시험지 ---------- */
function sheetDraft(src, o = {}) {
  if (src) return JSON.parse(JSON.stringify(src));
  return {id: null, academy_id: S.academy.id, title: o.title || `클리닉 시험지 ${fmtDate(today())}`, date: today(), student_ids: o.student_ids || [], items: (o.items || S.cart).slice(), cols: 2, with_answers: true, memo: ''};
}
function vSheet() {
  const w = S.ws, items = w.items.map(id => (S.items || []).find(i => i.id === id)).filter(Boolean), totalQ = items.reduce((t, i) => t + itemQCount(i), 0);
  const studs = [...visibleStudents()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return `<div class="top"><div><button class="btn o s" data-act="nav" data-v="bank">← 문제은행</button><h1 style="margin-top:10px">${w.id ? '시험지 수정' : '시험지 만들기'}</h1><div class="small">${items.length}세트 · ${totalQ}문항</div></div>
  <div class="row"><button class="btn o" data-act="sheetSave">저장</button><button class="btn r" data-act="sheetPreview" ${items.length ? '' : 'disabled'}>${icon('file', 18)}미리보기 · 인쇄</button></div></div>
  <div class="work"><div>
  <div class="card"><label>시험지 제목<input data-in="ws" data-k="title" value="${esc(w.title)}"></label>
  <div class="fields" style="margin-top:10px"><label>날짜<input type="date" data-in="ws" data-k="date" value="${esc(w.date)}"></label>
  <label>배치<select data-in="ws" data-k="cols"><option value="2" ${w.cols !== 1 ? 'selected' : ''}>2단</option><option value="1" ${w.cols === 1 ? 'selected' : ''}>1단</option></select></label>
  <label>정답지<select data-in="ws" data-k="with_answers"><option value="1" ${w.with_answers ? 'selected' : ''}>뒤에 붙이기</option><option value="0" ${w.with_answers ? '' : 'selected'}>빼기</option></select></label></div>
  <label style="margin-top:10px">대상 학생 <span class="small">(이 학생에게 낸 문제는 다음 추천에서 뒤로 밀려요)</span><select data-in="wsStu"><option value="">+ 학생 추가</option>${studs.filter(s => !w.student_ids.includes(s.id)).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
  <div class="chips" style="margin-top:6px">${w.student_ids.map(id => stuById(id)).filter(Boolean).map(s => `<button class="chip on" data-act="wsStuDel" data-id="${s.id}">${esc(s.name)} ✕</button>`).join('')}</div></div>
  <h2>문제 순서</h2>
  ${items.length ? `<div class="list">${items.map((it, i) => `<div class="item" style="cursor:default"><span class="tag">${i + 1}</span><span class="grow"><b>${esc(SUBJECTS[it.subject])} · ${esc(it.type || '유형 없음')}</b><br><span class="small">${it.kind === 'set' ? '지문 세트 ' + itemQCount(it) + '문항' : '단일'}${it.level ? ' · ' + it.level : ''}${it.source ? ' · ' + esc(it.source) : ''}</span></span>
    <button class="btn o s" data-act="wsMove" data-i="${i}" data-v="-1" ${i ? '' : 'disabled'}>↑</button><button class="btn o s" data-act="wsMove" data-i="${i}" data-v="1" ${i < items.length - 1 ? '' : 'disabled'}>↓</button><button class="btn o s" data-act="wsDel" data-id="${it.id}">빼기</button></div>`).join('')}</div>` : '<div class="empty">담긴 문제가 없어요. 문제은행에서 담거나, 학생 약점 분석에서 맞춤 시험지를 만들어보세요.</div>'}
  </div><div class="res"><b>추가로 담기</b><p class="small">문제은행에서 바로 골라 담을 수 있어요.</p>
  <input data-in="wsFind" placeholder="유형·출처 검색" value="${esc(S.f.wsFind || '')}">
  <div class="list" style="margin-top:10px;max-height:60vh;overflow:auto">${(S.items || []).filter(i => !w.items.includes(i.id) && (!S.f.wsFind || [i.type, i.source, SUBJECTS[i.subject]].join(' ').includes(S.f.wsFind))).slice(0, 40).map(i => `<div class="row" style="gap:8px;border-top:1px solid var(--hair);padding-top:8px"><span style="flex:1;font-size:14px"><b>${esc(SUBJECTS[i.subject])}</b> ${esc(i.type || '')}<br><span class="small">${esc(i.source || '')}</span></span><button class="btn s r" data-act="wsAdd" data-id="${i.id}">담기</button></div>`).join('') || '<p class="small">더 담을 문제가 없어요.</p>'}</div></div></div>`;
}
function vSheetView() {
  const w = (S.worksheets || []).find(x => x.id === S.p) || S.ws; if (!w) return '<div class="empty">시험지를 찾을 수 없어요.</div>';
  const items = (w.items || []).map(id => (S.items || []).find(i => i.id === id)).filter(Boolean);
  let n = 0; const answers = [];
  const blocks = items.map(it => {
    const qs = it.questions && it.questions.length ? it.questions : [{}], from = n + 1;
    const qhtml = qs.map(q => { n++; answers.push([n, q.answer || '', q.explain || '']); return `<div class="pq"><b class="pn">${n}.</b>${q.img ? `<img src="${esc(q.img)}" alt="">` : ''}${q.text ? `<div class="pt">${esc(q.text)}</div>` : ''}</div>`; }).join('');
    if (it.kind === 'set') return `<div class="pset"><div class="phead">[${from}~${n}] 다음 글을 읽고 물음에 답하시오.</div>${it.passage_img ? `<img src="${esc(it.passage_img)}" alt="">` : ''}${it.passage_text ? `<div class="pt pbox">${esc(it.passage_text)}</div>` : ''}</div>${qhtml}`;
    return qhtml;
  }).join('');
  const names = (w.student_ids || []).map(id => (stuById(id) || {}).name).filter(Boolean);
  return `<div class="top noprint"><div><button class="btn o s" data-act="nav" data-v="bank" data-tab="sheets">← 시험지 목록</button></div>
  <div class="row"><button class="btn r s" data-act="print">${icon('file', 16)}인쇄 · PDF 저장</button>${w.id ? `<button class="btn o s" data-act="editSheet" data-id="${w.id}">수정</button><button class="btn o s" data-act="delSheet" data-id="${w.id}">삭제</button>` : ''}</div></div>
  <p class="small noprint">인쇄 창에서 대상을 "PDF로 저장"으로 바꾸면 PDF 파일로 저장돼요.</p>
  <div class="paper"><div class="phdr"><div><div class="ptitle">${esc(w.title)}</div><div class="small">${esc(S.academy.name)} · ${fmtDate(w.date)} · ${n}문항</div></div><div class="pname">이름 <span>${esc(names.length === 1 ? names[0] : '')}</span></div></div>
  <div class="pbody ${w.cols === 1 ? 'c1' : ''}">${blocks}</div>
  ${w.with_answers ? `<div class="pans"><div class="ptitle" style="font-size:18px">정답</div><div class="pansg">${answers.map(([k, a]) => `<div><b>${k}</b> ${esc(a || '-')}</div>`).join('')}</div>
  ${answers.some(x => x[2]) ? `<div class="ptitle" style="font-size:16px;margin-top:18px">해설</div><div style="display:grid;gap:8px;margin-top:8px;font-size:13px">${answers.filter(x => x[2]).map(([k, a, e]) => `<div><b>${k}번 (${esc(a || '-')})</b> <span style="white-space:pre-wrap">${esc(e)}</span></div>`).join('')}</div>` : ''}</div>` : ''}</div>`;
}
/* 학생 맞춤 시험지: 취약 유형별로 문제를 골라 담는다 */
function makeClinicSheet(sid, subj) {
  const s = stuById(sid), wt = weakTypes(sid, subj).slice(0, 5), picked = [];
  for (const t of wt) { recItems(t.subject, t.type, sid).filter(i => !picked.includes(i.id)).slice(0, 3).forEach(i => picked.push(i.id)); if (picked.length >= 20) break; }
  if (!picked.length) {
    if (!wt.length) { toast('아직 틀린 유형 기록이 없어요'); return; }
    if (!can('bank_edit')) { toast('문제은행에 이 학생 취약 유형의 문제가 아직 없어요'); return; }
    aiForm({subject: wt[0].subject, type: wt[0].type, level: '중', sid, types: wt.map(t => t.type)}, '문제은행에 이 학생 약점 유형 문제가 아직 없어요. AI로 새로 만들까요?'); return;
  }
  S.ws = sheetDraft(null, {title: `${s.name} 맞춤 클리닉 시험지`, student_ids: [sid], items: picked}); go('sheet');
  toast(`취약 유형 ${wt.length}개에서 ${picked.length}세트를 골랐어요`);
}
function weakTypesBlock(sid, subj) {
  const wt = weakTypes(sid, subj).slice(0, 6);
  if (!wt.length) return '<h3>취약 유형</h3><p class="small">틀린 문항이 쌓이면 유형별로 분석해요. 시험 등록 때 문항별 유형을 넣어두면 더 정확해져요 (없으면 영역 기준).</p>';
  return `<h3>취약 유형 <span class="small">정답률 낮은 순</span></h3><div class="list">${wt.map(t => { const n = recItems(t.subject, t.type, sid).length;
    return `<div class="row"><span style="width:170px;font-weight:600">${esc(t.type)}</span><div class="bar" style="flex:1"><span style="width:${((1 - t.rate) * 100).toFixed(1)}%"></span></div><span class="small" style="width:120px;text-align:right">${t.w}/${t.n} 오답 · 정답률 ${Math.round(t.rate * 100)}%</span><button class="btn o s" data-act="seeType" data-sub="${t.subject}" data-t="${esc(t.type)}">유사 문제 ${n}</button></div>`; }).join('')}</div>
  <div class="row" style="margin-top:10px"><button class="btn r" data-act="clinicSheet" data-id="${sid}" data-sub="${esc(subj || '')}">${icon('file', 18)}취약 유형 맞춤 시험지 만들기</button></div>`;
}

/* ---------- 학생 모드 · 플래너 · 공부 타이머 ---------- */
const isStudent = () => S.member && S.member.role === 'student';
const myStudentId = () => isStudent() ? S.member.student_id : null;
const STUDY_SUBJ = [['kor', '국어'], ['math', '수학'], ['eng', '영어'], ['hist', '한국사'], ['inq', '탐구'], ['etc', '기타']];
const SUBJ_COLOR = {kor: '#e2384f', math: '#3a6df0', eng: '#18885a', hist: '#a26d00', inq: '#8a4fd8', etc: '#77707a'};
const fmtDur = sec => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
const fmtHM = sec => { const m = Math.round(sec / 60); return m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간${m % 60 ? ' ' + m % 60 + '분' : ''}`; };
const dayStr = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const logsOf = (sid, date) => (S.logs || []).filter(l => l.student_id === sid && (!date || l.date === date));
const todosOf = (sid, date) => (S.todos || []).filter(t => t.student_id === sid && (!date || t.date === date));
const daySec = (sid, date) => logsOf(sid, date).reduce((t, l) => t + (+l.seconds || 0), 0);
const genCode = () => Array.from({length: 6}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
/* 진행 중 타이머는 기기에 저장 (새로고침해도 이어짐) */
const timerState = () => { try { return JSON.parse(LS.get('hit100-timer') || 'null'); } catch (e) { return null; } };
function runningSec() { const t = timerState(); return t && t.sid === myStudentId() ? (Date.now() - t.start) / 1000 : 0; }
async function stopTimer(silent) {
  const t = timerState(); if (!t) return; LS.del('hit100-timer');
  const sec = Math.round((Date.now() - t.start) / 1000);
  if (sec >= 10) { await save('logs', {id: uid(), academy_id: S.academy.id, student_id: t.sid, date: dayStr(t.start), subject: t.subject, seconds: sec, started_at: new Date(t.start).toISOString(), ended_at: new Date().toISOString()}); if (!silent) toast(`${(STUDY_SUBJ.find(x => x[0] === t.subject) || [, ''])[1]} ${fmtHM(sec)} 기록했어요`); }
  else if (!silent) toast('10초 미만은 기록하지 않아요');
}
let tickH = null;
function startTick() { clearInterval(tickH); tickH = setInterval(() => { const t = timerState(); if (!t) return; const el = document.getElementById('tm-total'), el2 = document.getElementById('tm-cur'); const sid = myStudentId(); if (el) el.textContent = fmtDur(daySec(sid, today()) + runningSec()); if (el2) el2.textContent = fmtDur(runningSec()); }, 1000); }
function subjBars(sid, dates) {
  const by = {}; dates.forEach(d => logsOf(sid, d).forEach(l => by[l.subject] = (by[l.subject] || 0) + (+l.seconds || 0)));
  const tot = Object.values(by).reduce((a, b) => a + b, 0);
  if (!tot) return '<p class="small">아직 기록이 없어요.</p>';
  return `<div class="list">${STUDY_SUBJ.filter(([k]) => by[k]).map(([k, l]) => `<div class="row"><span style="width:56px;font-weight:600">${l}</span><div class="bar" style="flex:1"><span style="width:${(by[k] / tot * 100).toFixed(1)}%;background:${SUBJ_COLOR[k]}"></span></div><span class="small" style="width:90px;text-align:right">${fmtHM(by[k])}</span></div>`).join('')}</div>`;
}
function weekStrip(sid) {
  const days = Array.from({length: 7}, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return dayStr(d); });
  const mx = Math.max(3600, ...days.map(d => daySec(sid, d)));
  return `<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;align-items:end;height:150px">${days.map(d => { const v = daySec(sid, d); return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><span class="small" style="font-size:11px">${v ? fmtHM(v) : ''}</span><div style="width:70%;height:${Math.max(3, v / mx * 100)}%;background:${d === today() ? 'var(--grad)' : 'var(--line)'};border-radius:6px 6px 2px 2px"></div><span class="small">${'일월화수목금토'[new Date(d).getDay()]}</span></div>`; }).join('')}</div>`;
}
/* 학생 홈: 오늘 · 타이머 */
function vToday() {
  const sid = myStudentId(), s = stuById(sid); if (!s) return '<div class="empty">연결된 학생 정보를 찾을 수 없어요. 선생님께 학생 코드를 다시 받아주세요.</div>';
  const t = timerState(), run = t && t.sid === sid, todos = todosOf(sid, today()), up = S.attempts.filter(a => a.student_id === sid && a.status === 'planned').sort((a, b) => String(a.planned_date).localeCompare(String(b.planned_date))).slice(0, 3);
  const wt = weakTypes(sid).slice(0, 3);
  setTimeout(startTick, 0);
  return `<div class="hero"><div><h1>${esc(s.name)}, 오늘도 화이팅!</h1><p>오늘 공부한 시간</p><div id="tm-total" style="font-size:clamp(40px,7vw,60px);font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums">${fmtDur(daySec(sid, today()) + runningSec())}</div></div>
  <div style="text-align:right">${run ? `<div class="small" style="color:#fff;opacity:.9">${(STUDY_SUBJ.find(x => x[0] === t.subject) || [, ''])[1]} 공부 중</div><div id="tm-cur" style="font-size:28px;font-weight:700;font-variant-numeric:tabular-nums">${fmtDur(runningSec())}</div><button class="btn" data-act="tmStop" style="margin-top:8px">■ 멈추고 기록</button>` : '<div class="small" style="color:#fff;opacity:.9">아래에서 과목을 누르면 시작해요</div>'}</div></div>
  <div class="card"><h3>${icon('pen', 18)} 공부 타이머</h3><div class="chips">${STUDY_SUBJ.map(([k, l]) => `<button class="chip ${run && t.subject === k ? 'on' : ''}" data-act="tmStart" data-v="${k}" style="min-height:52px;padding:8px 18px;font-size:16px;${run && t.subject === k ? '' : `border-color:${SUBJ_COLOR[k]}55`}">${run && t.subject === k ? '● ' : '▶ '}${l}</button>`).join('')}</div>
  <p class="small" style="margin-bottom:0">다른 과목을 누르면 지금 과목은 기록되고 새 과목이 시작돼요. 앱을 닫아도 시간은 계속 흘러가요.</p></div>
  <div class="set" style="margin-top:14px">
  <div class="card"><h3>${icon('check', 18)} 오늘 할 일</h3>${todoList(sid, today())}</div>
  <div class="card"><h3>${icon('chart', 18)} 오늘 과목별</h3>${subjBars(sid, [today()])}<h3>최근 7일</h3>${weekStrip(sid)}</div>
  <div class="card"><h3>${icon('cal', 18)} 다가오는 시험</h3>${up.length ? up.map(a => `<div class="kv"><span>${esc(examTitle(examById(a.exam_id)))}</span><b>${fmtDate(a.planned_date)}</b></div>`).join('') : '<p class="small">예정된 시험이 없어요.</p>'}</div>
  <div class="card"><h3>${icon('alert', 18)} 내 약점 유형</h3>${wt.length ? wt.map(x => `<div class="kv"><span>${esc(SUBJECTS[x.subject])} · ${esc(x.type)}</span><b>정답률 ${Math.round(x.rate * 100)}%</b></div>`).join('') + '<div class="row" style="margin-top:10px"><button class="btn o s" data-act="nav" data-v="analysis">자세히 보기</button></div>' : '<p class="small">시험 결과가 쌓이면 약한 유형을 알려줘요.</p>'}</div></div>`;
}
function todoList(sid, date) {
  const list = todosOf(sid, date);
  return `${list.length ? `<div class="list">${list.map(t => `<div class="row" style="gap:10px"><input type="checkbox" data-in="todoDone" data-id="${t.id}" ${t.done ? 'checked' : ''} style="width:22px;height:22px;min-height:0"><span style="flex:1;${t.done ? 'text-decoration:line-through;color:var(--mut)' : ''}"><span class="tag" style="color:${SUBJ_COLOR[t.subject] || 'var(--mut)'}">${esc((STUDY_SUBJ.find(x => x[0] === t.subject) || [, '기타'])[1])}</span> ${esc(t.text)}${t.by_teacher ? ' <span class="tag r">선생님</span>' : ''}</span><button class="btn o s" data-act="todoDel" data-id="${t.id}">✕</button></div>`).join('')}</div>` : '<p class="small">할 일이 없어요.</p>'}
  <div class="row" style="margin-top:10px"><select id="td-sub" style="width:auto">${STUDY_SUBJ.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><input id="td-text" placeholder="할 일 (예: 수학 수열 20문제)" style="flex:1;min-width:160px"><button class="btn r s" data-act="todoAdd" data-sid="${sid}" data-date="${date}">추가</button></div>`;
}
/* 달력 플래너 (학생 본인 · 선생님 공용) */
function calendar(sid) {
  const ym = S.f.cal || today().slice(0, 7), [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1), start = first.getDay(), days = new Date(y, m, 0).getDate();
  const sel = S.f.calDay || today(), exams = S.attempts.filter(a => a.student_id === sid);
  const mxs = Math.max(3600, ...Array.from({length: days}, (_, i) => daySec(sid, `${ym}-${String(i + 1).padStart(2, '0')}`)));
  const cells = []; for (let i = 0; i < start; i++) cells.push('<div></div>');
  for (let d = 1; d <= days; d++) {
    const ds = `${ym}-${String(d).padStart(2, '0')}`, sec = daySec(sid, ds), td = todosOf(sid, ds), ex = exams.filter(a => (a.status === 'planned' ? a.planned_date : a.taken_date) === ds), lv = sec ? Math.min(1, .15 + sec / mxs * .85) : 0;
    cells.push(`<button class="calc ${ds === sel ? 'sel' : ''} ${ds === today() ? 'tod' : ''}" data-act="calDay" data-v="${ds}" style="${lv ? `background:color-mix(in srgb,var(--red) ${Math.round(lv * 60)}%,var(--card))` : ''}"><b>${d}</b>${sec ? `<span class="cs">${fmtHM(sec)}</span>` : ''}${td.length ? `<span class="cs">✓${td.filter(t => t.done).length}/${td.length}</span>` : ''}${ex.length ? `<span class="cx">${ex.some(a => a.status === 'planned') ? '시험' : '응시'}</span>` : ''}</button>`);
  }
  const monSec = logsOf(sid).filter(l => String(l.date).startsWith(ym)).reduce((t, l) => t + (+l.seconds || 0), 0);
  const studyDays = new Set(logsOf(sid).filter(l => String(l.date).startsWith(ym)).map(l => l.date)).size;
  const dayLogs = logsOf(sid, sel), dayEx = exams.filter(a => (a.status === 'planned' ? a.planned_date : a.taken_date) === sel);
  return `<div class="work"><div class="card"><div class="row" style="justify-content:space-between;margin-bottom:10px"><button class="btn o s" data-act="calMove" data-v="-1" aria-label="이전 달">${icon('left', 18)}</button><b style="font-size:18px">${y}년 ${m}월</b><button class="btn o s" data-act="calMove" data-v="1" aria-label="다음 달">${icon('right', 18)}</button></div>
  <div class="calg">${'일월화수목금토'.split('').map(w => `<div class="calw">${w}</div>`).join('')}${cells.join('')}</div>
  <div class="row" style="margin-top:12px;gap:16px"><span class="small">이번 달 <b style="color:var(--ink)">${fmtHM(monSec)}</b></span><span class="small">공부한 날 <b style="color:var(--ink)">${studyDays}일</b></span><span class="small">하루 평균 <b style="color:var(--ink)">${studyDays ? fmtHM(monSec / studyDays) : '-'}</b></span></div></div>
  <div class="res"><b style="font-size:17px">${fmtDate(sel)} (${'일월화수목금토'[new Date(sel).getDay()]})</b>
  <div class="kv"><span>공부 시간</span><b>${fmtHM(daySec(sid, sel))}</b></div>
  ${dayEx.map(a => `<div class="kv"><span>${a.status === 'planned' ? '예정 시험' : '응시'}</span><b>${esc(examTitle(examById(a.exam_id)))}</b></div>`).join('')}
  <h3>할 일</h3>${todoList(sid, sel)}
  <h3>공부 기록</h3>${dayLogs.length ? dayLogs.map(l => `<div class="kv"><span><span style="color:${SUBJ_COLOR[l.subject]}">●</span> ${esc((STUDY_SUBJ.find(x => x[0] === l.subject) || [, '기타'])[1])}${l.started_at ? ` <span class="small">${new Date(l.started_at).toTimeString().slice(0, 5)}~${new Date(l.ended_at || l.started_at).toTimeString().slice(0, 5)}</span>` : ' <span class="small">직접 입력</span>'}</span><b>${fmtHM(l.seconds)} <button class="btn o s" data-act="logDel" data-id="${l.id}" style="min-height:28px;padding:0 8px">✕</button></b></div>`).join('') : '<p class="small">기록이 없어요.</p>'}
  <div class="row" style="margin-top:10px"><select id="lg-sub" style="width:auto">${STUDY_SUBJ.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><input id="lg-min" type="number" min="1" placeholder="분" style="width:90px"><button class="btn o s" data-act="logAdd" data-sid="${sid}" data-date="${sel}">시간 직접 추가</button></div></div></div>`;
}
function vPlanner() { const sid = myStudentId(); return `<div class="top"><div><h1>플래너</h1><div class="small">날짜를 누르면 그날 할 일과 공부 기록을 볼 수 있어요. 색이 진할수록 공부를 많이 한 날이에요.</div></div></div>${calendar(sid)}`; }
function vAnalysis() { S.p = myStudentId(); return vStudent(); }

/* ---------- 설정 ---------- */
function preloadFonts() { Object.entries(FONTS).forEach(([k, f]) => { if (f[1] && !document.getElementById('fp-' + k)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = f[1]; l.id = 'fp-' + k; document.head.appendChild(l); } }); }
function vSettings() {
  preloadFonts();
  const th = LS.get('mc2-theme') || 'auto', fs = LS.get('mc2-fs') || 'm', owner = isOwner(), canAcad = can('academy_settings'), canMem = can('manage_members');
  const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<div class="top"><div><h1>설정</h1><div class="small">계정, 학원, 화면, 데이터를 관리해요.</div></div></div>
  <div class="set">
  <div class="card" id="profile"><h3>${icon('user', 18)} 내 프로필</h3>
  <div class="row" style="gap:14px;margin:6px 0 12px"><div class="av lg">${initial(S.member.name)}</div><div><b>${esc(S.member.name)} ${roleName(S.member)}</b>${owner ? ' <span class="tag r">관리자</span>' : ''}<br><span class="small">${esc(S.user.email)}</span></div></div>
  <div class="fields"><label>이름<input id="st-name" value="${esc(S.member.name)}"></label><label>직책<select id="st-title" ${owner ? '' : 'disabled'}>${[...new Set([...TITLES_JOB, roleName(S.member)])].map(t => `<option ${roleName(S.member) === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
  ${owner ? '' : '<p class="small">직책은 관리자가 바꿀 수 있어요.</p>'}
  <div class="row" style="margin-top:10px"><button class="btn r s" data-act="saveProfile">이름 저장</button></div></div>

  <div class="card"><h3>${icon('key', 18)} 비밀번호 변경</h3>
  <label>현재 비밀번호<span class="pwbox"><input id="st-old" type="password" autocomplete="current-password"><button type="button" class="pweye" data-act="pwEye">보기</button></span></label>
  <label style="margin-top:8px">새 비밀번호 (6자 이상)<span class="pwbox"><input id="st-new" type="password" autocomplete="new-password"><button type="button" class="pweye" data-act="pwEye">보기</button></span></label>
  <label style="margin-top:8px">새 비밀번호 확인<span class="pwbox"><input id="st-new2" type="password" autocomplete="new-password"><button type="button" class="pweye" data-act="pwEye">보기</button></span></label>
  <div class="row" style="margin-top:10px"><button class="btn r s" data-act="changePw">변경</button></div></div>

  <div class="card staff-only"><h3>${icon('home', 18)} 학원</h3>
  <label>학원 이름 <span class="small">(보고서 하단에 표시돼요)</span><input id="st-acad" value="${esc(S.academy.name)}" ${canAcad ? '' : 'disabled'}></label>
  ${canAcad ? '<div class="row" style="margin-top:10px"><button class="btn r s" data-act="saveAcademy">학원 이름 저장</button></div>' : '<p class="small">학원 이름을 바꿀 권한이 없어요.</p>'}
  ${canMem ? '' : '<!--'}<div class="srow" style="margin-top:12px;border-top:1px solid var(--hair)"><div class="lab"><b>초대 코드 ${esc(S.academy.invite_code)}</b><span>선생님이 회원가입 후 이 코드로 들어와요</span></div><button class="btn o s" data-act="copyCode">복사</button></div>${canMem ? '' : '-->'}
  <h3>선생님 ${S.members.length}명</h3><p class="small" style="margin-top:0">관리자는 모든 권한을 가지고 직책별 권한표를 정해요. 나머지는 직책에 따라 할 수 있는 일이 달라요.</p><div class="list">${S.members.map(m => { const me = m.user_id === S.user.id;
    return `<div class="wq"><div class="row" style="gap:10px"><span class="av">${initial(m.name)}</span><span style="flex:1"><b>${esc(m.name)}${me ? ' (나)' : ''}</b><br><span class="small">${esc(m.email || '')}</span></span><span class="tag">${esc(roleName(m))}</span>${m.role === 'owner' ? '<span class="tag r">관리자</span>' : ''}</div>
    ${canMem && (owner || (m.role !== 'owner' && roleName(m) !== '원장' && !me)) ? `<div class="row"><select data-in="mTitle" data-u="${esc(m.user_id)}" style="width:auto;min-height:36px;padding:4px 10px">${[...new Set([...TITLES_JOB.filter(t => owner || t !== '원장'), roleName(m)])].map(t => `<option ${roleName(m) === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
    ${owner ? `<button class="btn o s" data-act="mRole" data-u="${esc(m.user_id)}" data-v="${m.role === 'owner' ? 'teacher' : 'owner'}">${m.role === 'owner' ? '관리자 해제' : '관리자로 지정'}</button>` : ''}${me ? '' : `<button class="btn o s" data-act="mKick" data-u="${esc(m.user_id)}">내보내기</button>`}</div>` : ''}</div>`; }).join('')}</div>
  <div class="row" style="margin-top:12px"><button class="btn o s" data-act="addAcad">${icon('plus', 16)} 다른 학원 추가</button><button class="btn o s" data-act="leaveAcad">이 학원에서 나가기</button></div></div>

  <div class="card staff-only" style="grid-column:1/-1"><h3>${icon('key', 18)} 직책별 권한</h3><p class="small" style="margin-top:0">${owner ? '체크를 바꾸면 바로 저장돼요. 관리자는 직책과 상관없이 모든 권한을 가져요.' : '내 직책(' + esc(roleName(S.member)) + ')의 권한이에요. 바꾸려면 관리자에게 요청하세요.'}</p>
  <div class="scroll tbl"><table><thead><tr><th>권한</th>${TITLES_JOB.map(t => `<th style="text-align:center">${t}</th>`).join('')}</tr></thead><tbody>
  ${PERMS.map(([k, l, d]) => `<tr><td><b>${l}</b>${d ? `<br><span class="small">${d}</span>` : ''}</td>${TITLES_JOB.map(t => { const on = permsFor(t)[k]; return `<td style="text-align:center">${owner ? `<input type="checkbox" data-in="perm" data-t="${t}" data-k="${k}" ${on ? 'checked' : ''} style="width:20px;height:20px;min-height:0">` : (on ? '✓' : '<span class="small">–</span>')}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
  ${owner ? '<div class="row" style="margin-top:10px"><button class="btn o s" data-act="permReset">기본값으로 되돌리기</button></div>' : ''}</div>

  <div class="card"><h3>${icon('sun', 18)} 화면</h3>
  <div class="srow"><div class="lab"><b>테마</b><span>자동은 기기 설정을 따라가요</span></div>${seg('setTheme', th, [['auto', '자동'], ['light', '밝게'], ['dark', '어둡게']])}</div>
  <div class="srow" style="flex-wrap:wrap"><div class="lab"><b>글꼴</b><span>버튼마다 그 글꼴로 보여요</span></div><div class="seg">${Object.entries(FONTS).map(([k, f]) => `<button class="${(LS.get('mc2-font') || 'heir') === k ? 'on' : ''}" data-act="setFont" data-v="${k}" style="font-family:${esc(f[2])}">${esc(f[0])}</button>`).join('')}</div></div>
  <div class="srow"><div class="lab"><b>글자 크기</b><span>모든 화면에 적용돼요</span></div>${seg('setFs', fs, [['s', '작게'], ['m', '보통'], ['l', '크게']])}</div>
  <div class="srow"><div class="lab"><b>로그인 유지</b><span>${auto() ? '자동 로그인 켜짐' : '창을 닫으면 로그아웃'}</span></div>${seg('setAuto', auto() ? '1' : '0', [['0', '끄기'], ['1', '켜기']])}</div></div>

  ${DEMO && can('backup') ? `<div class="card"><h3>${icon('file', 18)} 데이터 백업</h3><p class="small" style="margin-top:0">데모 모드에선 데이터가 이 기기에만 있어요. 다른 기기로 옮기려면 복사해서 붙여넣으세요.</p>
  <textarea id="bk" placeholder="백업 텍스트를 붙여넣고 불러오기"></textarea>
  <div class="row" style="margin-top:8px"><button class="btn s" data-act="bkCopy">전체 백업 복사</button><button class="btn o s" data-act="bkLoad">붙여넣은 백업 불러오기</button></div></div>` : ''}

  <div class="card"><h3>${icon('file', 18)} 앱을 파일로 저장</h3><p class="small" style="margin-top:0">다운로드가 안 될 때 쓰는 방법이에요. 앱 전체를 복사해서 메모장에 저장하면 그 파일 하나로 어느 컴퓨터에서든 열려요.</p>
  <button class="btn r s" data-act="saveApp">${icon('file', 16)} 앱 파일 복사하기</button></div>

  <div class="card"><h3>${icon('info', 18)} 정보</h3>
  <div class="srow"><div class="lab"><b>${esc(CFG.APP_NAME || 'hit100')}</b><span>버전 5.3 · ${DEMO ? '데모 모드 (이 기기 저장)' : '서버 연결됨'}</span></div></div>
  <div class="srow"><div class="lab"><b>로그아웃</b><span>${esc(S.user.email)}</span></div><button class="btn o s" data-act="logout">${icon('logout', 16)} 로그아웃</button></div></div>
  </div>`;
}
/* ---------- 모달 ---------- */
function modal(html) { closeModal(); const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal'; m.innerHTML = `<div class="box">${html}</div>`; m.addEventListener('click', ev => { if (ev.target === m) closeModal(); }); document.body.appendChild(m); const f = m.querySelector('input,select'); if (f) f.focus(); }
function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }
function confirmBox(msg, ok) {
  modal(`<p style="margin:0">${esc(msg)}</p><div class="row"><button class="btn r" id="cf-ok">삭제</button><button class="btn o" data-act="closeModal">취소</button></div>`);
  document.getElementById('cf-ok').onclick = async () => { closeModal(); await ok(); };
}

/* ---------- 이벤트 ---------- */
const ACT = {
  nav: el => { S.q = ''; S.f = {}; go(el.dataset.v, null, el.dataset.tab || null); if (el.dataset.sec) { const t = document.getElementById(el.dataset.sec); if (t) { t.scrollIntoView({block: 'start'}); const i = t.querySelector('input'); if (i) i.focus(); } } },
  menu: () => { S.menu = !S.menu; render(); },
  toggleTheme: () => { const t = curDark() ? 'light' : 'dark'; LS.set('mc2-theme', t); applyTheme(t); render(); },
  setTheme: el => { const v = el.dataset.v; if (v === 'auto') LS.del('mc2-theme'); else LS.set('mc2-theme', v); applyTheme(v); render(); },
  setFont: el => { const v = el.dataset.v; if (v === 'heir') LS.del('mc2-font'); else LS.set('mc2-font', v); applyFont(v); render(); toast(FONTS[v][0] + ' 글꼴로 바꿨어요'); },
  setFs: el => { const v = el.dataset.v; if (v === 'm') LS.del('mc2-fs'); else LS.set('mc2-fs', v); applyFs(v); render(); },
  setAuto: el => { const on = el.dataset.v === '1', sid = PREF.get('mc2-sess'); if (on) LS.set('mc2-auto', '1'); else LS.del('mc2-auto');
    if (DEMO && sid) PREF.set('mc2-sess', sid);
    if (!DEMO) { for (const k of Object.keys(window.localStorage || {}).concat(Object.keys(window.sessionStorage || {}))) if (/^sb-.*-auth-token$/.test(k)) { const v = PREF.get(k); if (v) PREF.set(k, v); } }
    toast(on ? '자동 로그인을 켰어요' : '창을 닫으면 로그아웃돼요'); render(); },
  saveProfile: async () => { const n = document.getElementById('st-name').value.trim(); if (!n) { toast('이름을 입력하세요'); return; }
    try { const m = await API.updateMember({...S.member, name: n}); S.member = {...S.member, ...(m || {}), name: n};
      const tsel = document.getElementById('st-title'); if (isOwner() && tsel && tsel.value !== roleName(S.member)) { await API.setMember(S.academy.id, S.user.id, {title: tsel.value}); S.member.title = tsel.value; }
      replaceMember(S.member); syncMyAcads(); toast('저장했어요'); render(); } catch (e) { toast('저장 실패: ' + e); } },
  saveAcademy: async () => { const n = document.getElementById('st-acad').value.trim(); if (!n) { toast('학원 이름을 입력하세요'); return; }
    try { const a = await API.updateAcademy({...S.academy, name: n}); S.academy = {...S.academy, ...a, name: n}; syncMyAcads(); toast('저장했어요'); render(); } catch (e) { toast('저장 실패: ' + e); } },
  changePw: async () => { const o = document.getElementById('st-old').value, n = document.getElementById('st-new').value, n2 = document.getElementById('st-new2').value;
    if (n.length < 6) { toast('새 비밀번호는 6자 이상이에요'); return; } if (n !== n2) { toast('새 비밀번호가 서로 달라요'); return; }
    try { await API.changePassword(S.user, o, n); toast('비밀번호를 바꿨어요'); render(); } catch (e) { toast(String(e)); } },
  tab: el => { S.tab = el.dataset.v; render(); },
  closeModal: () => closeModal(),
  newStudent: () => studentForm(null),
  editStudent: el => studentForm(stuById(el.dataset.id)),
  delStudent: el => confirmBox('이 학생과 모든 기록을 삭제할까요? 되돌릴 수 없어요.', async () => { await del('students', el.dataset.id); toast('삭제했어요'); go('students'); }),
  openStudent: el => { S.f = {}; if (isStudent()) go('analysis'); else go('student', el.dataset.id); },
  assign: el => assignForm(el.dataset.id),
  gradeStudent: el => go('grade', {student_id: el.dataset.id}),
  gradeExam: el => go('grade', {exam_id: el.dataset.id}),
  gradePlanned: el => { const a = S.attempts.find(x => x.id === el.dataset.id); go('grade', {g: newDraft(a)}); },
  editAttempt: el => { const a = S.attempts.find(x => x.id === el.dataset.id); go('grade', {g: newDraft(a)}); },
  delAttempt: el => confirmBox('이 기록을 삭제할까요?', async () => { const a = S.attempts.find(x => x.id === el.dataset.id); await del('attempts', el.dataset.id); toast('삭제했어요'); if (S.view === 'report') go('student', a.student_id); else render(); }),
  openReport: el => go('report', el.dataset.id),
  copyReport: el => { const a = S.attempts.find(x => x.id === el.dataset.id), r = evalAttempt(a); copyText('[클리닉 보고 (모의고사 편)]\n' + reportFields(a, r).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n' + S.academy.name); },
  print: () => { try { window.print(); } catch (e) { toast('인쇄를 열 수 없어요'); } },
  noteCause: async el => { const a = S.attempts.find(x => x.id === el.dataset.a), q = el.dataset.q, c = el.dataset.c, n = a.notes || (a.notes = {}), o = n[q] || (n[q] = {});
    o.causes = (o.causes || []).includes(c) ? o.causes.filter(x => x !== c) : [...(o.causes || []), c]; await save('attempts', a); render(); },
  openExam: el => { S.f = {}; go('exam', el.dataset.id); },
  etr: el => { S.f.etr = el.dataset.v; render(); },
  esub: el => { S.f.esub = el.dataset.v; render(); },
  tsub: el => { S.f.tsub = el.dataset.v; render(); },
  newExam: () => { S.ed = examDraft(null); go('examEdit'); edInfo(); },
  editExam: el => { S.ed = examDraft(examById(el.dataset.id)); go('examEdit'); edInfo(); },
  delExam: el => { const n = S.attempts.filter(a => a.exam_id === el.dataset.id).length; confirmBox(`이 시험을 삭제할까요? 이 시험의 채점 기록 ${n}개도 함께 삭제돼요.`, async () => { await del('exams', el.dataset.id); toast('삭제했어요'); go('exams'); }); },
  cancelExam: () => go(S.ed && S.ed.id ? 'exam' : 'exams', S.ed && S.ed.id),
  edTpl: el => { const d = S.ed, keep = {id: d.id, academy_id: d.academy_id, year: d.year, grade: d.grade, month: d.month, kind: d.kind, title: d.title, source: d.source, ext_rates: {}, key: {}};
    S.ed = normalizeExam({...keep, ...template(el.dataset.v)}); render(); edInfo(); },
  edGrading: el => { const d = S.ed; d.grading = el.dataset.v; if (d.grading === 'absolute' && !(d.cuts.all || []).some(x => x > 0)) d.cuts.all = (d.subject === 'hist' ? ABS_HIST : ABS_ENG).slice(); render(); edInfo(); },
  edApply: () => { applyLayout(S.ed); render(); edInfo(); toast('구조를 적용했어요'); },
  saveExam: async () => {
    const d = S.ed; applyLayout(d); d.title = (d.title || '').trim() || autoTitle(d); d.year = +d.year; d.grade = +d.grade; d.month = +d.month; d.choices = +d.choices; d.defPts = +d.defPts; d.max = +d.max;
    if (!d.id) d.id = uid();
    const r = await save('exams', d); toast('저장했어요'); go('exam', r.id);
  },
  gMode: el => { S.g.mode = el.dataset.v; if (el.dataset.v === 'wrong') { const c = gCtx(); if (c) S.g.wrong = c.wrong.slice(); } render(); },
  gAns: el => { const v = +el.dataset.v; if (!v) { S.g.answers[S.g.cur - 1] = null; gradeDyn(); } else setAns(v); },
  gShortOk: () => { const i = document.getElementById('g-short'); const v = i ? i.value.trim() : ''; if (v !== '' && !/^-?\d+$/.test(v)) { toast('정수만 입력하세요'); return; } setAns(v === '' ? null : +v); },
  gMove: el => { const g = S.g, c = gCtx(); g.cur = Math.min(c ? QN(c.e) : 45, Math.max(1, g.cur + +el.dataset.v)); gradeDyn(); },
  gCur: el => { S.g.cur = +el.dataset.q; gradeDyn(); },
  gWrong: el => { const q = +el.dataset.q, g = S.g; g.wrong = g.wrong.includes(q) ? g.wrong.filter(x => x !== q) : [...g.wrong, q].sort((a, b) => a - b); gradeDyn(); },
  gClear: () => { S.g.wrong = []; gradeDyn(); },
  gPick: el => { const c = gCtx(), q = +el.dataset.q, g = S.g; let p = c.picks.slice(); if (p.includes(q)) p = p.filter(x => x !== q); else if (p.length < 3) p.push(q); else { toast('3개까지만 고를 수 있어요'); return; } g.picks = p; g.picksTouched = true; gradeDyn(); },
  gCause: el => { const q = el.dataset.q, c = el.dataset.c, n = S.g.notes[q] || (S.g.notes[q] = {}); n.causes = (n.causes || []).includes(c) ? n.causes.filter(x => x !== c) : [...(n.causes || []), c]; gradeDyn(); },
  gAttChip: el => { const v = el.dataset.v, g = S.g; let parts = String(g.attitude).split(',').map(x => x.trim()).filter(Boolean); parts = parts.includes(v) ? parts.filter(x => x !== v) : [...parts, v]; g.attitude = parts.join(', '); const ta = document.querySelector('[data-in="gAtt"]'); if (ta) ta.value = g.attitude; gradeDyn(); },
  gSave: () => gSave(),
  gReset: () => { S.g = newDraft({}); render(); },
  pwEye: el => { const i = el.parentElement.querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? '숨기기' : '보기'; i.focus(); },
  copyCode: () => copyText(S.academy.invite_code),
  copyLink: el => copyText(el.dataset.v),
  genLink: async el => { const st = stuById(el.dataset.id); if (!st) return; let c; do { c = genCode(); } while (S.students.some(x => x.link_code === c)); await save('students', {...st, link_code: c}); toast('학생 코드를 만들었어요: ' + c); render(); },
  tmStart: async el => { const t = timerState(); if (t && t.subject === el.dataset.v) { await stopTimer(); render(); return; } if (t) await stopTimer(); LS.set('hit100-timer', JSON.stringify({sid: myStudentId(), subject: el.dataset.v, start: Date.now()})); render(); },
  tmStop: async () => { await stopTimer(); render(); },
  todoAdd: async el => { const txt = (document.getElementById('td-text') || {}).value || ''; if (!txt.trim()) { toast('할 일을 입력하세요'); return; }
    await save('todos', {id: uid(), academy_id: S.academy.id, student_id: el.dataset.sid, date: el.dataset.date, subject: document.getElementById('td-sub').value, text: txt.trim(), done: false, by_teacher: !isStudent(), created_at: new Date().toISOString()}); render(); },
  todoDel: async el => { await del('todos', el.dataset.id); render(); },
  logAdd: async el => { const m = +(document.getElementById('lg-min') || {}).value; if (!(m > 0)) { toast('분을 입력하세요'); return; }
    await save('logs', {id: uid(), academy_id: S.academy.id, student_id: el.dataset.sid, date: el.dataset.date, subject: document.getElementById('lg-sub').value, seconds: Math.round(m * 60), started_at: null, ended_at: null}); toast('기록했어요'); render(); },
  logDel: el => confirmBox('이 공부 기록을 지울까요?', async () => { await del('logs', el.dataset.id); render(); }),
  calDay: el => { S.f.calDay = el.dataset.v; render(); },
  calMove: el => { const [y, m] = (S.f.cal || today().slice(0, 7)).split('-').map(Number), d = new Date(y, m - 1 + +el.dataset.v, 1); S.f.cal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; render(); },
  permReset: () => confirmBox('직책별 권한을 기본값으로 되돌릴까요?', async () => { const st = {...(S.academy.settings || {}), perms: {}}; const a = await API.updateAcademy({...S.academy, settings: st}); S.academy = {...S.academy, ...a, settings: st}; syncMyAcads(); toast('기본값으로 되돌렸어요'); render(); }),
  bsub: el => { S.f.bsub = el.dataset.v; S.f.btype = ''; render(); },
  newItem: () => { S.it = itemDraft(null); S.dropKey = null; go('itemEdit'); },
  editItem: el => { S.it = itemDraft((S.items || []).find(i => i.id === el.dataset.id)); S.dropKey = null; go('itemEdit'); },
  delItem: el => confirmBox('이 문제를 문제은행에서 삭제할까요?', async () => { await del('items', el.dataset.id); S.cart = S.cart.filter(x => x !== el.dataset.id); saveCart(); toast('삭제했어요'); render(); }),
  cartToggle: el => { const id = el.dataset.id; S.cart = S.cart.includes(id) ? S.cart.filter(x => x !== id) : [...S.cart, id]; saveCart(); render(); },
  openCart: () => { S.ws = sheetDraft(null); go('sheet'); },
  bulkAdd: () => bulkForm(),
  aiGen: () => aiForm(S.aiLast || {}),
  aiSave: async () => { const ids = await aiSaveSel(); toast(`${ids.length}개를 문제은행에 저장했어요`); if (!(S.aiRes || []).length) go('bank'); else render(); },
  aiSaveCart: async () => { const ids = await aiSaveSel(); const sid = S.aiFor; toast(`${ids.length}개 저장`);
    S.ws = sheetDraft(null, sid ? {title: `${(stuById(sid) || {}).name || ''} 맞춤 클리닉 시험지`, student_ids: [sid], items: ids} : {items: ids}); go('sheet'); },
  itKind: el => { S.it.kind = el.dataset.v; if (S.it.kind === 'single') S.it.questions = S.it.questions.slice(0, 1); render(); },
  itQAdd: () => { S.it.questions.push({img: '', text: '', answer: ''}); render(); },
  itQDel: el => { S.it.questions.splice(+el.dataset.i, 1); render(); },
  dropSel: el => { S.dropKey = el.dataset.k; document.querySelectorAll('.drop').forEach(d => d.classList.toggle('on', d.dataset.k === S.dropKey)); el.focus(); },
  dropClear: el => setDropImg(el.dataset.k, ''),
  saveItem: async el => { const it = S.it; if (!it.passage_img && !it.passage_text.trim() && !it.questions.some(q => q.img || (q.text || '').trim())) { toast('이미지나 텍스트를 하나 이상 넣어주세요'); return; }
    if (!it.id) { it.id = uid(); it.created_at = new Date().toISOString(); } await save('items', it); toast('저장했어요');
    if (el.dataset.next) { const keep = {subject: it.subject, subname: it.subname, type: it.type, level: it.level, source: it.source, kind: it.kind}; S.it = {...itemDraft(null), ...keep}; S.dropKey = it.kind === 'set' ? 'p' : 'q0'; render(); window.scrollTo(0, 0); } else go('bank'); },
  saveItemNext: el => { el.dataset.next = '1'; ACT.saveItem(el); },
  cancelItem: () => go('bank'),
  wsMove: el => { const a = S.ws.items, i = +el.dataset.i, j = i + +el.dataset.v; [a[i], a[j]] = [a[j], a[i]]; render(); },
  wsDel: el => { S.ws.items = S.ws.items.filter(x => x !== el.dataset.id); render(); },
  wsAdd: el => { S.ws.items.push(el.dataset.id); render(); },
  wsStuDel: el => { S.ws.student_ids = S.ws.student_ids.filter(x => x !== el.dataset.id); render(); },
  sheetSave: async () => { const w = {...S.ws}; delete w._saved; if (!w.id) { w.id = uid(); w.created_at = new Date().toISOString(); } w.cols = +w.cols === 1 ? 1 : 2; const r = await save('worksheets', w); S.ws = JSON.parse(JSON.stringify(r)); if (S.cart.length && w.items.every(i => S.cart.includes(i))) { S.cart = []; saveCart(); } toast('저장했어요'); return r; },
  sheetPreview: async () => { const r = await ACT.sheetSave(); go('sheetView', r.id); },
  openSheet: el => { S.ws = null; go('sheetView', el.dataset.id); },
  editSheet: el => { S.ws = sheetDraft((S.worksheets || []).find(w => w.id === el.dataset.id)); go('sheet'); },
  delSheet: el => confirmBox('이 시험지를 삭제할까요? 문제은행의 문제는 그대로 남아요.', async () => { await del('worksheets', el.dataset.id); toast('삭제했어요'); go('bank', null, 'sheets'); }),
  backToSheet: () => go('sheet'),
  seeType: el => { S.q = ''; S.f = {bsub: el.dataset.sub, btype: el.dataset.t}; go('bank'); },
  clinicSheet: el => makeClinicSheet(el.dataset.id, el.dataset.sub || ''),
  edTypesArea: () => { const d = S.ed; edSecs(d).forEach(sec => { const arr = d.types[sec.id] || (d.types[sec.id] = []); for (let i = 0; i <= sec.to - sec.from; i++) if (!arr[i]) { const q = sec.from + i, a = [...parseAreas(d.areas.common), ...(sec.id === 'common' ? [] : parseAreas(d.areas[sec.id]))].find(x => q >= x.a && q <= x.b); if (a) arr[i] = a.n; } }); render(); edInfo(); },
  switchAcad: async el => { LS.set('mc2-acad', el.dataset.id); S.menu = false; S.g = null; S.q = ''; S.f = {}; await afterLogin(); toast((S.academy || {}).name + '(으)로 전환했어요'); },
  addAcad: () => { S.menu = false; renderOnboard(true); },
  mRole: async el => { try { const r = await API.setMember(S.academy.id, el.dataset.u, {role: el.dataset.v}); const m = S.members.find(x => x.user_id === el.dataset.u); if (m) m.role = el.dataset.v; if (el.dataset.u === S.user.id) { S.member.role = el.dataset.v; syncMyAcads(); } toast(el.dataset.v === 'owner' ? '관리자로 지정했어요' : '관리자를 해제했어요'); render(); } catch (e) { toast(String(e)); } },
  mKick: el => { const m = S.members.find(x => x.user_id === el.dataset.u); confirmBox(`${m ? m.name : ''} 선생님을 학원에서 내보낼까요? 채점 기록은 학원에 남아요.`, async () => { try { await API.removeMember(S.academy.id, el.dataset.u); S.members = S.members.filter(x => x.user_id !== el.dataset.u); toast('내보냈어요'); render(); } catch (e) { toast(String(e)); } }); },
  leaveAcad: () => confirmBox(`${S.academy.name}에서 나갈까요? ${S.members.length <= 1 ? '혼자 있는 학원이라 나가면 이 학원의 데이터에 다시 들어올 수 없어요.' : '다시 들어오려면 초대 코드가 필요해요.'}`, async () => { try { await API.removeMember(S.academy.id, S.user.id); LS.del('mc2-acad'); S.member = null; S.academy = null; await afterLogin(); toast('학원에서 나왔어요'); } catch (e) { toast(String(e)); } }),
  saveApp: async () => { await copyText(SRC); modal(`<h2 style="margin:0">앱 파일 저장하기</h2><p class="small" style="margin:0">앱 전체(약 ${Math.round(SRC.length / 1024)}KB)를 복사했어요. 이제:</p>
  <ol style="margin:0;padding-left:20px;display:grid;gap:6px"><li><b>메모장</b> 열기 (시작 → "메모장" 검색)</li><li><b>Ctrl+V</b>로 붙여넣기</li><li><b>Ctrl+Shift+S</b> (다른 이름으로 저장)</li>
  <li>파일 이름: <b>모의고사클리닉.html</b><br>파일 형식: <b>모든 파일</b> · 인코딩: <b>UTF-8</b></li><li>저장한 파일을 더블클릭하면 앱이 열려요. USB·메일·카톡으로 다른 컴퓨터에 옮겨도 돼요.</li></ol>
  <p class="small" style="margin:0">맥은 텍스트편집기에서 <b>포맷 → 일반 텍스트로 만들기</b>를 먼저 누른 뒤 붙여넣고 .html로 저장하세요.</p>
  <div class="row"><button class="btn o" data-act="saveApp">다시 복사</button><button class="btn r" data-act="closeModal">확인</button></div>`); },
  logout: async () => { await API.signOut(); S.user = null; S.member = null; S.academy = null; S.g = null; S.menu = false; renderAuth('in'); },
  bkCopy: () => copyText(JSON.stringify(LB.db())),
  bkLoad: () => { try { const d = JSON.parse(document.getElementById('bk').value); if (!Array.isArray(d.users) || !Array.isArray(d.attempts)) throw 0; memDb = d; LB.save(); location.reload(); } catch (e) { toast('백업 형식이 맞지 않아요'); } }
};
function replaceMember(m) { const i = S.members.findIndex(x => x.user_id === m.user_id); if (i >= 0) S.members[i] = {...S.members[i], ...m}; }
function syncMyAcads() { (S.myAcads || []).forEach(x => { if (x.academy.id === S.academy.id) { x.member = S.member; x.academy = S.academy; } }); }
const IN = {
  todoDone: async el => { const t = (S.todos || []).find(x => x.id === el.dataset.id); if (!t) return; await save('todos', {...t, done: el.checked}); render(); },
  perm: async el => { if (!isOwner()) return; const st = {...(S.academy.settings || {})}, perms = {...(st.perms || {})}; perms[el.dataset.t] = {...permsFor(el.dataset.t), [el.dataset.k]: el.checked}; st.perms = perms;
    try { const a = await API.updateAcademy({...S.academy, settings: st}); S.academy = {...S.academy, ...a, settings: st}; syncMyAcads(); toast('권한을 저장했어요'); } catch (e) { toast('저장 실패: ' + e); el.checked = !el.checked; } },
  edType: el => { const t = S.ed.types[el.dataset.t] || (S.ed.types[el.dataset.t] = []); t[+el.dataset.i] = el.value.trim(); },
  blv: el => { S.f.blv = el.value; render(); },
  it: el => { S.it[el.dataset.k] = el.value; if (el.dataset.k === 'subject') render(); },
  itPText: el => { S.it.passage_text = el.value; },
  itQ: el => { S.it.questions[+el.dataset.i][el.dataset.k] = el.value; },
  aiPick: el => { const p = S.aiPick || (S.aiPick = new Set()); el.checked ? p.add(el.dataset.id) : p.delete(el.dataset.id); render(); },
  ws: el => { const k = el.dataset.k; S.ws[k] = k === 'cols' ? +el.value : k === 'with_answers' ? el.value === '1' : el.value; },
  wsStu: el => { if (el.value) { S.ws.student_ids.push(el.value); render(); } },
  mTitle: async el => { try { await API.setMember(S.academy.id, el.dataset.u, {title: el.value}); const m = S.members.find(x => x.user_id === el.dataset.u); if (m) m.title = el.value; if (el.dataset.u === S.user.id) { S.member.title = el.value; syncMyAcads(); } toast('직책을 바꿨어요'); render(); } catch (e) { toast(String(e)); } },
  q: el => { S.q = el.value; const pos = el.selectionStart; render(); const n = document.querySelector('[data-in="q"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } },
  f: el => { S.f[el.dataset.k] = el.value; render(); },
  noteMemo: el => { const a = S.attempts.find(x => x.id === el.dataset.a), n = a.notes || (a.notes = {}), o = n[el.dataset.q] || (n[el.dataset.q] = {}); o.memo = el.value; clearTimeout(el._t); el._t = setTimeout(() => save('attempts', a), 600); },
  ed: el => { const k = el.dataset.k; S.ed[k] = ['choices', 'defPts', 'max'].includes(k) ? +el.value : el.value; if (k !== 'title' && k !== 'source') { const t = document.querySelector('[data-k="title"]'); if (t) t.placeholder = autoTitle(S.ed); } if (['defPts', 'max'].includes(k)) edInfo(); },
  edLay: el => { S.ed.layout[el.dataset.k] = +el.value; },
  edTracks: el => { const known = {화작: 'hj', 언매: 'em', 확통: 'pr', 미적: 'ca', 기하: 'ge'}, names = el.value.split(',').map(x => x.trim()).filter(Boolean), old = S.ed.layout.tracks || [];
    S.ed.layout.tracks = names.map((n, i) => { const o = old.find(t => t.name === n); return {id: o ? o.id : (known[n] || 't' + (i + 1)), name: n}; }); },
  edKey: el => { const d = S.ed, t = el.dataset.t, len = +el.dataset.to - +el.dataset.from + 1; d.key[t] = parseKey(el.value, len, ((d.short || {})[t] || []).length > 0); edInfo(); },
  edList: el => { const d = S.ed; (d[el.dataset.k] || (d[el.dataset.k] = {}))[el.dataset.t] = nums(el.value); edInfo(); },
  edCut: el => { const c = S.ed.cuts[el.dataset.t] || (S.ed.cuts[el.dataset.t] = []); c[+el.dataset.i] = +el.value || 0; },
  edArea: el => { S.ed.areas[el.dataset.t] = el.value; },
  edExt: el => { const o = {}; el.value.split('\n').forEach(l => { const m = l.trim().match(/^(?:([a-z0-9]+):)?(\d+)\s+([\d.]+)/); if (m) o[(m[1] ? m[1] + ':' : '') + m[2]] = +m[3]; }); S.ed.ext_rates = o; },
  edPublic: el => { S.ed.academy_id = el.checked ? null : S.academy.id; },
  gStu: el => { const s = stuById(el.value), e = examById(S.g.exam_id); S.g.student_id = el.value; if (s && e) S.g.subject = prefTrack(s, e); render(); },
  gExam: el => { const e = examById(el.value); S.g.exam_id = el.value; S.g.answers = []; S.g.wrong = []; S.g.picks = []; S.g.picksTouched = false; S.g.notes = {}; S.g.cur = 1; if (e) S.g.subject = prefTrack(stuById(S.g.student_id), e); render(); },
  gSubj: el => { S.g.subject = el.value; S.g.picksTouched = false; render(); },
  gDate: el => { S.g.taken_date = el.value; },
  gAtt: el => { S.g.attitude = el.value; },
  gMemo: el => { const n = S.g.notes[el.dataset.q] || (S.g.notes[el.dataset.q] = {}); n.memo = el.value; },
  gPaste: el => { const c = gCtx(); if (!c) return; const t = el.value.trim(); if (!t) return; const toks = /[\s,]/.test(t) ? t.split(/[\s,]+/).filter(Boolean) : t.replace(/[^0-9]/g, '').split('');
    const n = QN(c.e), g = S.g; toks.slice(0, n).forEach((v, i) => g.answers[i] = /^\d+$/.test(v) && +v !== 0 ? +v : null); g.cur = Math.min(n, toks.length + 1); el.value = ''; gradeDyn(); toast(`${Math.min(n, toks.length)}문항 입력했어요`); }
};
document.addEventListener('click', ev => { const ga = ev.target.closest && ev.target.closest('[data-act]'); if (ga && S.member && !actAllowed(ga)) { ev.preventDefault(); toast(`${roleName(S.member)} 직책에는 이 권한이 없어요`); return; } if (S.menu && !ev.target.closest('#umenu') && !ev.target.closest('[data-act=menu]')) { S.menu = false; const m = document.getElementById('umenu'); if (m) m.remove(); const c = document.querySelector('.uchip'); if (c) c.setAttribute('aria-expanded', 'false'); } const el = ev.target.closest('[data-act]'); if (!el || el.disabled) return; const f = ACT[el.dataset.act]; if (f) { ev.preventDefault(); f(el, ev); } });
document.addEventListener('input', ev => {
  const el = ev.target.closest && ev.target.closest('[data-in]'); if (!el) return; const k = el.dataset.in;
  if (k === 'q' && ev.isComposing) return;
  if (k === 'gPaste' || k === 'btype' || k === 'wsFind' || k === 'dropFile') return;
  const f = IN[k]; if (f) f(el);
});
document.addEventListener('compositionend', ev => { const el = ev.target.closest && ev.target.closest('[data-in="q"]'); if (el) IN.q(el); });
document.addEventListener('change', async ev => { const el = ev.target; if (!el.dataset) return; const k = el.dataset.in;
  if (k === 'gPaste' && el.value) IN.gPaste(el);
  if (k === 'btype') { S.f.btype = el.value.trim(); render(); }
  if (k === 'wsFind') { S.f.wsFind = el.value.trim(); render(); }
  if (k === 'dropFile' && el.files && el.files[0]) { try { setDropImg(el.dataset.k, await compressImage(el.files[0])); } catch (e) { toast(String(e)); } }
});
document.addEventListener('paste', async ev => {
  if (S.view !== 'itemEdit' || !S.dropKey) return; const t = ev.target; if (t && /INPUT|TEXTAREA/.test(t.tagName)) return;
  const f = [...((ev.clipboardData || {}).items || [])].find(i => i.type && i.type.startsWith('image/')); if (!f) { toast('클립보드에 이미지가 없어요. 캡처 후 다시 붙여넣어 주세요'); return; }
  ev.preventDefault(); try { setDropImg(S.dropKey, await compressImage(f.getAsFile())); toast('이미지를 붙여넣었어요'); } catch (e) { toast(String(e)); }
});
document.addEventListener('dragover', ev => { if (ev.target.closest && ev.target.closest('.drop')) ev.preventDefault(); });
document.addEventListener('drop', async ev => { const d = ev.target.closest && ev.target.closest('.drop'); if (!d) return; ev.preventDefault(); const f = [...(ev.dataTransfer.files || [])].find(x => x.type.startsWith('image/')); if (f) { try { setDropImg(d.dataset.k, await compressImage(f)); } catch (e) { toast(String(e)); } } });
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && S.menu) { S.menu = false; render(); return; }
  if (S.view !== 'grade' || !S.g || document.getElementById('modal')) return;
  const t = ev.target;
  if (t && t.id === 'g-short' && ev.key === 'Enter') { ev.preventDefault(); ACT.gShortOk(); return; }
  if (t && t.dataset && t.dataset.in === 'gPaste' && ev.key === 'Enter') { ev.preventDefault(); IN.gPaste(t); return; }
  if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
  const c = gCtx(); if (!c || c.mode !== 'answers') return;
  const g = S.g, n = QN(c.e);
  if (isShort(c.e, c.tr, g.cur) && /^[0-9]$/.test(ev.key)) { const i = document.getElementById('g-short'); if (i) { i.focus(); } return; }
  if (/^[0-9]$/.test(ev.key) && +ev.key <= c.e.choices) { const v = +ev.key; if (v) setAns(v); else { g.answers[g.cur - 1] = null; gradeDyn(); } ev.preventDefault(); }
  else if (ev.key === 'ArrowRight') { g.cur = Math.min(n, g.cur + 1); gradeDyn(); ev.preventDefault(); }
  else if (ev.key === 'ArrowLeft') { g.cur = Math.max(1, g.cur - 1); gradeDyn(); ev.preventDefault(); }
  else if (ev.key === 'Backspace') { g.answers[g.cur - 1] = null; gradeDyn(); ev.preventDefault(); }
});

try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
boot();
})();
