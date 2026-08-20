/* ══════════════════════════════════════════════════════════════════════
   RentMe — die Arbeitsproben       angelegt 2026-08-20

   Eine Liste, zwei Seiten: die Schiene auf der Startseite (index.html) und
   die volle Galerie (work.html) lesen beide von hier. Wer ein Reel ergaenzt
   oder herausnimmt, aendert genau diese Datei.

   ── Wo die Dateien liegen ───────────────────────────────────────────────
   MEDIA ist die einzige Stelle mit dem Ablageort. Die Videos gehoeren NICHT
   ins Git-Repo -- 18 Reels sind rund 25 MB, und Vercel schleppt bei jedem Deploy
   alles mit. Sie liegen im oeffentlichen Supabase-Bucket "work" desselben
   Projekts, das die Buchungen haelt.

   Erzeugt werden die Dateien mit tools/reels-web-fassung.py (nach
   images/work/, in .gitignore), hochgeladen mit tools/reels-hochladen.sh.

   ⚠ Der Bucket liefert `cache-control: no-cache`. Der CLI 2.108 nimmt den
   Schalter --cache-control entgegen, setzt ihn aber nicht -- geprueft am
   20.08. mit "max-age=604800" und "604800". Folge: wiederkehrende Besucher
   laden erneut. Bei 5 GB Freikontingent im Monat unkritisch, aber es steht
   hier, damit es niemand zweimal untersucht.

   ── Zwei Eintraege mit Vorbehalt ────────────────────────────────────────
   `alt08` traegt Preise im Bild ("LAUNCH OFFER 50% OFF · FROM B1,500 PER
   HOUR") und ist ab dem 1. September falsch -- vor dem 31.08. austauschen,
   zusammen mit der Preisanhebung aus docs/todo.md T-13.
   `jay1` und `jay2` sind Kundenmaterial und brauchen Jays Freigabe.
   Beide Vorbehalte stehen auch an der jeweiligen Zeile.
   ══════════════════════════════════════════════════════════════════════ */

/* Oeffentlicher Supabase-Bucket "work", angelegt am 20.08.2026.
   Zum oertlichen Pruefen ohne Netz: auf 'images/work/' zurueckstellen. */
window.MEDIA = 'https://nghsyxwhczvwaorssgoh.supabase.co/storage/v1/object/public/work/';

/* Andys Auswahl vom 20.08.2026, getroffen ueber alle 63 fertigen Clips.
   Die Herkunft jeder Datei steht in tools/reels-auswahl.json -- diese Liste
   hier ist nur die Anzeige-Seite davon.

   id     Dateiname ohne Endung, <id>.mp4 und <id>.jpg
   t      der Hook, so wie er im Bild steht
   lab    kurze Beschriftung auf der Kachel (nie den Hook wiederholen)
   kind   Kategorie, steuert die Baender auf work.html
   rail   steht diese Kachel auch in der Schiene der Startseite?
          Sechs Stueck, je ein Dienst. Kundenmaterial bleibt dort draussen,
          solange Jays Freigabe fehlt.                                       */
