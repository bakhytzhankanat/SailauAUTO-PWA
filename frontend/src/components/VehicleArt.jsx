import { useId } from 'react';

// Side-view illustrations of the catalogue minivans (facing left), drawn from a few
// proportions per model: nose, hood, windshield rake, roof line and paint.
const MODELS = {
  'Toyota Alphard': { paint: '#eceae6', xf: 20, xr: 220, yNose: 80, xHood: 44, yHood: 72, xRoofF: 74, yRoof: 30, yRoofR: 31, grille: 'big' },
  'Toyota Estima': { paint: '#9fb4ca', xf: 16, xr: 222, yNose: 88, xHood: 34, yHood: 80, xRoofF: 92, yRoof: 38, yRoofR: 46, rearRound: 22 },
  'Toyota Sienna': { paint: '#5c6674', xf: 14, xr: 222, yNose: 84, xHood: 52, yHood: 74, xRoofF: 90, yRoof: 38, yRoofR: 42 },
  'Toyota Voxy': { paint: '#2a2c31', xf: 28, xr: 212, yNose: 78, xHood: 48, yHood: 70, xRoofF: 72, yRoof: 30, yRoofR: 30, grille: 'big' },
  'Nissan Serena': { paint: '#dfe6ee', xf: 26, xr: 214, yNose: 80, xHood: 50, yHood: 72, xRoofF: 76, yRoof: 32, yRoofR: 33 },
  'Honda Odyssey': { paint: '#7f1f2c', xf: 14, xr: 224, yNose: 88, xHood: 50, yHood: 80, xRoofF: 96, yRoof: 46, yRoofR: 52, rearRound: 16 },
  'Honda Elysion': { paint: '#c2ab7f', xf: 18, xr: 222, yNose: 84, xHood: 46, yHood: 76, xRoofF: 84, yRoof: 38, yRoofR: 40 },
  'Nissan Elgrand': { paint: '#1f2024', xf: 18, xr: 222, yNose: 78, xHood: 44, yHood: 70, xRoofF: 78, yRoof: 32, yRoofR: 36, grille: 'big' },
};

const GENERIC = { paint: '#6b7280', xf: 20, xr: 220, yNose: 82, xHood: 46, yHood: 74, xRoofF: 82, yRoof: 36, yRoofR: 38 };

const GROUND = 128;
const SILL = 114;
const WHEEL_R = 16;

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.max(0, Math.min(255, ((n >> shift) & 255) + amount));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function Wheel({ cx, rim }) {
  const cy = GROUND - WHEEL_R;
  const spokes = [0, 72, 144, 216, 288];
  return (
    <g>
      <circle cx={cx} cy={cy} r={WHEEL_R + 3.5} fill="#0b0b0c" />
      <circle cx={cx} cy={cy} r={WHEEL_R} fill="#151517" />
      <circle cx={cx} cy={cy} r={WHEEL_R - 5} fill={rim} />
      {spokes.map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(rad) * (WHEEL_R - 6)}
            y2={cy + Math.sin(rad) * (WHEEL_R - 6)}
            stroke="#4b4f56"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r="2.6" fill="#2b2e33" />
    </g>
  );
}

