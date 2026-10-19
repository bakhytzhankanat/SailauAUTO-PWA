// Catalogue photos in public/cars (transparent WebP). Some models have one photo per body/generation.
const PHOTOS = {
  'Toyota Alphard': { default: 'toyota-alphard-20', body: (b) => (b === '10' ? 'toyota-alphard-10' : 'toyota-alphard-20') },
  'Toyota Estima': { default: 'toyota-estima-50-55', body: (b) => (parseInt(b, 10) >= 50 ? 'toyota-estima-50-55' : 'toyota-estima-30-40') },
  'Toyota Sienna': { default: 'toyota-sienna-30', body: (b) => (b === '20' ? 'toyota-sienna-20' : 'toyota-sienna-30') },
  'Toyota Voxy': { default: 'toyota-voxy' },
  'Honda Odyssey': { default: 'honda-odyssey-4', body: (b) => (b === '3' ? 'honda-odyssey-3' : 'honda-odyssey-4') },
  'Honda Elysion': { default: 'honda-elysion', body: (b) => (/prestige/i.test(b || '') ? 'honda-elysion-prestige' : 'honda-elysion') },
  'Nissan Serena': { default: 'nissan-serena' },
  'Nissan Elgrand': { default: 'nissan-elgrand' },
};

/** URL of the photo for a catalogue vehicle (and optional body type), or null when there is none. */
export function vehiclePhotoUrl(vehicleName, bodyType = null) {
  const entry = PHOTOS[vehicleName];
  if (!entry) return null;
  const slug = bodyType && entry.body ? entry.body(String(bodyType)) : entry.default;
  return `/cars/${slug}.webp`;
}
