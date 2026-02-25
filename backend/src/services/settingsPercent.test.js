/**
 * Быстрый тест валидации процентов (Шеберлер + Иесі = 100, Менеджер отдельно).
 * Запуск: node src/services/settingsPercent.test.js
 */
import { validateMastersOwnerSum } from './settingsService.js';

const tests = [
  { name: 'manager=8, masters=60, owner=40 → OK', m: 8, s: 60, o: 40, expectError: false },
  { name: 'manager=8, masters=50, owner=40 → error (90)', m: 8, s: 50, o: 40, expectError: true },
  { name: 'manager=8, masters=60, owner=50 → error (110)', m: 8, s: 60, o: 50, expectError: true },
];

let passed = 0;
for (const t of tests) {
  try {
    validateMastersOwnerSum(t.s, t.o);
    if (t.expectError) {
      console.log(`FAIL: ${t.name} — ожидалась ошибка`);
    } else {
      console.log(`OK: ${t.name}`);
      passed++;
    }
  } catch (e) {
    if (!t.expectError) {
      console.log(`FAIL: ${t.name} — ${e.message}`);
    } else {
      console.log(`OK: ${t.name} (ошибка как ожидалось)`);
      passed++;
    }
  }
}
console.log(`\n${passed}/${tests.length} тестов пройдено`);
process.exit(passed === tests.length ? 0 : 1);