window.REELS = [
  {id:'n02', kind:'info', lab:'Where we are',
   t:'Makkasan.',
   d:'Makkasan Station area — minutes from Asoke BTS and Phetchaburi MRT.'},
  {id:'n07', kind:'info', lab:'First time?',
   t:'“I’ve never recorded a podcast.”',
   d:'Neither had most of the people who sat here first. You just talk, we handle the rest.'},
  {id:'n08', kind:'schnitt', lab:'Publish-ready',
   t:'Walk in with ideas.',
   d:'Walk in with ideas, walk out with a publish-ready episode.'},
  {id:'n09', kind:'info', lab:'ภาษาไทย',
   t:'เข้ามาพร้อมไอเดีย',
   d:'ถ่ายทำและตัดต่อพอดแคสต์ · กรุงเทพฯ'},
  {id:'n10', rail:1, kind:'schnitt', lab:'What you don’t need',
   t:'No lights. No mics. No editor.',
   d:'No lights to rent, no mics to buy, no editor to find. Just pick a date.'},
  {id:'b13', kind:'studio', lab:'Everything else',
   t:'You bring the conversation.',
   d:'Cameras, lights, mics, the edit — we bring the rest.'},
  {id:'c14', rail:1, kind:'foto', lab:'Campaign shoot',
   t:'Most people rent the room.',
   d:'Strobes, softboxes, seamless backdrop — and a crew that runs the day, tethered so you see every frame as it lands.'},
  {id:'j01', rail:1, kind:'studio', lab:'The room, ready',
   t:'Most studios rent you a room.',
   d:'Already lit, wired and sound-treated. Walk in, sit down, record.'},
  {id:'j03', rail:1, kind:'geraet', lab:'Rent the drone',
   t:'A drone for one weekend…',
   d:'DJI Neo, Osmo Pocket 3, Osmo Nano — charged, current, by the day.'},
  {id:'j04', rail:1, kind:'studio', lab:'Real sessions',
   t:'This isn’t a render.',
   d:'No stock footage. Every shot is a session that actually happened here.'},
  {id:'j05', kind:'foto', lab:'More than podcasts',
   t:'Everyone books it for a podcast.',
   d:'Product shots, brand films, UGC, interviews — same room, same lights.'},
  {id:'j06', kind:'studio', lab:'Zero setup time',
   t:'The two hours nobody posts about.',
   d:'Renting lights, carrying stands, rigging, testing. Here that is zero minutes — it is already hanging.'},
  {id:'dv01', rail:1, kind:'drohne', lab:'We fly it',
   t:'You don’t fly, we do',
   d:'Venues, events and sites from the air. Flown by us, not bought as stock.'},
  {id:'dk06', kind:'drohne', lab:'Shot on a DJI Neo',
   t:'Shot on a DJI Neo',
   d:'Authorised DJI rental — the same drone we fly ourselves.'},
  {id:'alt08', kind:'schnitt', lab:'Made to be watched',
   t:'Content people actually watch.',
   d:'Long conversations, cut into something people actually finish.'},   /* ⚠ Preise im Bild, Verfallsdatum 31.08. — docs/todo.md T-13 */
  {id:'werbEN', kind:'werbung', lab:'What you send us',
   t:'What you send us.',
   d:'Send us the raw day — we send back the cut.'},
  {id:'jay1', kind:'kunde', lab:'Jay — episode cut',
   t:'From 40k to 9k.',
   d:'An episode we shot and cut for a client.'},   /* ⚠ Kundenmaterial — nur mit Freigabe des Kunden */
  {id:'jay2', kind:'kunde', lab:'Jay — branding',
   t:'Branding-Einschub',
   d:'Branding worked into the running episode.'},   /* ⚠ Kundenmaterial — nur mit Freigabe des Kunden */
];

/* Die Baender auf work.html, in dieser Reihenfolge. Ein Band ohne
   Kacheln erscheint gar nicht erst. */
window.BAENDER = [
  {k:'studio', h:'The Podcast Studio',
   p:'One to three cameras, lighting set, sound at broadcast level — filmed in our own room in Makkasan.'},
  {k:'schnitt', h:'Edit & Delivery',
   p:'What happens after the shoot: colour, sound, titles, and both formats from the same session.'},
  {k:'foto', h:'Photo & Campaign',
   p:'The photo studio, and campaign shoots we run end to end.'},
  {k:'drohne', h:'Aerial',
   p:'Venues, events and sites from the air — flown by us, not stock.'},
  {k:'geraet', h:'Gear Rental',
   p:'DJI cameras and drones, charged and current.'},
  {k:'kunde', h:'Client Work',
   p:'Full episodes for clients — shoot, edit, graphics, delivery.'},
  {k:'info', h:'Good to Know',
   p:'Where we are, how booking works, and the question everyone asks first.'},
  {k:'werbung', h:'Spots',
   p:'Our own ads.'},
];

