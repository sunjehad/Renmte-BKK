// Mietvertrag fuer die Geraeteausleihe -- die EINE Quelle fuer den Vertragstext.
//
// Benutzt von:
//   rental-agreement.html  der Vertrag selbst (ungezeichnet aus der Buchung,
//                          gezeichnet aus der Tabelle rental_contracts)
//   rental-terms.html      nur die Bedingungen, verlinkt beim Buchen
//   admin.html             Unterschrift bei der Abholung
//
// **Versioniert.** Ein unterschriebener Vertrag speichert die Version, unter
// der er gezeichnet wurde. Wer den Text aendert, legt eine NEUE Version an und
// laesst die alte stehen -- sonst zeigt ein alter Vertrag nachtraeglich
// Bedingungen, die niemand unterschrieben hat.
//
// Stand der Werte (Verspaetung, Kaution, Frist) ist ein Vorschlag vom
// 15.09.2026, von Andy pauschal freigegeben ("mach alles so wie du denkst"),
// **nicht juristisch geprueft**.
//
// Englische Texte (die Kundschaft ist international), deutsche Kommentare.
(function () {
  'use strict';

  const FIRMA = {
    name: 'Rent Me Bangkok',
    adresse: '600/9 B Square Rama 9 – Mengjai, Wang Thonglang, Bangkok 10310',
    email: 'rentmebkk@gmail.com',
    instagram: '@bangkok_rentme',
  };

  const GERAETE = { pocket3: 'DJI Osmo Pocket 3', neo: 'DJI Neo', nano: 'DJI Osmo Nano' };
  const KAUTION = 1000;
  const KULANZ_MINUTEN = 30;
  const VERSPAETUNG_JE_STUNDE = 100;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function baht(n) { return '฿' + Number(n).toLocaleString('en-US'); }

  function datum(iso) {
    if (!iso) return '—';
    return new Date(iso + 'T12:00').toLocaleDateString('en-GB',
      { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function uhr(t) { return t ? String(t).slice(0, 5) : ''; }

  // ── Bedingungen, Version 1 ──────────────────────────────────────────────
  // Jede Klausel: [Ueberschrift, [Absaetze]]. `hatDrohne` blendet die
  // Drohnenklausel nur ein, wenn eine Drohne gemietet ist; die allgemeine
  // Seite (rental-terms.html) zeigt sie immer.
  const VERSIONEN = {
    '1': function (hatDrohne) {
      const k = [
        ['Rental period', [
          'The equipment is picked up and returned at the Rent Me Bangkok studio (address above) on the dates and times stated in this agreement. The renter is responsible for the equipment from pick-up until it has been handed back and checked by our staff.',
        ]],
        ['Rental fee and payment', [
          'The rental fee is the amount shown in the booking. It covers the booked rental days only. If not paid online, it is due in cash at pick-up before the equipment is handed over.',
        ]],
        ['Deposit', [
          `A refundable deposit of ${baht(KAUTION)} is paid in cash at pick-up. It is returned in full when the equipment comes back on time, complete and undamaged. Late fees, repair costs or missing accessories may be deducted from the deposit.`,
        ]],
        ['Identification and personal data', [
          'At pick-up we take a photo of the renter’s ID (passport or Thai ID card) and a photo of the renter. These are kept confidential, used only for this rental and deleted 90 days after the equipment has been returned, unless a claim under this agreement is still open.',
        ]],
        ['Condition at pick-up', [
          'The equipment and accessories are checked together at pick-up and listed in this agreement. By signing, the renter confirms that everything listed was received complete and in working condition. Any existing marks or defects are noted in the agreement.',
        ]],
        ['Use of the equipment', [
          'The renter uses the equipment with care and only for its intended purpose. It may not be lent, sublet or handed to third parties, opened, modified or repaired by the renter. The equipment must be protected from water, sand, dust and extreme heat unless it is designed for such conditions.',
        ]],
      ];
      if (hatDrohne) {
        k.push(['Drones', [
          'The renter flies the drone at their own responsibility and in line with Thai law, including registration and permission rules (CAAT / NBTC) where they apply. Flying over crowds, near airports, government or military sites, or in other restricted areas is not permitted. Fines, confiscation and damage caused by the flight are the renter’s responsibility. A crash counts as damage under this agreement.',
        ]]);
      }
      k.push(
        ['Late return', [
          `A grace period of ${KULANZ_MINUTEN} minutes applies. After that, a late fee of ${baht(VERSPAETUNG_JE_STUNDE)} is charged for each started hour. From the next day on, each additional day is charged at the full daily rate of the rented equipment. If the equipment has not been returned 24 hours after the agreed time and the renter cannot be reached, Rent Me Bangkok may treat it as lost and report it to the police.`,
        ]],
        ['Damage, loss and theft', [
          'The renter pays the cost of repairing any damage that occurs during the rental period. If the equipment or an accessory is lost, stolen or cannot be repaired, the renter pays the current retail price of an equivalent new item in Thailand. A theft must be reported to the police within 24 hours and the police report handed to Rent Me Bangkok.',
        ]],
        ['Cancellation', [
          'Bookings can be cancelled free of charge up to 24 hours before the pick-up time.',
        ]],
        ['Footage and data', [
          'The renter is responsible for saving their own footage. Memory cards and internal storage are erased after return. Rent Me Bangkok is not liable for lost recordings or data, or for indirect losses arising from a defect or failure of the equipment.',
        ]],
        ['Governing law', [
          'This agreement is governed by the laws of the Kingdom of Thailand. If a provision is invalid, the remaining provisions stay in effect.',
        ]],
      );
      return k;
    },
  };

  const VERSION = '1';

  function bedingungenHtml(version, hatDrohne) {
    const klauseln = (VERSIONEN[version] || VERSIONEN[VERSION])(hatDrohne);
    return '<ol class="rv-klauseln">' + klauseln.map(([titel, absaetze]) =>
      `<li><h3>${esc(titel)}</h3>${absaetze.map(a => `<p>${esc(a)}</p>`).join('')}</li>`
    ).join('') + '</ol>';
  }

  function geraeteNamen(items) {
    return (items || []).map(i => GERAETE[i] || i);
  }

  // `b`  Buchungsfelder (booking_ref, guest_*, equipment_*, start_time,
  //      end_time, rental_days, equipment_items, total_price, booking_status)
  // `v`  Vertragsdaten aus rental_contracts.data -- oder null (ungezeichnet)
  function vertragHtml(b, v) {
    const version = (v && v.version) || VERSION;
    const items = b.equipment_items || [];
    const hatDrohne = items.includes('neo');
    const seriennr = (v && v.seriennummern) || {};
    const zeile = (label, wert) =>
      `<tr><th>${esc(label)}</th><td>${wert}</td></tr>`;
    const leer = '<span class="rv-leer"></span>';

    const geraeteZeilen = items.map(i => `
      <tr><td>${esc(GERAETE[i] || i)}</td>
          <td>${seriennr[i] ? esc(seriennr[i]) : leer}</td></tr>`).join('');

    const bezahlt = ['paid', 'confirmed'].includes(b.booking_status)
      ? 'paid online' : 'due in cash at pick-up';

    const unterschrift = (bild, name, rolle) => `
      <div class="rv-sign">
        <div class="rv-sign-feld">${bild ? `<img src="${esc(bild)}" alt="Signature">` : ''}</div>
        <div class="rv-sign-name">${esc(name || '')}</div>
        <div class="rv-sign-rolle">${esc(rolle)}</div>
      </div>`;

    return `
<article class="rv">
  <header class="rv-kopf">
    <div class="rv-logo">RENT<span>ME</span> BANGKOK</div>
    <div class="rv-firma">${esc(FIRMA.adresse)}<br>${esc(FIRMA.email)} · Instagram ${esc(FIRMA.instagram)}</div>
  </header>

  <h1>Equipment Rental Agreement</h1>
  <div class="rv-meta">Booking ${esc(b.booking_ref || '—')} · Terms version ${esc(version)}${v && v.signed_at ? ' · Signed ' + esc(new Date(v.signed_at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })) : ' · <strong>Not yet signed</strong> — signed at pick-up'}</div>

  <h2>1. Parties</h2>
  <table class="rv-tab">
    ${zeile('Lessor', esc(FIRMA.name))}
    ${zeile('Renter', esc(b.guest_name || '—'))}
    ${zeile('Phone', esc(b.guest_phone || '—'))}
    ${zeile('Email', esc(b.guest_email || '—'))}
    ${zeile('ID document', v && v.ausweis_nummer ? esc((v.ausweis_art || '') + ' ' + v.ausweis_nummer) : leer)}
  </table>

  <h2>2. Equipment</h2>
  <table class="rv-tab rv-geraete">
    <tr><th>Item</th><th>Serial number</th></tr>
    ${geraeteZeilen || '<tr><td colspan="2">—</td></tr>'}
  </table>
  <table class="rv-tab">
    ${zeile('Accessories / condition', v && v.zustand ? esc(v.zustand) : leer)}
  </table>

  <h2>3. Rental period and price</h2>
  <table class="rv-tab">
    ${zeile('Pick-up', esc(datum(b.equipment_start_date)) + (uhr(b.start_time) ? ', ' + esc(uhr(b.start_time)) : ''))}
    ${zeile('Return', esc(datum(b.equipment_end_date)) + (uhr(b.end_time) ? ', by ' + esc(uhr(b.end_time)) : ''))}
    ${zeile('Rental days', esc(b.rental_days || '—'))}
    ${zeile('Rental fee', b.total_price ? esc(baht(b.total_price)) + ' — ' + esc(bezahlt) : '—')}
    ${zeile('Deposit', esc(baht(KAUTION)) + ' cash' + (v ? (v.kaution_erhalten ? ' — received' : ' — <strong>not received</strong>') : ' — at pick-up'))}
  </table>

  <h2>4. Terms and conditions</h2>
  ${bedingungenHtml(version, hatDrohne)}

  <h2>5. Signatures</h2>
  <p class="rv-klein">By signing, the renter confirms that they have read and accept this agreement and received the equipment listed above complete and in working condition.</p>
  <div class="rv-signs">
    ${unterschrift(v && v.unterschrift_kunde, b.guest_name, 'Renter')}
    ${unterschrift(v && v.unterschrift_personal, v && v.personal_name, 'For Rent Me Bangkok')}
  </div>
  ${v && (v.foto_ausweis || v.foto_kunde) ? `
  <div class="rv-fotos">
    ${v.foto_ausweis ? `<figure><img src="${esc(v.foto_ausweis)}" alt="ID"><figcaption>ID document</figcaption></figure>` : ''}
    ${v.foto_kunde ? `<figure><img src="${esc(v.foto_kunde)}" alt="Renter"><figcaption>Renter at pick-up</figcaption></figure>` : ''}
  </div>` : ''}
</article>`;
  }

  // Druckfaehiges Aussehen, fuer beide Seiten gleich. Hell, weil es gedruckt
  // bzw. als PDF gespeichert wird -- die dunkle Seitenfarbe gehoert nicht aufs Papier.
  const CSS = `
.rv{background:#fff;color:#111;font:13px/1.55 Inter,Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px 44px}
.rv h1{font:28px 'Bebas Neue',Impact,sans-serif;letter-spacing:.04em;margin:18px 0 2px}
.rv h2{font:17px 'Bebas Neue',Impact,sans-serif;letter-spacing:.05em;margin:22px 0 6px;border-bottom:2px solid #e63946;padding-bottom:2px}
.rv h3{font-size:13px;margin:0 0 2px}
.rv p{margin:0 0 6px}
.rv-kopf{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}
.rv-logo{font:26px 'Bebas Neue',Impact,sans-serif;letter-spacing:.05em}
.rv-logo span{color:#e63946}
.rv-firma{font-size:11px;color:#555;text-align:right}
.rv-meta{font-size:11px;color:#555}
.rv-tab{width:100%;border-collapse:collapse;margin-bottom:6px}
.rv-tab th,.rv-tab td{border:1px solid #ddd;padding:6px 9px;text-align:left;vertical-align:top}
.rv-tab th{width:32%;background:#f5f5f7;font-weight:600}
.rv-geraete th{width:auto}
.rv-leer{display:inline-block;min-width:60%;border-bottom:1px dotted #999;height:1em}
.rv-klauseln{padding-left:20px;margin:0}
.rv-klauseln li{margin-bottom:8px}
.rv-klein{font-size:12px;color:#333}
.rv-signs{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:14px}
.rv-sign-feld{height:90px;border-bottom:1px solid #111;display:flex;align-items:flex-end}
.rv-sign-feld img{max-height:86px;max-width:100%}
.rv-sign-name{font-weight:600;margin-top:4px}
.rv-sign-rolle{font-size:11px;color:#555}
.rv-fotos{display:flex;gap:16px;margin-top:20px;flex-wrap:wrap;break-inside:avoid}
.rv-fotos figure{margin:0;flex:1;min-width:200px}
.rv-fotos img{width:100%;max-height:260px;object-fit:contain;border:1px solid #ddd}
.rv-fotos figcaption{font-size:11px;color:#555}
@media (max-width:600px){.rv{padding:24px 16px}.rv-signs{grid-template-columns:1fr}.rv-firma{text-align:left}}
@media print{.rv{padding:0;max-width:none}.rv h2{break-after:avoid}.rv-signs{break-inside:avoid}}
`;

  window.RentMeVertrag = {
    VERSION, FIRMA, GERAETE, KAUTION,
    vertragHtml, bedingungenHtml, geraeteNamen, CSS, esc,
  };
})();
