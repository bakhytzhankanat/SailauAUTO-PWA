// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: download;

// Installs or updates the "Sailau Widget" script from GitHub. Run it again any time to update.
const URL = 'https://raw.githubusercontent.com/bakhytzhankanat/SailauAUTO-PWA/main/widgets/scriptable/Sailau%20Widget.js';
const NAME = 'Sailau Widget';

const req = new Request(URL);
const code = await req.loadString();
const a = new Alert();
if (!req.response || req.response.statusCode !== 200 || !code.includes('Sailau Auto')) {
  a.title = 'Sailau Widget';
  a.message = `Жүктеу сәтсіз / Не удалось скачать (${req.response ? req.response.statusCode : 'no network'})`;
  a.addAction('OK');
  await a.presentAlert();
} else {
  let fm = FileManager.local();
  try { fm = FileManager.iCloud(); } catch (e) {}
  const path = fm.joinPath(fm.documentsDirectory(), `${NAME}.js`);
  fm.writeString(path, code);
  a.title = 'Sailau Widget ✓';
  a.message = 'Орнатылды. Енді «Sailau Widget» скриптін ашып, жүйеге кіріңіз.\n\nУстановлено. Откройте скрипт «Sailau Widget» и войдите.';
  a.addAction('OK');
  await a.presentAlert();
}
Script.complete();
