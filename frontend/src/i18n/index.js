// Interface language. Kazakh strings are the keys; ru.js maps them to Russian.
// The language is stored per device; switching reloads the page so that every label,
// including ones built at module load (status names, months), is re-read in the new language.
import RU from './ru.js';

const STORAGE_KEY = 'sailau_lang';
export const LANGS = [
  { code: 'kk', label: 'Қазақша' },
  { code: 'ru', label: 'Русский' },
];

function readLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'ru' ? 'ru' : 'kk';
  } catch {
    return 'kk';
  }
}

export const LANG = readLang();

if (typeof document !== 'undefined') document.documentElement.lang = LANG === 'ru' ? 'ru' : 'kk';

/**
 * Translate a Kazakh source string. `vars` fills {0}, {1}… (array) or {name} (object) placeholders.
 * Unknown strings (and anything in Kazakh mode) come back unchanged.
 */
export function tx(source, vars) {
  let out = LANG === 'ru' && Object.prototype.hasOwnProperty.call(RU, source) ? RU[source] : source;
  if (vars != null) {
    out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''));
  }
  return out;
}

/** Text that comes from the database or the server (service names, error messages). */
export function txData(value) {
  if (value == null || LANG !== 'ru') return value;
  const s = String(value);
  return Object.prototype.hasOwnProperty.call(RU, s) ? RU[s] : s;
}

// Server messages with numbers inside: Kazakh pattern → Russian template.
const SERVER_PATTERNS = [
  [/^Сату бағасы (.+)–(.+) аралығында болуы керек$/, 'Цена продажи должна быть от $1 до $2'],
  [/^Қоймада жеткіліксіз: (.+) < (.+)$/, 'Недостаточно на складе: $1 < $2'],
  [/^Қалдық жеткіліксіз\. Қалдық: (.*)$/, 'Недостаточно на складе. Остаток: $1'],
  [/^Аралық (\d+) күннен аспауы керек$/, 'Период не может быть длиннее $1 дней'],
  [/^Бөлшек табылмады: (.*)$/, 'Запчасть не найдена: $1'],
  [/^(.+) 0–100 аралығында болуы керек$/, '$1: от 0 до 100'],
];

/** Error text from the API: exact phrase first, then the numbered patterns above. */
export function txServer(message) {
  if (message == null || LANG !== 'ru') return message;
  const s = String(message);
  if (Object.prototype.hasOwnProperty.call(RU, s)) return RU[s];
  for (const [re, ru] of SERVER_PATTERNS) if (re.test(s)) return s.replace(re, ru);
  return s;
}

export function setLang(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code === 'ru' ? 'ru' : 'kk');
  } catch {
    // Storage blocked: nothing to persist, stay on the current language.
    return;
  }
  window.location.reload();
}
