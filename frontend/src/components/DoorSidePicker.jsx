import { toggleDoorSide } from '../lib/doorSide';
import { tx } from '../i18n/index.js';

const SIDES = [
  { value: 'left', label: tx("Сол жақ") },
  { value: 'right', label: tx("Оң жақ") },
];

/** Optional door choice: one side, or both when both buttons are on. */
export default function DoorSidePicker({ value, onChange }) {
  return (
    (<div className="flex items-center gap-2">
      {SIDES.map((side) => {
        const active = value === side.value || value === 'both';
        return (
          <button
            key={side.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(toggleDoorSide(value, side.value))}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${
              active ? 'border-primary bg-primary/15 text-primary' : 'border-border-color bg-bg-main text-text-muted'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {side.value === 'left' ? 'arrow_back' : 'arrow_forward'}
            </span>
            {side.label}
          </button>
        );
      })}
      <span className={`text-[11px] font-medium w-16 text-right ${value === 'both' ? 'text-primary' : 'text-text-muted'}`}>
        {value === 'both' ? tx("Екі есік") : value ? tx("1 есік") : '—'}
      </span>
    </div>)
  );
}
