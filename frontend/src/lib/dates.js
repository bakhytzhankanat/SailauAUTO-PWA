// Kazakh date wording. Browsers render 'kk-KZ' inconsistently ("2026 M10 19"), so names are spelled out here.
const MONTHS = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
const WEEKDAYS = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'];
const WEEKDAYS_SHORT = ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'];

/** YYYY-MM-DD of the device's local day (toISOString would give yesterday before 05:00 in Kazakhstan). */
export function localIso(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayIso() {
  return localIso(new Date());
}

/** Parse YYYY-MM-DD (or an ISO timestamp) as a local calendar day. */
export function parseDay(value) {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12);
}

export function addDays(iso, delta) {
  const d = parseDay(iso);
  d.setDate(d.getDate() + delta);
  return localIso(d);
}

/** "19 қазан" */
export function dayMonth(iso) {
  const d = parseDay(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '';
}

/** "19 қазан 2026" */
export function longDate(iso) {
  const d = parseDay(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

/** "дүйсенбі" */
export function weekday(iso) {
  const d = parseDay(iso);
  return d ? WEEKDAYS[d.getDay()] : '';
}

/** "Дс" */
export function weekdayShort(iso) {
  const d = parseDay(iso);
  return d ? WEEKDAYS_SHORT[d.getDay()] : '';
}

export function isTodayIso(iso) {
  return String(iso || '').slice(0, 10) === todayIso();
}

/** Mon..Sun of the week containing iso. */
export function weekOf(iso) {
  const d = parseDay(iso);
  const shift = d.getDay() === 0 ? -6 : 1 - d.getDay();
  const monday = addDays(iso, shift);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "14:05" from a timestamp, in the device's time zone. */
export function clockTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "19 қазан, 14:05" */
export function dateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return `${dayMonth(localIso(d))}, ${clockTime(ts)}`;
}

export function money(n) {
  const v = Number(n) || 0;
  return `${Math.round(v).toLocaleString('ru-RU').replace(/ /g, ' ')} ₸`;
}