/* ══════════════════════════════════════════════════════════════════════
   Kachel, Leuchtkasten und Schiene -- von beiden Seiten benutzt.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  var PLAY = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">'
           + '<polygon points="6 3 20 12 6 21"/></svg>';

  /* Eine Kachel. Das Video wird erst geladen, wenn jemand darauf zeigt --
     sonst zoege die Startseite alle Reels auf einmal hinter sich her. */
  window.reelKachel = function(r){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'reel';
    b.dataset.id = r.id;
    b.setAttribute('aria-label', r.t + ' — play video');
    b.innerHTML =
      '<img src="' + window.MEDIA + r.id + '.jpg" alt="" loading="lazy" decoding="async">' +
      '<video muted loop playsinline preload="none"></video>' +
      '<span class="reel-veil"></span>' +
      '<span class="reel-play">' + PLAY + '</span>' +
      '<span class="reel-meta"><b>' + r.lab + '</b></span>';

    var v = b.querySelector('video');
    var an = function(){
      if (!v.getAttribute('src')) v.setAttribute('src', window.MEDIA + r.id + '.mp4');
      b.classList.add('laeuft');
      var p = v.play();
      if (p && p.catch) p.catch(function(){});
    };
    var aus = function(){ b.classList.remove('laeuft'); v.pause(); };

    /* Auf dem Handy gibt es kein Ueberfahren -- dort oeffnet der Tipp direkt. */
    if (window.matchMedia('(hover:hover)').matches){
      b.addEventListener('mouseenter', an);
      b.addEventListener('mouseleave', aus);
      b.addEventListener('focus', an);
      b.addEventListener('blur', aus);
    }
    b.addEventListener('click', function(){ window.reelOeffnen(r); });
    return b;
  };

  /* ── Leuchtkasten ───────────────────────────────────────────────────── */
  var kasten = null, vorher = null;

  function bauen(){
    if (kasten) return kasten;
    kasten = document.createElement('div');
    kasten.className = 'reel-box';
    kasten.hidden = true;
    kasten.innerHTML =
      '<button class="reel-box-zu" aria-label="Close">'
      + '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">'
      + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
      + '<div class="reel-box-inner">'
      +   '<div class="reel-box-media"></div>'
      +   '<div class="reel-box-txt">'
      +     '<p class="k"></p><h3></h3><p class="d"></p>'
      +     '<a class="reel-box-cta" href="booking.html">Book the studio</a>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(kasten);

    kasten.querySelector('.reel-box-zu').addEventListener('click', window.reelSchliessen);
    kasten.addEventListener('click', function(e){ if (e.target === kasten) window.reelSchliessen(); });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && !kasten.hidden) window.reelSchliessen();
    });
    return kasten;
  }

  window.reelOeffnen = function(r){
    var k = bauen();
    vorher = document.activeElement;
    k.querySelector('.reel-box-media').innerHTML =
      /* muted, sonst blockiert der Browser das Autoplay und der Kasten zeigt
         ein Standbild mit Play-Knopf. Die Reels sind ohnehin so gebaut, dass
         sie stumm funktionieren -- der Ton ist ein Bett, kein Traeger.
         Ueber die Bedienleiste laesst er sich einschalten. */
      '<video src="' + window.MEDIA + r.id + '.mp4" poster="' + window.MEDIA + r.id + '.jpg"'
      + ' autoplay muted loop playsinline controls></video>';
    k.querySelector('.k').textContent  = r.lab;
    k.querySelector('h3').textContent  = r.t;
    k.querySelector('.d').textContent  = r.d;
    k.hidden = false;
    document.body.style.overflow = 'hidden';
    k.querySelector('.reel-box-zu').focus();
  };

  window.reelSchliessen = function(){
    if (!kasten || kasten.hidden) return;
    kasten.hidden = true;
    kasten.querySelector('.reel-box-media').innerHTML = '';
    document.body.style.overflow = '';
    if (vorher && vorher.focus) vorher.focus();
  };
})();
