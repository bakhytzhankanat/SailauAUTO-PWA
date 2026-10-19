import test from 'node:test';
import assert from 'node:assert/strict';
import { vehiclePhotoUrl } from './vehiclePhotos.js';

test('picks the photo of the chosen body', () => {
  assert.equal(vehiclePhotoUrl('Toyota Alphard', '10'), '/cars/toyota-alphard-10.webp');
  assert.equal(vehiclePhotoUrl('Toyota Estima', '33'), '/cars/toyota-estima-30-40.webp');
  assert.equal(vehiclePhotoUrl('Toyota Estima', '52'), '/cars/toyota-estima-50-55.webp');
  assert.equal(vehiclePhotoUrl('Toyota Estima', '30-40'), '/cars/toyota-estima-30-40.webp');
  assert.equal(vehiclePhotoUrl('Toyota Estima', '50-55'), '/cars/toyota-estima-50-55.webp');
  assert.equal(vehiclePhotoUrl('Honda Elysion', 'Elysion Prestige'), '/cars/honda-elysion-prestige.webp');
});

test('falls back to the default photo, or null for unknown vehicles', () => {
  assert.equal(vehiclePhotoUrl('Toyota Alphard'), '/cars/toyota-alphard-20.webp');
  assert.equal(vehiclePhotoUrl('Nissan Serena', 'Serena'), '/cars/nissan-serena.webp');
  assert.equal(vehiclePhotoUrl('Toyota Camry'), null);
});
