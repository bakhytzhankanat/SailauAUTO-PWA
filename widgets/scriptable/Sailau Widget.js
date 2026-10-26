// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: car;

/**
 * Sailau Auto — iPhone widgets (Scriptable).
 *
 * Widget parameter (long-press widget → Edit Widget → Parameter), words separated by spaces:
 *   today | boxes | kassa | week | stock | reminders | dash      — which widget (default: today)
 *   ru                                                          — Russian labels (default: Kazakh)
 *   demo                                                        — sample data, no login needed
 * Examples: "kassa"   "boxes ru"   "week demo"
 * Lock screen widgets use the same parameter (today / boxes / kassa work best).
 *
 * Run the script inside Scriptable once to sign in. Only the session token is stored (Keychain);
 * the password is never saved.
 */

const CONFIG = {
  api: 'https://sailau-auto-pwa-backend.onrender.com/api',
  app: 'https://sailau-auto-pwa-frontend.onrender.com',
  timeout: 25,
};
const KEY_TOKEN = 'sailau_widget_token';
const KEY_USER = 'sailau_widget_user';

// ---------------------------------------------------------------- theme
const C = {
  bg1: new Color('#171C21'),
  bg2: new Color('#0D1013'),
  card: new Color('#20262D'),
  card2: new Color('#262D35'),
  line: new Color('#2E353D'),
  ink: new Color('#EEF2F4'),
  muted: new Color('#8E99A4'),
  faint: new Color('#5D6772'),
  teal: new Color('#2A9183'),
  tealHi: new Color('#4FD1BC'),
  yellow: new Color('#F2C43D'),
  red: new Color('#EF5854'),
  green: new Color('#38C478'),
  plateBlue: new Color('#00A3D9'),
  white: new Color('#FFFFFF'),
  black: new Color('#0D1117'),
};
const STATUS_COLOR = {
  planned: new Color('#5492FF'),
  arrived: new Color('#FF8C42'),
  in_progress: C.yellow,
  completed: C.green,
  no_show: new Color('#7C848E'),
};
const F = {
  hero: (s) => Font.heavyRoundedSystemFont(s),
  bold: (s) => Font.boldRoundedSystemFont(s),
  semi: (s) => Font.semiboldRoundedSystemFont(s),
  med: (s) => Font.mediumRoundedSystemFont(s),
  reg: (s) => Font.regularRoundedSystemFont(s),
  mono: (s) => Font.boldMonospacedSystemFont(s),
};

