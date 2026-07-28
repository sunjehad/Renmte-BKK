// Pruefung der Waechter-Schwellen in `admin.html`.
//
// Aufruf:  node tools/waechter_test.mjs
//
// Die Funktionen werden **aus der Seite herausgeloest**, nicht abgeschrieben --
// wer die Schwellen in `admin.html` aendert, aendert damit auch das, was hier
// geprueft wird. Eine Kopie wuerde stillschweigend auseinanderlaufen.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hier = dirname(fileURLToPath(import.meta.url));
const seite = readFileSync(join(hier, '..', 'admin.html'), 'utf-8');

const start = seite.indexOf('function tageSeit(iso)');
const ende = seite.indexOf('\n}', seite.indexOf('if (uhr) uhr.textContent')) + 2;
if (start < 0 || ende < 2) {
  console.error('FEHLER: renderWatch() nicht in admin.html gefunden — wurde sie umbenannt?');
  process.exit(1);
}

// Minimale Attrappe fuer das, was renderWatch anfasst.
const felder = {};
function machElement() {
  const kl = new Set();
  return {
    _v: '', _s: '',
    classList: {
      add: (...c) => c.forEach((x) => kl.add(x)),
      remove: (...c) => c.forEach((x) => kl.delete(x)),
    },
    querySelector(sel) {
      const self = this;
      return {
        set textContent(v) { sel === '.watch-v' ? (self._v = v) : (self._s = v); },
        get textContent() { return sel === '.watch-v' ? self._v : self._s; },
      };
    },
    stufe() { return [...kl].find((c) => ['ok', 'warn', 'alarm'].includes(c)) || 'neutral'; },
  };
}
for (const id of ['watch-last', 'watch-week', 'watch-abandoned', 'watch-clock']) felder[id] = machElement();

let allBookings = [];
const document = { getElementById: (id) => felder[id] || null };
const { renderWatch } = await import(
  'data:text/javascript;base64,' +
  Buffer.from(
    'export function bau(document, hol) {\n' +
    'let allBookings = hol();\n' +
    seite.slice(start, ende).replace('const echte = allBookings', 'allBookings = hol(); const echte = allBookings') +
    '\nreturn { renderWatch };\n}',
  ).toString('base64')
).then((m) => m.bau(document, () => allBookings));

const vorTagen = (n) => new Date(Date.now() - n * 86400000).toISOString();
const vorStunden = (n) => new Date(Date.now() - n * 3600000).toISOString();
const lies = (id) => ({ wert: felder[id]._v, unter: felder[id]._s, stufe: felder[id].stufe() });

let fehler = 0;
function pruef(name, fall, erwartet) {
  allBookings = fall;
  renderWatch();
  const ist = { last: lies('watch-last'), week: lies('watch-week'), ab: lies('watch-abandoned') };
  const ok = Object.entries(erwartet).every(([k, v]) =>
    Object.entries(v).every(([f, w]) => ist[k][f] === w));
  console.log((ok ? '  ok   ' : '  FEHL ') + name + (ok ? '' : '  -> ' + JSON.stringify(ist)));
  if (!ok) fehler++;
}

console.log('Waechter-Schwellen (admin.html):');
pruef('keine Buchung -> Alarm', [], { last: { wert: 'nie', stufe: 'alarm' } });
pruef('heute gebucht -> gruen', [{ id: 1, created_at: vorStunden(2), booking_ref: 'RMB-A' }],
  { last: { wert: 'heute', stufe: 'ok' }, week: { wert: '1', stufe: 'ok' } });
pruef('gestern -> gruen', [{ id: 1, created_at: vorTagen(1) }], { last: { wert: 'gestern', stufe: 'ok' } });
pruef('vor 4 Tagen -> gelb', [{ id: 1, created_at: vorTagen(4) }], { last: { wert: 'vor 4 Tagen', stufe: 'warn' } });
pruef('vor 14 Tagen -> rot', [{ id: 1, created_at: vorTagen(14) }],
  { last: { wert: 'vor 14 Tagen', stufe: 'alarm' }, week: { wert: '0', stufe: 'warn' } });
pruef('Zahlung laeuft noch (30 Min) -> zaehlt nicht',
  [{ id: 1, created_at: vorStunden(0.5), booking_status: 'pending_payment' }], { ab: { wert: '0', stufe: 'ok' } });
pruef('eine abgebrochene Zahlung -> gelb',
  [{ id: 1, created_at: vorTagen(1), booking_status: 'pending_payment' }], { ab: { wert: '1', stufe: 'warn' } });
pruef('drei abgebrochen, nichts bezahlt -> rot',
  [1, 2, 3].map((i) => ({ id: i, created_at: vorTagen(1), booking_status: 'pending_payment' })),
  { ab: { wert: '3', stufe: 'alarm' } });
pruef('drei abgebrochen, aber es wird bezahlt -> nur gelb',
  [...[1, 2, 3].map((i) => ({ id: i, created_at: vorTagen(1), booking_status: 'pending_payment' })),
   { id: 9, created_at: vorTagen(2), booking_status: 'paid' }], { ab: { wert: '3', stufe: 'warn' } });

console.log(fehler ? `\n${fehler} Schwelle(n) verhalten sich nicht wie beschrieben.` : '\nAlle Schwellen in Ordnung.');
process.exit(fehler ? 1 : 0);
