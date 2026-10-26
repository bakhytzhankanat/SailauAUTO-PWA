import { LANG, LANGS, setLang } from '../i18n/index.js';

/** Қазақша / Русский segmented switch. Changing it reloads the app in the chosen language. */
export default function LanguageSwitch({ compact = false }) {
  return (
    <div className={`segmented ${compact ? 'w-[190px]' : ''}`} role="group" aria-label="Тіл / Язык">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          aria-pressed={LANG === l.code}
          onClick={() => { if (LANG !== l.code) setLang(l.code); }}
          className={compact ? '!py-1.5 !text-xs' : ''}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
