# Тест-план: Проценттер (Settings)

## Правило валидации
- **Менеджер %** — отдельно, 0..100. Не входит в сумму.
- **Шеберлер %** и **Иесі %** — в сумме должны быть **100** (каждый 0..100).

## Автоматический тест (backend)
```bash
cd backend
node src/services/settingsPercent.test.js
```
Ожидается: все 3 теста OK.

## Ручная проверка

### 1. Должно проходить
- Менеджер: 8, Шеберлер: 60, Иесі: 40  
- Сохранение в Баптаулар должно успешно сохраниться.  
- В UI: «Шеберлер + Иесі = 100» не показывается (всё зелёно).

### 2. Должна быть ошибка (90)
- Менеджер: 8, Шеберлер: 50, Иесі: 40  
- В UI: красная подсказка «Шеберлер + Иесі = 100 болуы керек (қазір 90)».  
- Кнопка «Сақтау» неактивна (или при отправке API вернёт ошибку).

### 3. Должна быть ошибка (110)
- Менеджер: 8, Шеберлер: 60, Иесі: 50  
- В UI: «Шеберлер + Иесі = 100 болуы керек (қазір 110)».  
- Сохранение заблокировано.

## API (curl, при запущенном бэкенде и с токеном owner)
```bash
# Успех (masters+owner=100)
curl -s -X PATCH http://localhost:3001/api/settings \
  -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"keyValues":{"manager_percent":"8","masters_percent":"60","owner_percent":"40"}}'

# Ошибка (90)
curl -s -X PATCH http://localhost:3001/api/settings \
  -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"keyValues":{"manager_percent":"8","masters_percent":"50","owner_percent":"40"}}'
# Ожидается: 400 и сообщение про "Шеберлер + Иесі ... 100"
```