// ---------------------------------------------------------------- texts
const T = {
  kz: {
    today: 'Бүгін', boxes: 'Бокстар', kassa: 'Касса', week: '7 күн', stock: 'Қойма', reminders: 'Ескертпелер', dash: 'Sailau Auto',
    done: 'аяқталды', next: 'Келесі', none: 'Бүгін жазба жоқ', noneLeft: 'Қалған жазба жоқ', free: 'Бос', box: 'Бокс',
    status: { planned: 'Жоспарда', arrived: 'Келді', in_progress: 'Жұмыста', completed: 'Аяқталды', no_show: 'Болмады' },
    cars: 'көлік', avg: 'орташа чек', vsYesterday: 'кешемен', kaspi: 'Kaspi', cash: 'Қолма-қол', mixed: 'Аралас',
    total: 'Барлығы', best: 'Ең жақсы', perDay: 'күніне', low: 'аз қалды', allGood: 'Қойма толық', min: 'мин',
    noReminders: 'Белсенді ескертпе жоқ', active: 'белсенді', updated: 'жаңартылды', offline: 'желі жоқ · кэш',
    login: 'Кіру үшін Scriptable-да скриптті ашыңыз', loginTitle: 'Sailau Auto-ға кіру', phone: 'Телефон', password: 'Құпия сөз',
    signIn: 'Кіру', cancel: 'Болдырмау', signOut: 'Шығу', preview: 'Алдын ала қарау', signedAs: 'Кірген:', noAccess: 'Бұл виджет иесі мен аға шеберге ғана',
    working: 'жұмыста', waiting: 'күтуде', upcoming: 'Алдағы жазбалар', time: 'уақыт',
  },
  ru: {
    today: 'Сегодня', boxes: 'Боксы', kassa: 'Касса', week: '7 дней', stock: 'Склад', reminders: 'Напоминания', dash: 'Sailau Auto',
    done: 'готово', next: 'Следующая', none: 'Сегодня записей нет', noneLeft: 'Больше записей нет', free: 'Свободен', box: 'Бокс',
    status: { planned: 'Запланир.', arrived: 'Приехал', in_progress: 'В работе', completed: 'Готово', no_show: 'Не пришёл' },
    cars: 'машин', avg: 'средний чек', vsYesterday: 'ко вчера', kaspi: 'Kaspi', cash: 'Наличные', mixed: 'Смешанная',
    total: 'Итого', best: 'Лучший', perDay: 'в день', low: 'заканчивается', allGood: 'Склад в порядке', min: 'мин',
    noReminders: 'Активных напоминаний нет', active: 'активных', updated: 'обновлено', offline: 'нет сети · кэш',
    login: 'Откройте скрипт в Scriptable, чтобы войти', loginTitle: 'Вход в Sailau Auto', phone: 'Телефон', password: 'Пароль',
    signIn: 'Войти', cancel: 'Отмена', signOut: 'Выйти', preview: 'Предпросмотр', signedAs: 'Вход:', noAccess: 'Виджет доступен владельцу и старшему мастеру',
    working: 'в работе', waiting: 'ждут', upcoming: 'Ближайшие записи', time: 'время',
  },
};
const MONTHS = {
  kz: ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
};
const WD = { kz: ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'], ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] };

// ---------------------------------------------------------------- params
const PARAM = String((typeof args !== 'undefined' && args.widgetParameter) || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
const KINDS = ['today', 'boxes', 'kassa', 'week', 'stock', 'reminders', 'dash'];
const LANG = PARAM.includes('ru') ? 'ru' : 'kz';
const L = T[LANG];
const DEMO = PARAM.includes('demo');
let KIND = PARAM.find((p) => KINDS.includes(p)) || 'today';
const FAMILY = config.widgetFamily || 'medium';

// ---------------------------------------------------------------- helpers
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const hhmm = (t) => String(t || '').slice(0, 5);
const dayLabel = (d) => `${d.getDate()} ${MONTHS[LANG][d.getMonth()]}`;
const money = (n) => `${Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`;
const short = (n) => {
  const v = Math.round(Number(n) || 0);
  if (v >= 1000000) return `${(v / 1000000).toFixed(v >= 10000000 ? 0 : 1).replace('.0', '')}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
};
const minutesOf = (t) => { const [h, m] = hhmm(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

function link(path) { return `${CONFIG.app}${path}`; }

/** Usable width of a medium/large widget (points) for the current iPhone, minus padding. */
function widgetInnerWidth() {
  let screen = 393;
  try { screen = Math.min(Device.screenSize().width, Device.screenSize().height); } catch (e) {}
  const outer = screen >= 428 ? 364 : screen >= 390 ? 338 : screen >= 375 ? 329 : 292;
  return outer - 28;
}

class AuthError extends Error {}
class AccessError extends Error {}

async function api(path) {
  const token = Keychain.contains(KEY_TOKEN) ? Keychain.get(KEY_TOKEN) : null;
  if (!token) throw new AuthError('no token');
  const req = new Request(CONFIG.api + path);
  req.headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  req.timeoutInterval = CONFIG.timeout;
  let json;
  try {
    json = await req.loadJSON();
  } catch (e) {
    throw new Error(`network: ${e.message || e}`);
  }
  const res = req.response || {};
  const headers = res.headers || {};
  const fresh = headers['X-Refresh-Token'] || headers['x-refresh-token'];
  if (fresh) Keychain.set(KEY_TOKEN, fresh);
  if (res.statusCode === 401) throw new AuthError(json && json.error);
  if (res.statusCode === 403) throw new AccessError(json && json.error);
  if (res.statusCode >= 400) throw new Error((json && json.error) || `HTTP ${res.statusCode}`);
  return json;
}

// Cache: the last good data per widget kind, shown when the server is asleep or offline.
const fm = FileManager.local();
const cachePath = (k) => fm.joinPath(fm.cacheDirectory(), `sailau-widget-${k}.json`);
function saveCache(k, data) { try { fm.writeString(cachePath(k), JSON.stringify({ at: Date.now(), data })); } catch (e) {} }
function readCache(k) { try { const p = cachePath(k); return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; } catch (e) { return null; } }

// ---------------------------------------------------------------- data loaders
async function loadToday() {
  const today = new Date();
  const list = await api(`/bookings?date=${iso(today)}`);
  return { date: iso(today), bookings: Array.isArray(list) ? list : [] };
}
async function loadBoxes() {
  const [day, settings] = await Promise.all([loadToday(), api('/settings').catch(() => ({}))]);
  return { ...day, boxCount: Math.min(4, Math.max(1, parseInt(settings.box_count, 10) || 2)) };
}
async function loadKassa() {
  const day = await loadToday();
  let yesterday = null;
  try {
    const y = await api(`/analytics/summary?period=day&date=${iso(addDays(new Date(), -1))}`);
    yesterday = y && y.metrics ? Number(y.metrics.service_income_total) || 0 : null;
  } catch (e) { if (e instanceof AuthError) throw e; }
  return { ...day, yesterday };
}
async function loadWeek() {
  const end = new Date();
  const start = addDays(end, -6);
  const s = await api(`/analytics/summary?period=range&date=${iso(start)}&end_date=${iso(end)}`);
  return { rows: (s.daily_rows || []).map((r) => ({ date: r.date, value: Number(r.service_income) || 0 })), metrics: s.metrics || {} };
}
async function loadStock() {
  const items = await api('/inventory');
  return { items: Array.isArray(items) ? items : [] };
}
async function loadReminders() {
  const items = await api('/reminders?status=active');
  return { items: Array.isArray(items) ? items : [] };
}
async function loadDash() {
  const [day, stock, rem] = await Promise.all([loadToday(), loadStock().catch(() => ({ items: [] })), loadReminders().catch(() => ({ items: [] }))]);
  return { ...day, stockItems: stock.items, reminders: rem.items };
}
const LOADERS = { today: loadToday, boxes: loadBoxes, kassa: loadKassa, week: loadWeek, stock: loadStock, reminders: loadReminders, dash: loadDash };

// ---------------------------------------------------------------- demo data
function demoData(kind) {
  const d = iso(new Date());
  const mk = (id, status, s, e, box, car, plate, client, master, extra = {}) => ({ id: `demo-${id}`, status, start_time: `${s}:00`, end_time: `${e}:00`, box_id: box, vehicle_name: car, plate_number: plate, client_name: client, assigned_master_name: master, services: [], ...extra });
  const started = new Date(Date.now() - 47 * 60000).toISOString();
  const bookings = [
    mk(1, 'completed', '10:00', '11:30', 1, 'Toyota Alphard', '777 ABK 02', 'Асхат Нұрланов', 'Ерлан', { service_payment_amount: '55000', payment_type: 'kaspipay' }),
    mk(2, 'completed', '10:30', '12:00', 2, 'Toyota Sienna', '123 KZA 02', 'Бауыржан Сейітов', 'Дәурен', { service_payment_amount: '30000', payment_type: 'cash' }),
    mk(3, 'in_progress', '12:00', '14:00', 1, 'Toyota Estima', '045 BCA 01', 'Гүлнар Ахметова', 'Ерлан', { started_at: started }),
    mk(4, 'arrived', '13:00', '14:00', 2, 'Honda Odyssey', '908 AAE 02', 'Данияр Оспанов', 'Нұрболат'),
    mk(5, 'planned', '14:30', '16:00', 1, 'Nissan Elgrand', '311 HKM 05', 'Ержан Тоқтаров', 'Дәурен'),
    mk(6, 'planned', '15:00', '17:00', 2, 'Toyota Voxy', '520 OPR 02', 'Жанар Байжанова', 'Нұрболат'),
    mk(7, 'planned', '16:30', '17:30', 1, 'Hyundai Staria', '001 SLV 02', 'Мұрат Жақсылықов', null),
    mk(8, 'no_show', '17:15', '18:00', 2, 'Nissan Serena', '714 MNA 13', 'Нұрлан Қасымов', null),
  ];
  const stock = [
    { id: 's1', name: 'Шлейф', quantity: 0, min_quantity: 2, low_stock: true },
    { id: 's2', name: 'Актуатор (сервопривод)', quantity: 1, min_quantity: 2, low_stock: true },
    { id: 's3', name: 'Ішкі тұтқа', quantity: 2, min_quantity: 3, low_stock: true },
    { id: 's4', name: 'Ролик төменгі', quantity: 20, min_quantity: 4, low_stock: false },
  ];
  const reminders = [
    { id: 'r1', title: 'Шлейф бітті — жеткізушіге тапсырыс беру', priority: 'high' },
    { id: 'r2', title: 'Айдосқа гарантия бойынша қоңырау шалу', priority: 'medium' },
    { id: 'r3', title: 'Бокс 2 жарығын ауыстыру', priority: 'medium' },
    { id: 'r4', title: 'Жаңа прайс-парақты басып шығару', priority: 'low' },
  ];
  const week = [62000, 48000, 95000, 71000, 38000, 104000, 85000].map((v, i) => ({ date: iso(addDays(new Date(), i - 6)), value: v }));
  const base = { date: d, bookings };
  return {
    today: base, boxes: { ...base, boxCount: 2 }, kassa: { ...base, yesterday: 76000 },
    week: { rows: week, metrics: {} }, stock: { items: stock }, reminders: { items: reminders },
    dash: { ...base, stockItems: stock, reminders },
  }[kind];
}

// ---------------------------------------------------------------- derived numbers
function dayStats(bookings) {
  const by = (s) => bookings.filter((b) => b.status === s).length;
  const active = bookings.filter((b) => b.status !== 'no_show');
  const now = nowMinutes();
  const upcoming = bookings
    .filter((b) => b.status === 'planned' || b.status === 'arrived')
    .sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time));
  const next = upcoming.find((b) => minutesOf(b.end_time) >= now) || upcoming[0] || null;
  return {
    total: active.length, done: by('completed'), working: by('in_progress'), arrived: by('arrived'), planned: by('planned'), noShow: by('no_show'),
    upcoming, next,
  };
}
function kassaStats(bookings) {
  const done = bookings.filter((b) => b.status === 'completed');
  const sum = (type) => done.filter((b) => !type || b.payment_type === type).reduce((s, b) => s + (Number(b.service_payment_amount) || 0), 0);
  const total = sum();
  return { total, kaspi: sum('kaspipay'), cash: sum('cash'), mixed: sum('mixed'), cars: done.length, avg: done.length ? total / done.length : 0 };
}

// ---------------------------------------------------------------- drawing
function ring(progress, size, { width = 0.13, track = C.line, color = C.tealHi, label = null, sub = null, mono = false } = {}) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const lw = size * width;
  const r = (size - lw) / 2;
  const c = size / 2;
  const arc = (from, to, col) => {
    const steps = Math.max(2, Math.ceil((to - from) * 120));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (from + (to - from) * (i / steps)) * Math.PI * 2;
      pts.push(new Point(c + r * Math.cos(a), c + r * Math.sin(a)));
    }
    const p = new Path();
    p.addLines(pts);
    ctx.addPath(p);
    ctx.setStrokeColor(col);
    ctx.setLineWidth(lw);
    ctx.strokePath();
    // round caps
    for (const pt of [pts[0], pts[pts.length - 1]]) {
      ctx.setFillColor(col);
      ctx.fillEllipse(new Rect(pt.x - lw / 2, pt.y - lw / 2, lw, lw));
    }
  };
  arc(0, 1, mono ? new Color('#FFFFFF', 0.25) : track);
  if (progress > 0.001) arc(0, Math.min(1, progress), mono ? C.white : color);
  if (label) {
    ctx.setTextAlignedCenter();
    ctx.setTextColor(mono ? C.white : C.ink);
    ctx.setFont(F.hero(size * (sub ? 0.24 : 0.28)));
    ctx.drawTextInRect(label, new Rect(0, sub ? size * 0.3 : size * 0.34, size, size * 0.34));
    if (sub) {
      ctx.setTextColor(mono ? C.white : C.muted);
      ctx.setFont(F.semi(size * 0.11));
      ctx.drawTextInRect(sub, new Rect(0, size * 0.56, size, size * 0.18));
    }
  }
  return ctx.getImage();
}

function splitBar(parts, w, h) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const total = parts.reduce((s, p) => s + p.value, 0);
  const track = new Path();
  track.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2);
  ctx.addPath(track);
  ctx.setFillColor(C.line);
  ctx.fillPath();
  if (total > 0) {
    let x = 0;
    parts.filter((p) => p.value > 0).forEach((p, i, arr) => {
      const pw = i === arr.length - 1 ? w - x : Math.max(h, (p.value / total) * w);
      const seg = new Path();
      seg.addRoundedRect(new Rect(x, 0, pw, h), h / 2, h / 2);
      ctx.addPath(seg);
      ctx.setFillColor(p.color);
      ctx.fillPath();
      x += pw + 2;
    });
  }
  return ctx.getImage();
}

function barChart(rows, w, h, { labels = true } = {}) {
  const ctx = new DrawContext();
  ctx.size = new Size(w, h);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const best = rows.reduce((b, r) => (r.value > b.value ? r : b), rows[0] || { value: 0 });
  const todayIso = iso(new Date());
  const n = rows.length || 1;
  const gap = w / n * 0.28;
  const bw = (w - gap * (n - 1)) / n;
  const lh = labels ? 16 : 0;
  const top = 16;
  rows.forEach((r, i) => {
    const x = i * (bw + gap);
    const bh = Math.max(4, (r.value / max) * (h - lh - top - 4));
    const y = h - lh - bh;
    const isToday = r.date === todayIso;
    const isBest = r === best && r.value > 0;
    const p = new Path();
    p.addRoundedRect(new Rect(x, y, bw, bh), Math.min(7, bw / 2), Math.min(7, bw / 2));
    ctx.addPath(p);
    ctx.setFillColor(isToday ? C.tealHi : isBest ? C.yellow : C.card2);
    ctx.fillPath();
    if (isBest || isToday) {
      ctx.setTextAlignedCenter();
      ctx.setFont(F.bold(10));
      ctx.setTextColor(isToday ? C.tealHi : C.yellow);
      ctx.drawTextInRect(short(r.value), new Rect(x - 8, y - 15, bw + 16, 13));
    }
    if (labels) {
      const d = new Date(`${r.date}T12:00:00`);
      ctx.setTextAlignedCenter();
      ctx.setFont(F.semi(10));
      ctx.setTextColor(isToday ? C.ink : C.muted);
      ctx.drawTextInRect(WD[LANG][d.getDay()], new Rect(x - 6, h - 13, bw + 12, 13));
    }
  });
  return ctx.getImage();
}

// ---------------------------------------------------------------- UI building blocks
function newWidget() {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [C.bg1, C.bg2];
  g.locations = [0, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
  w.setPadding(14, 14, 12, 14);
  w.refreshAfterDate = new Date(Date.now() + 5 * 60000);
  return w;
}

function text(stack, value, font, color = C.ink, { lines = 1, scale = 0.6, opacity = 1 } = {}) {
  const t = stack.addText(String(value));
  t.font = font;
  t.textColor = color;
  t.lineLimit = lines;
  t.minimumScaleFactor = scale;
  if (opacity < 1) t.textOpacity = opacity;
  return t;
}

function symbol(stack, name, size, color) {
  const s = SFSymbol.named(name);
  if (!s) return null;
  s.applyFont(Font.semiboldSystemFont(size));
  const img = stack.addImage(s.image);
  img.imageSize = new Size(size, size);
  img.tintColor = color;
  return img;
}

function header(w, icon, title, right = '', { color = C.tealHi } = {}) {
  const row = w.addStack();
  row.centerAlignContent();
  const badge = row.addStack();
  badge.size = new Size(20, 20);
  badge.cornerRadius = 6;
  badge.backgroundColor = new Color(color.hex, 0.18);
  badge.centerAlignContent();
  symbol(badge, icon, 11, color);
  row.addSpacer(6);
  text(row, title, F.bold(13), C.ink);
  row.addSpacer();
  if (right) text(row, right, F.semi(11), C.muted);
  return row;
}

function dot(stack, color, size = 7) {
  const d = stack.addStack();
  d.size = new Size(size, size);
  d.cornerRadius = size / 2;
  d.backgroundColor = color;
  return d;
}

function plate(stack, number, size = 10) {
  if (!number) return null;
  const p = stack.addStack();
  p.cornerRadius = 3;
  p.borderColor = C.black;
  p.borderWidth = 1;
  p.centerAlignContent();
  const flag = p.addStack();
  flag.backgroundColor = C.plateBlue;
  flag.size = new Size(Math.round(size * 0.55), Math.round(size * 1.6));
  const body = p.addStack();
  body.backgroundColor = C.white;
  body.setPadding(1, 4, 1, 4);
  text(body, String(number).toUpperCase(), F.mono(size), C.black, { scale: 0.7 });
  return p;
}

function pill(stack, color, value, label, width = 0) {
  const p = stack.addStack();
  p.layoutVertically();
  if (width) p.size = new Size(width, 0);
  const top = p.addStack();
  top.centerAlignContent();
  dot(top, color, 6);
  top.addSpacer(4);
  text(top, value, F.bold(15), C.ink);
  text(p, label, F.med(9), C.muted, { scale: 0.7 });
  return p;
}

function footerStamp(w, at, offline) {
  const row = w.addStack();
  row.addSpacer();
  const d = new Date(at || Date.now());
  text(row, offline ? `${L.offline} ${pad(d.getHours())}:${pad(d.getMinutes())}` : `${L.updated} ${pad(d.getHours())}:${pad(d.getMinutes())}`, F.med(8), offline ? C.yellow : C.faint);
}

// ---------------------------------------------------------------- widgets
function buildToday(data, meta) {
  const w = newWidget();
  w.url = link('/');
  const s = dayStats(data.bookings);
  const now = new Date();
  const progress = s.total ? s.done / s.total : 0;
  header(w, 'calendar', L.today, dayLabel(now));
  w.addSpacer(8);

  if (FAMILY === 'small') {
    const row = w.addStack();
    row.centerAlignContent();
    row.addImage(ring(progress, 58, { label: `${s.done}/${s.total}` })).imageSize = new Size(58, 58);
    row.addSpacer(10);
    const col = row.addStack();
    col.layoutVertically();
    text(col, `${s.working}`, F.hero(22), C.yellow);
    text(col, L.working, F.med(10), C.muted);
    w.addSpacer();
    nextLine(w, s, 12);
    return w;
  }

  const body = w.addStack();
  body.centerAlignContent();
  const left = body.addStack();
  left.layoutVertically();
  left.centerAlignContent();
  left.addImage(ring(progress, 78, { label: `${s.done}/${s.total}`, sub: L.done })).imageSize = new Size(78, 78);
  body.addSpacer(14);
  const right = body.addStack();
  right.layoutVertically();
  const pills = right.addStack();
  pills.spacing = 4;
  pill(pills, STATUS_COLOR.planned, s.planned, L.status.planned, 50);
  pill(pills, STATUS_COLOR.arrived, s.arrived, L.status.arrived, 50);
  pill(pills, STATUS_COLOR.in_progress, s.working, L.status.in_progress, 50);
  pill(pills, STATUS_COLOR.completed, s.done, L.status.completed, 50);
  right.addSpacer(10);
  nextCard(right, s);

  if (FAMILY === 'large') {
    w.addSpacer(12);
    upcomingList(w, s.upcoming.filter((b) => b !== s.next).slice(0, 5));
  }
  w.addSpacer();
  footerStamp(w, meta.at, meta.offline);
  return w;
}

function nextLine(w, s, size) {
  const row = w.addStack();
  row.layoutVertically();
  if (!s.next) { text(row, s.total ? L.noneLeft : L.none, F.semi(size - 1), C.muted, { lines: 2 }); return; }
  text(row, L.next, F.med(9), C.muted);
  const line = row.addStack();
  line.centerAlignContent();
  text(line, hhmm(s.next.start_time), F.hero(size + 2), C.tealHi);
  line.addSpacer(5);
  text(line, s.next.vehicle_name || '', F.semi(size - 1), C.ink, { scale: 0.7 });
  row.url = link(`/booking/${s.next.id}`);
}

function nextCard(stack, s) {
  const card = stack.addStack();
  card.layoutVertically();
  card.backgroundColor = C.card;
  card.cornerRadius = 12;
  card.setPadding(8, 10, 8, 10);
  if (!s.next) {
    text(card, s.total ? L.noneLeft : L.none, F.semi(12), C.muted, { lines: 2 });
    return card;
  }
  card.url = link(`/booking/${s.next.id}`);
  const top = card.addStack();
  top.centerAlignContent();
  text(top, L.next, F.med(9), C.muted);
  top.addSpacer();
  text(top, `${L.box} ${s.next.box_id}`, F.semi(9), C.muted);
  const mid = card.addStack();
  mid.centerAlignContent();
  text(mid, hhmm(s.next.start_time), F.hero(17), C.tealHi);
  mid.addSpacer(7);
  text(mid, s.next.vehicle_name || '', F.bold(13), C.ink, { scale: 0.6 });
  card.addSpacer(3);
  const bot = card.addStack();
  bot.centerAlignContent();
  plate(bot, s.next.plate_number, 9);
  bot.addSpacer(6);
  text(bot, s.next.assigned_master_name || s.next.client_name || '', F.med(10), C.muted, { scale: 0.7 });
  return card;
}

function upcomingList(w, list) {
  if (!list.length) return;
  text(w, L.upcoming, F.semi(11), C.muted);
  w.addSpacer(6);
  list.forEach((b, i) => {
    const row = w.addStack();
    row.centerAlignContent();
    row.url = link(`/booking/${b.id}`);
    const time = row.addStack();
    time.size = new Size(44, 0);
    text(time, hhmm(b.start_time), F.bold(13), C.ink);
    dot(row, STATUS_COLOR[b.status] || C.muted, 7);
    row.addSpacer(8);
    const col = row.addStack();
    col.layoutVertically();
    text(col, b.vehicle_name || '', F.semi(12), C.ink);
    text(col, `${L.box} ${b.box_id} · ${b.client_name || ''}`, F.med(9), C.muted);
    row.addSpacer();
    plate(row, b.plate_number, 9);
    if (i < list.length - 1) w.addSpacer(7);
  });
}

function buildBoxes(data, meta) {
  const w = newWidget();
  w.url = link('/');
  const s = dayStats(data.bookings);
  header(w, 'square.grid.2x2', L.boxes, dayLabel(new Date()));
  w.addSpacer(8);
  const row = w.addStack();
  const boxes = Array.from({ length: FAMILY === 'small' ? 1 : data.boxCount }, (_, i) => i + 1);
  const cardW = Math.floor((FAMILY === 'small' ? 130 : widgetInnerWidth() - 8 * (boxes.length - 1)) / boxes.length);
  boxes.forEach((id, i) => {
    const inBox = data.bookings.filter((b) => b.box_id === id);
    const working = inBox.find((b) => b.status === 'in_progress');
    const arrived = inBox.find((b) => b.status === 'arrived');
    const next = s.upcoming.find((b) => b.box_id === id && b !== arrived);
    const card = row.addStack();
    card.layoutVertically();
    card.backgroundColor = C.card;
    card.cornerRadius = 14;
    card.setPadding(9, 10, 9, 10);
    card.size = new Size(cardW, 0);
    const top = card.addStack();
    top.centerAlignContent();
    text(top, `${L.box} ${id}`, F.bold(11), C.muted);
    top.addSpacer();
    const cur = working || arrived;
    dot(top, cur ? STATUS_COLOR[cur.status] : C.green, 8);
    card.addSpacer(5);
    if (cur) {
      card.url = link(`/booking/${cur.id}`);
      text(card, cur.vehicle_name || '', F.bold(14), C.ink, { scale: 0.6 });
      card.addSpacer(3);
      plate(card, cur.plate_number, 9);
      card.addSpacer(5);
      if (working && working.started_at) {
        const tr = card.addStack();
        tr.centerAlignContent();
        symbol(tr, 'timer', 11, C.yellow);
        tr.addSpacer(4);
        const dt = tr.addDate(new Date(working.started_at));
        dt.applyTimerStyle();
        dt.font = F.mono(13);
        dt.textColor = C.yellow;
      } else {
        text(card, L.status[cur.status], F.semi(11), STATUS_COLOR[cur.status]);
      }
    } else {
      text(card, L.free, F.bold(16), C.green);
      card.addSpacer(3);
      text(card, next ? `${L.next}: ${hhmm(next.start_time)}` : L.noneLeft, F.med(10), C.muted, { lines: 2 });
    }
    if (next && cur) {
      card.addSpacer(4);
      text(card, `${L.next} ${hhmm(next.start_time)} · ${next.vehicle_name || ''}`, F.med(9), C.muted, { scale: 0.7 });
    }
    if (i < boxes.length - 1) row.addSpacer(8);
  });
  w.addSpacer();
  footerStamp(w, meta.at, meta.offline);
  return w;
}

function buildKassa(data, meta) {
  const w = newWidget();
  w.url = link('/analytics');
  const k = kassaStats(data.bookings);
  header(w, 'banknote', L.kassa, dayLabel(new Date()), { color: C.yellow });
  w.addSpacer(FAMILY === 'small' ? 8 : 6);

  const delta = data.yesterday ? Math.round(((k.total - data.yesterday) / data.yesterday) * 100) : null;
  const parts = [
    { value: k.kaspi, color: C.red, label: L.kaspi },
    { value: k.cash, color: C.green, label: L.cash },
    { value: k.mixed, color: C.yellow, label: L.mixed },
  ];
  const deltaRow = (stack) => {
    if (delta === null) return;
    const r = stack.addStack();
    r.centerAlignContent();
    const up = delta >= 0;
    symbol(r, up ? 'arrow.up.right' : 'arrow.down.right', 10, up ? C.green : C.red);
    r.addSpacer(3);
    text(r, `${Math.abs(delta)}% ${L.vsYesterday}`, F.semi(10), up ? C.green : C.red);
  };

  if (FAMILY === 'small') {
    text(w, money(k.total), F.hero(24), C.ink, { scale: 0.5 });
    w.addSpacer(2);
    deltaRow(w);
    w.addSpacer();
    w.addImage(splitBar(parts, 130, 7)).imageSize = new Size(130, 7);
    w.addSpacer(5);
    text(w, `${k.cars} ${L.cars} · ${L.avg} ${short(k.avg)}`, F.med(9), C.muted);
    return w;
  }
  const body = w.addStack();
  const left = body.addStack();
  left.layoutVertically();
  text(left, money(k.total), F.hero(30), C.ink, { scale: 0.5 });
  left.addSpacer(2);
  deltaRow(left);
  left.addSpacer(10);
  const st = left.addStack();
  pill(st, C.tealHi, k.cars, L.cars);
  st.addSpacer(16);
  pill(st, C.muted, short(k.avg), L.avg);
  body.addSpacer();
  const right = body.addStack();
  right.layoutVertically();
  right.size = new Size(122, 0);
  right.addImage(splitBar(parts, 122, 8)).imageSize = new Size(122, 8);
  right.addSpacer(8);
  parts.forEach((p) => {
    const r = right.addStack();
    r.centerAlignContent();
    dot(r, p.color, 6);
    r.addSpacer(5);
    text(r, p.label, F.med(10), C.muted);
    r.addSpacer();
    text(r, short(p.value), F.bold(11), C.ink);
    right.addSpacer(4);
  });
  w.addSpacer();
  footerStamp(w, meta.at, meta.offline);
  return w;
}

function buildWeek(data, meta) {
  const w = newWidget();
  w.url = link('/analytics');
  const rows = data.rows;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const best = rows.reduce((b, r) => (r.value > b.value ? r : b), rows[0] || { value: 0, date: iso(new Date()) });
  header(w, 'chart.bar.fill', L.week, money(total), { color: C.tealHi });
  w.addSpacer(8);
  const cw = FAMILY === 'small' ? 130 : 310;
  const ch = FAMILY === 'large' ? 170 : FAMILY === 'small' ? 70 : 82;
  w.addImage(barChart(rows, cw, ch)).imageSize = new Size(cw, ch);
  w.addSpacer(6);
  const foot = w.addStack();
  foot.centerAlignContent();
  text(foot, `${short(total / Math.max(1, rows.length))} ${L.perDay}`, F.semi(10), C.muted);
  foot.addSpacer();
  if (best && best.value) {
    dot(foot, C.yellow, 6);
    foot.addSpacer(4);
    const bd = new Date(`${best.date}T12:00:00`);
    text(foot, `${L.best}: ${WD[LANG][bd.getDay()]} · ${short(best.value)}`, F.semi(10), C.ink);
  }
  if (FAMILY === 'large') {
    w.addSpacer(10);
    [...rows].reverse().forEach((r) => {
      const d = new Date(`${r.date}T12:00:00`);
      const line = w.addStack();
      text(line, `${WD[LANG][d.getDay()]}, ${dayLabel(d)}`, F.med(12), C.muted);
      line.addSpacer();
      text(line, money(r.value), F.bold(12), r === best ? C.yellow : C.ink);
      w.addSpacer(3);
    });
  }
  w.addSpacer();
  footerStamp(w, meta.at, meta.offline);
  return w;
}

function buildStock(data, meta) {
  const w = newWidget();
  w.url = link('/inventory');
  const low = data.items.filter((i) => i.low_stock).sort((a, b) => Number(a.quantity) - Number(b.quantity));
  header(w, 'shippingbox.fill', L.stock, '', { color: low.length ? C.red : C.green });
  w.addSpacer(8);
  if (!low.length) {
    w.addSpacer();
    symbol(w, 'checkmark.seal.fill', 26, C.green);
    w.addSpacer(4);
    text(w, L.allGood, F.bold(14), C.ink);
    w.addSpacer();
    return w;
  }
  if (FAMILY === 'small') {
    const top = w.addStack();
    top.bottomAlignContent();
    text(top, String(low.length), F.hero(34), C.red);
    top.addSpacer(5);
    text(top, L.low, F.semi(11), C.muted);
    w.addSpacer();
    low.slice(0, 2).forEach((i) => { text(w, `${i.name} · ${i.quantity}`, F.semi(11), C.ink, { scale: 0.7 }); w.addSpacer(2); });
    return w;
  }
  const max = FAMILY === 'large' ? 9 : 4;
  low.slice(0, max).forEach((i) => {
    const row = w.addStack();
    row.centerAlignContent();
    const bar = row.addStack();
    bar.size = new Size(3, 14);
    bar.cornerRadius = 1.5;
    bar.backgroundColor = Number(i.quantity) === 0 ? C.red : C.yellow;
    row.addSpacer(7);
    text(row, i.name, F.semi(12), C.ink, { scale: 0.7 });
    row.addSpacer();
    text(row, String(i.quantity), F.hero(14), Number(i.quantity) === 0 ? C.red : C.yellow);
    text(row, ` / ${L.min} ${i.min_quantity ?? '—'}`, F.med(10), C.muted);
    w.addSpacer(5);
  });
  if (low.length > max) text(w, `+${low.length - max}`, F.semi(10), C.muted);
  w.addSpacer();
  footerStamp(w, meta.at, meta.offline);
  return w;
}

function buildReminders(data, meta) {
  const w = newWidget();
  w.url = link('/reminders');
  const order = { high: 0, medium: 1, low: 2 };
  const pc = { high: C.red, medium: new Color('#FF8C42'), low: C.green };
  const list = [...data.items].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
  header(w, 'checklist', L.reminders, list.length ? (FAMILY === 'small' ? String(list.length) : `${list.length} ${L.active}`) : '', { color: C.tealHi });
  w.addSpacer(8);
  if (!list.length) {
    w.addSpacer();
    text(w, L.noReminders, F.semi(13), C.muted, { lines: 2 });
    w.addSpacer();
    return w;
  }
  const max = FAMILY === 'small' ? 3 : FAMILY === 'large' ? 8 : 4;
  list.slice(0, max).forEach((r) => {
    const row = w.addStack();
    row.topAlignContent();
    const d = row.addStack();
    d.setPadding(4, 0, 0, 0);
    dot(d, pc[r.priority] || C.muted, 7);
    row.addSpacer(7);
    text(row, r.title, F.semi(FAMILY === 'small' ? 11 : 12), C.ink, { lines: FAMILY === 'small' ? 2 : 1, scale: 0.8 });
    w.addSpacer(FAMILY === 'small' ? 5 : 6);
  });
  w.addSpacer();
  return w;
}

function buildDash(data, meta) {
  const w = newWidget();
  w.url = link('/');
  const s = dayStats(data.bookings);
  const k = kassaStats(data.bookings);
  header(w, 'car.fill', L.dash, dayLabel(new Date()));
  w.addSpacer(10);
  const top = w.addStack();
  top.centerAlignContent();
  top.addImage(ring(s.total ? s.done / s.total : 0, 74, { label: `${s.done}/${s.total}`, sub: L.done })).imageSize = new Size(74, 74);
  top.addSpacer(12);
  const mid = top.addStack();
  mid.layoutVertically();
  const pills = mid.addStack();
  pill(pills, STATUS_COLOR.in_progress, s.working, L.status.in_progress);
  pills.addSpacer(14);
  pill(pills, STATUS_COLOR.arrived, s.arrived, L.status.arrived);
  pills.addSpacer(14);
  pill(pills, STATUS_COLOR.planned, s.planned, L.status.planned);
  mid.addSpacer(8);
  const cash = mid.addStack();
  cash.centerAlignContent();
  cash.url = link('/analytics');
  symbol(cash, 'banknote', 12, C.yellow);
  cash.addSpacer(5);
  text(cash, money(k.total), F.hero(18), C.ink, { scale: 0.6 });
  cash.addSpacer(5);
  text(cash, `· ${k.cars} ${L.cars}`, F.med(10), C.muted);
  w.addSpacer(12);
  nextCard(w, s);
  w.addSpacer(10);
  upcomingList(w, s.upcoming.filter((b) => b !== s.next).slice(0, 3));
  w.addSpacer();
  const low = (data.stockItems || []).filter((i) => i.low_stock);
  const bottom = w.addStack();
  bottom.centerAlignContent();
  if (low.length) {
    bottom.url = link('/inventory');
    symbol(bottom, 'shippingbox.fill', 11, C.red);
    bottom.addSpacer(4);
    text(bottom, `${L.stock}: ${low.length} ${L.low}`, F.semi(10), C.red);
  }
  bottom.addSpacer();
  const rem = data.reminders || [];
  if (rem.length) {
    symbol(bottom, 'checklist', 11, C.tealHi);
    bottom.addSpacer(4);
    text(bottom, `${rem.length} ${L.active}`, F.semi(10), C.muted);
  }
  return w;
}

// Lock screen (iOS 16+): monochrome, tiny.
function buildAccessory(data) {
  const w = new ListWidget();
  w.setPadding(0, 0, 0, 0);
  w.url = link('/');
  const bookings = data.bookings || [];
  const s = dayStats(bookings);
  if (FAMILY === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true;
    const img = w.addImage(ring(s.total ? s.done / s.total : 0, 60, { label: `${s.done}/${s.total}`, mono: true, width: 0.11 }));
    img.imageSize = new Size(60, 60);
    img.centerAlignImage();
    return w;
  }
  if (FAMILY === 'accessoryInline') {
    text(w, s.next ? `${s.done}/${s.total} · ${hhmm(s.next.start_time)} ${s.next.vehicle_name || ''}` : `${s.done}/${s.total} ${L.done}`, F.semi(12), C.white);
    return w;
  }
  // accessoryRectangular
  const top = w.addStack();
  top.centerAlignContent();
  symbol(top, 'car.fill', 11, C.white);
  top.addSpacer(4);
  text(top, `${L.today} · ${s.done}/${s.total}`, F.bold(12), C.white);
  if (s.working) { top.addSpacer(); text(top, `⏱ ${s.working}`, F.bold(12), C.white); }
  w.addSpacer(2);
  if (s.next) {
    text(w, `${L.next} ${hhmm(s.next.start_time)}`, F.semi(11), C.white, { opacity: 0.75 });
    text(w, `${s.next.vehicle_name || ''} · ${L.box} ${s.next.box_id}`, F.bold(13), C.white, { scale: 0.7 });
  } else {
    text(w, s.total ? L.noneLeft : L.none, F.semi(12), C.white, { lines: 2 });
  }
  return w;
}

function messageWidget(icon, title, body, color = C.tealHi) {
  const w = newWidget();
  w.url = 'scriptable:///run/' + encodeURIComponent(Script.name());
  header(w, icon, 'Sailau Auto', '', { color });
  w.addSpacer();
  text(w, title, F.bold(14), C.ink, { lines: 2 });
  w.addSpacer(4);
  text(w, body, F.med(11), C.muted, { lines: 3 });
  w.addSpacer();
  return w;
}

const BUILDERS = { today: buildToday, boxes: buildBoxes, kassa: buildKassa, week: buildWeek, stock: buildStock, reminders: buildReminders, dash: buildDash };

// ---------------------------------------------------------------- run
async function getData(kind) {
  if (DEMO) return { data: demoData(kind), at: Date.now(), offline: false };
  try {
    const data = await LOADERS[kind]();
    saveCache(kind, data);
    return { data, at: Date.now(), offline: false };
  } catch (e) {
    if (e instanceof AuthError || e instanceof AccessError) throw e;
    const cached = readCache(kind);
    if (cached) return { data: cached.data, at: cached.at, offline: true };
    throw e;
  }
}

async function makeWidget(kind) {
  const accessory = String(FAMILY).startsWith('accessory');
  const dataKind = accessory && !['today', 'boxes', 'dash'].includes(kind) ? 'today' : kind;
  try {
    const { data, at, offline } = await getData(dataKind);
    if (accessory) return buildAccessory(data);
    return BUILDERS[kind](data, { at, offline });
  } catch (e) {
    if (e instanceof AuthError) return messageWidget('person.crop.circle.badge.exclamationmark', L.loginTitle, L.login, C.yellow);
    if (e instanceof AccessError) return messageWidget('lock.fill', L[kind], L.noAccess, C.yellow);
    return messageWidget('wifi.exclamationmark', 'Sailau Auto', String(e.message || e).slice(0, 120), C.red);
  }
}

async function signIn() {
  const a = new Alert();
  a.title = L.loginTitle;
  a.addTextField(L.phone, '+7');
  a.addSecureTextField(L.password, '');
  a.addAction(L.signIn);
  a.addCancelAction(L.cancel);
  if ((await a.presentAlert()) === -1) return false;
  const req = new Request(`${CONFIG.api}/auth/login`);
  req.method = 'POST';
  req.headers = { 'Content-Type': 'application/json' };
  req.body = JSON.stringify({ phone: a.textFieldValue(0).replace(/\s/g, ''), password: a.textFieldValue(1) });
  req.timeoutInterval = 45;
  const res = await req.loadJSON();
  if (!res || !res.token) {
    const err = new Alert();
    err.title = L.loginTitle;
    err.message = (res && res.error) || 'Error';
    err.addAction('OK');
    await err.presentAlert();
    return false;
  }
  Keychain.set(KEY_TOKEN, res.token);
  Keychain.set(KEY_USER, JSON.stringify({ name: res.user && res.user.display_name, role: res.user && res.user.role }));
  return true;
}

async function appMenu() {
  const signed = Keychain.contains(KEY_TOKEN);
  const user = signed && Keychain.contains(KEY_USER) ? JSON.parse(Keychain.get(KEY_USER)) : null;
  const a = new Alert();
  a.title = 'Sailau Auto';
  a.message = signed ? `${L.signedAs} ${user && user.name ? user.name : '—'}` : L.login;
  const actions = [];
  if (!signed) { a.addAction(L.signIn); actions.push('signin'); }
  for (const k of KINDS) { a.addAction(`${L.preview}: ${L[k]}`); actions.push(k); }
  if (signed) { a.addDestructiveAction(L.signOut); actions.push('signout'); }
  a.addCancelAction(L.cancel);
  const i = await a.presentSheet();
  if (i === -1) return;
  const act = actions[i];
  if (act === 'signin') { if (await signIn()) await appMenu(); return; }
  if (act === 'signout') { Keychain.remove(KEY_TOKEN); if (Keychain.contains(KEY_USER)) Keychain.remove(KEY_USER); return; }
  KIND = act;
  const w = await makeWidget(act);
  if (act === 'dash' || act === 'week') await w.presentLarge(); else await w.presentMedium();
}

if (config.runsInWidget) {
  Script.setWidget(await makeWidget(KIND));
} else if (config.runsInApp && !DEMO) {
  await appMenu();
} else {
  const w = await makeWidget(KIND);
  await w.presentMedium();
}
Script.complete();
