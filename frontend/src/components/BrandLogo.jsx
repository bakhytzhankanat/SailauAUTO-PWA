import { useState } from 'react';
import { BRAND_LOGOS } from '../data/brandLogos';

const SIZES = { sm: 'w-7 h-7 p-1', md: 'w-9 h-9 p-1.5', lg: 'w-11 h-11 p-1.5' };

/** Make logo on a white tile (logos are drawn for light backgrounds); letter badge when there is none. */
export default function BrandLogo({ make, size = 'sm' }) {
  const [failed, setFailed] = useState(false);
  const src = BRAND_LOGOS[make];
  const box = SIZES[size] || SIZES.sm;
  if (src && !failed) {
    return (
      <span className={`${box} rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm`}>
        <img src={src} alt={make} loading="lazy" decoding="async" onError={() => setFailed(true)} className="max-w-full max-h-full object-contain" />
      </span>
    );
  }
  const letter = make.replace(/^ВАЗ \(Lada\)$/, 'Lada').charAt(0).toUpperCase();
  return (
    <span className={`${box} rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-bold flex items-center justify-center shrink-0`}>
      {letter}
    </span>
  );
}
