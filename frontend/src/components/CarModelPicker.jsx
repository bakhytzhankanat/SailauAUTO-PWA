import { useMemo, useState } from 'react';
import { CAR_MAKES, CAR_MAKE_MODELS, POPULAR_MAKES } from '../data/carMakes';
import BrandLogo from './BrandLogo';
import { tx } from '../i18n/index.js';

const MAX_RESULTS = 40;

function norm(s) {
  return String(s || '').toLowerCase().replace(/[\s-]+/g, '');
}

/**
 * Make → model picker for the "Другое" vehicle. value / onChange carry the final text, e.g. "Toyota Camry".
 * Search works across all makes and models; anything missing can be typed by hand.
 */
export default function CarModelPicker({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [make, setMake] = useState(null);

  const q = norm(query);
  const results = useMemo(() => {
    if (!q) return null;
    const makes = CAR_MAKES.filter((m) => norm(m.name).includes(q)).map((m) => ({ type: 'make', make: m.name }));
    const models = CAR_MAKE_MODELS.filter((m) => norm(m.label).includes(q) || norm(m.model).startsWith(q))
      .map((m) => ({ type: 'model', ...m }));
    return [...makes, ...models].slice(0, MAX_RESULTS);
  }, [q]);

  const currentMake = make ? CAR_MAKES.find((m) => m.name === make) : null;
  const popular = CAR_MAKES.filter((m) => POPULAR_MAKES.includes(m.name))
    .sort((a, b) => POPULAR_MAKES.indexOf(a.name) - POPULAR_MAKES.indexOf(b.name));

  const choose = (label) => {
    onChange(label);
    setQuery('');
    setMake(null);
  };

  const openMake = (name) => {
    setMake(name);
    setQuery('');
  };

  const chip = 'px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left';
  const chipIdle = 'border-border-color bg-card-bg text-ink hover:border-primary/60';

  return (
    (<div className="rounded-2xl border border-border-color bg-bg-main p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{tx("Марка және модель")}</h3>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex items-center gap-1 pl-3 pr-2 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-sm font-semibold"
          >
            {value}
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}
      </div>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">search</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tx("Іздеу: Camry, Tiggo, Lada...")}
          className="w-full pl-10 pr-3 py-2.5 bg-card-bg border border-border-color rounded-lg text-ink placeholder-text-muted focus:ring-1 focus:ring-primary focus:border-primary outline-none text-sm"
        />
      </div>
      {results ? (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {results.map((r) =>
            r.type === 'make' ? (
              <button key={`make-${r.make}`} type="button" onClick={() => openMake(r.make)} className={`${chip} ${chipIdle} w-full flex items-center gap-2`}>
                <BrandLogo make={r.make} />
                <span className="flex-1">{r.make}</span>
                <span className="text-text-muted text-xs">{tx("модельдер")}</span>
                <span className="material-symbols-outlined text-text-muted text-lg">chevron_right</span>
              </button>
            ) : (
              <button key={`model-${r.label}`} type="button" onClick={() => choose(r.label)} className={`${chip} ${chipIdle} w-full flex items-center gap-2`}>
                <BrandLogo make={r.make} />
                <span className="flex-1"><span className="text-text-muted">{r.make}</span> {r.model}</span>
              </button>
            )
          )}
          {results.length === 0 && <p className="text-text-muted text-sm px-1">{tx("Тізімде табылмады.")}</p>}
          <button
            type="button"
            onClick={() => choose(query.trim())}
            className="w-full mt-1 px-3 py-2.5 rounded-lg border border-dashed border-primary/50 text-primary text-sm font-medium flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            «{query.trim()}{tx("» деп жазу")}</button>
        </div>
      ) : currentMake ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMake(null)} className="w-8 h-8 rounded-full bg-card-bg border border-border-color flex items-center justify-center" aria-label={tx("Артқа")}>
              <span className="material-symbols-outlined text-text-muted text-lg">arrow_back</span>
            </button>
            <BrandLogo make={currentMake.name} size="md" />
            <span className="text-ink font-semibold">{currentMake.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {currentMake.models.map((model) => {
              const label = `${currentMake.name} ${model}`;
              return (
                <button
                  key={model}
                  type="button"
                  onClick={() => choose(label)}
                  className={`${chip} ${value === label ? 'border-primary bg-primary/15 text-primary' : chipIdle}`}
                >
                  {model}
                </button>
              );
            })}
            <button type="button" onClick={() => choose(currentMake.name)} className={`${chip} border-dashed border-border-color text-text-muted`}>{tx("Тек марка")}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-[11px] text-text-muted font-semibold mb-1.5">{tx("Танымал")}</div>
            <div className="grid grid-cols-3 gap-2">
              {popular.map((m) => (
                <button key={m.name} type="button" onClick={() => openMake(m.name)} className={`${chip} ${chipIdle} flex flex-col items-center gap-1.5 px-1 py-2.5`}>
                  <BrandLogo make={m.name} size="lg" />
                  <span className="text-[11px] leading-tight text-center">{m.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-text-muted font-semibold mb-1.5">{tx("Барлық маркалар (")}{CAR_MAKES.length})</div>
            <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
              {CAR_MAKES.map((m) => (
                <button key={m.name} type="button" onClick={() => openMake(m.name)} className="pl-1 pr-2.5 py-1 rounded-lg border border-border-color bg-card-bg text-ink text-xs hover:border-primary/60 flex items-center gap-1.5">
                  <BrandLogo make={m.name} />
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>)
  );
}