/** Illustration of a catalogue vehicle by name; unknown names get a neutral minivan. */
export default function VehicleArt({ name, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const m = MODELS[name] || GENERIC;
  const { xf, xr, yNose, xHood, yHood, xRoofF, yRoof, yRoofR, paint } = m;
  const rr = m.rearRound ?? 10;
  const xRoofR = xr - 4;
  const length = xr - xf;
  const wheelF = xf + length * 0.2;
  const wheelR = xr - length * 0.19;
  const yBelt = yHood - 1;
  const span = xRoofR - xRoofF;
  const pillarB = xRoofF + span * 0.24;
  const pillarC = xRoofF + span * 0.6;

  const body = [
    `M ${xf + 8} 116`,
    `Q ${xf} 116 ${xf} 106`,
    `L ${xf} ${yNose + 6}`,
    `Q ${xf} ${yNose} ${xf + 7} ${yNose - 2}`,
    `L ${xHood} ${yHood}`,
    `L ${xRoofF} ${yRoof + 5}`,
    `Q ${xRoofF + 3} ${yRoof} ${xRoofF + 12} ${yRoof}`,
    `L ${xRoofR - rr} ${yRoofR}`,
    `Q ${xr} ${yRoofR} ${xr} ${yRoofR + rr}`,
    `L ${xr} 106`,
    `Q ${xr} 116 ${xr - 8} 116`,
    'Z',
  ].join(' ');

  const glass = [
    `M ${xHood + 5} ${yBelt - 1}`,
    `L ${xRoofF + 4} ${yRoof + 7}`,
    `Q ${xRoofF + 6} ${yRoof + 4} ${xRoofF + 13} ${yRoof + 4}`,
    `L ${xRoofR - rr} ${yRoofR + 4}`,
    `Q ${xr - 4} ${yRoofR + 4} ${xr - 4} ${yRoofR + rr + 4}`,
    `L ${xr - 4} ${yBelt}`,
    'Z',
  ].join(' ');

  const pillarTop = (x) => yRoof + 4 + ((x - xRoofF) / span) * (yRoofR - yRoof);
  const pillar = (x, w) => (
    <rect x={x - w / 2} y={pillarTop(x)} width={w} height={yBelt - pillarTop(x) + 1} fill={shade(paint, -18)} />
  );

  return (
    <svg viewBox="0 0 240 150" className={className} role="img" aria-label={name}>
      <defs>
        <radialGradient id={`bg${uid}`} cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#2c2f33" />
          <stop offset="100%" stopColor="#141516" />
        </radialGradient>
        <linearGradient id={`paint${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(paint, 34)} />
          <stop offset="45%" stopColor={paint} />
          <stop offset="100%" stopColor={shade(paint, -42)} />
        </linearGradient>
        <linearGradient id={`glass${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b4a5a" />
          <stop offset="55%" stopColor="#151c24" />
          <stop offset="100%" stopColor="#0b0f14" />
        </linearGradient>
      </defs>

      <rect width="240" height="150" fill={`url(#bg${uid})`} />
      <ellipse cx="120" cy={GROUND + 1} rx={length * 0.52} ry="6" fill="#000" opacity="0.55" />

      <path d={body} fill={`url(#paint${uid})`} />
      <path d={glass} fill={`url(#glass${uid})`} />
      {pillar(pillarB, 5)}
      {pillar(pillarC, 4)}
      <path d={`M ${xRoofF + 16} ${yRoof + 8} L ${pillarB - 6} ${yRoof + 8}`} stroke="#fff" strokeOpacity="0.18" strokeWidth="3" strokeLinecap="round" />

      {/* shoulder highlight, sliding-door track and door seams */}
      <path d={`M ${xHood + 2} ${yBelt + 7} L ${xr - 6} ${yBelt + 7}`} stroke="#fff" strokeOpacity="0.28" strokeWidth="1.2" />
      <path d={`M ${pillarB + 3} ${yBelt + 2} L ${pillarB + 3} ${SILL - 3}`} stroke={shade(paint, -55)} strokeWidth="0.9" />
      <path d={`M ${pillarC + 2} ${yBelt + 2} L ${pillarC + 2} ${SILL - 3}`} stroke={shade(paint, -55)} strokeWidth="0.9" />
      <path d={`M ${xHood + 4} ${yBelt + 2} L ${xHood + 9} ${SILL - 3}`} stroke={shade(paint, -55)} strokeWidth="0.9" />
      <rect x={pillarB - 9} y={yBelt + 11} width="7" height="2" rx="1" fill={shade(paint, -60)} />
      <rect x={pillarC - 8} y={yBelt + 11} width="7" height="2" rx="1" fill={shade(paint, -60)} />

      {/* lower trim */}
      <path d={`M ${xf + 4} 108 L ${xr - 4} 108 L ${xr - 6} 116 L ${xf + 6} 116 Z`} fill="#0f1012" opacity="0.55" />

      {/* mirror, lights, grille */}
      <path d={`M ${xHood + 4} ${yBelt - 3} l -7 -1 l 1 6 l 7 0 Z`} fill={shade(paint, -25)} />
      <path d={`M ${xf + 2} ${yNose + 3} L ${xf + 16} ${yNose} L ${xf + 15} ${yNose + 6} L ${xf + 2} ${yNose + 9} Z`} fill="#e8f1ff" opacity="0.92" />
      <rect x={xr - 4} y={yRoofR + rr + 6} width="4" height="22" rx="1.5" fill="#d0262f" />
      {m.grille === 'big' ? (
        <rect x={xf - 1} y={yNose + 11} width="4" height={104 - yNose - 11} rx="1.5" fill="#c9ccd1" />
      ) : (
        <rect x={xf - 1} y={yNose + 12} width="3" height="8" rx="1" fill="#9aa0a8" />
      )}

      <Wheel cx={wheelF} rim="#a9adb3" />
      <Wheel cx={wheelR} rim="#a9adb3" />
    </svg>
  );
}
