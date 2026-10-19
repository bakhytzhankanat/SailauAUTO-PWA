import { useState } from 'react';
import { vehiclePhotoUrl } from '../lib/vehiclePhotos';

/** Catalogue car photo on a soft studio backdrop; a car icon when there is no photo. */
export default function VehiclePhoto({ name, bodyType = null, className = '' }) {
  const [failed, setFailed] = useState(false);
  const src = vehiclePhotoUrl(name, bodyType);
  return (
    <div className={`relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#34373c_0%,#1b1c1e_70%)] ${className}`}>
      {src && !failed ? (
        <>
          <div className="absolute left-[12%] right-[12%] bottom-[9%] h-[10%] rounded-[50%] bg-black/60 blur-md" />
          <img
            src={src}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="relative w-full h-full object-contain"
          />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-primary/80">directions_car</span>
        </div>
      )}
    </div>
  );
}
