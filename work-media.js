/* ══════════════════════════════════════════════════════════════════════
   RentMe — die Arbeitsproben       angelegt 2026-08-20

   Eine Liste, zwei Seiten: die Schiene auf der Startseite (index.html) und
   die volle Galerie (work.html) lesen beide von hier. Wer ein Reel ergaenzt
   oder herausnimmt, aendert genau diese Datei.

   ── Wo die Dateien liegen ───────────────────────────────────────────────
   MEDIA ist die einzige Stelle mit dem Ablageort. Die Videos gehoeren NICHT
   ins Git-Repo -- 18 Reels sind 23 MB, und Vercel schleppt bei jedem Deploy
   alles mit. Sie liegen im oeffentlichen Supabase-Bucket "work" desselben
   Projekts, das die Buchungen haelt.

   Zum oertlichen Pruefen steht MEDIA auf 'images/work/'; dieser Ordner ist
   in .gitignore und existiert nur auf dem Entwicklungsrechner.

   ── Was hier NICHT hineingehoert ────────────────────────────────────────
   Reels mit Preisen im Bild. Die A-Reihe a01-a06 und die acht Reels vom
   06.08. tragen die Aktionspreise samt "bis 31. August" eingebrannt; ab dem
   1. September behaupten sie auf der Firmenseite Zahlen, die nicht mehr
   gelten (siehe docs/todo.md, T-13). Alles hier Gelistete ist preisfrei.
   ══════════════════════════════════════════════════════════════════════ */

/* Umstellen auf Supabase, sobald der Bucket steht:
   'https://nghsyxwhczvwaorssgoh.supabase.co/storage/v1/object/public/work/' */
window.MEDIA = 'images/work/';

/* id     — Dateiname ohne Endung, <id>.mp4 und <id>.jpg
   t      — der Hook, so wie er im Bild steht
   lab    — kurze Beschriftung auf der Kachel (nie den Hook wiederholen)
   kind   — Kategorie, steuert die Baender auf work.html
   rail   — steht diese Kachel auch in der Schiene der Startseite?           */
window.REELS = [

  /* ── Das Podcast-Studio ──────────────────────────────────────────────── */
  {id:'b11', kind:'studio', rail:1, lab:'The room, undressed',
   t:'Nothing here is dressed up.',
   d:'Blue wall, soft light, everything already rigged. This is the room as you will get it.'},

  {id:'b09', kind:'studio', rail:1, lab:'Light & colour',
   t:'The room changes colour.',
   d:'The lighting is part of the booking, not an extra you rent somewhere else.'},

  {id:'b12', kind:'studio', rail:1, lab:'One guest, full set',
   t:'One guest. Full set.',
   d:'You do not need a crew to look like you have one.'},

  {id:'b10', kind:'studio', rail:1, lab:'Live monitoring',
   t:'You don’t wait for the dailies.',
   d:'The frame is on set with you. Live monitoring on every booking.'},

  {id:'b13', kind:'studio', rail:0, lab:'Everything else',
   t:'You bring the conversation.',
   d:'Cameras, lights, mics, the edit — we bring the rest.'},

  {id:'n05', kind:'studio', rail:0, lab:'What’s in the room',
   t:'Ring light. Live monitor. Lounge seating.',
   d:'It is already in the room. You bring the conversation.'},

  {id:'n06', kind:'studio', rail:0, lab:'Four at the table',
   t:'Four.',
   d:'Four guests at the recording table, plus lounge seating for everyone else. Built for a full panel, not a solo mic.'},

  {id:'n01', kind:'studio', rail:0, lab:'Bring your team',
   t:'Can I bring my team?',
   d:'Four at the recording table, more on the lounge seating. Co-hosts, guests, your own crew.'},

  /* ── Was danach passiert: Schnitt und Ausgabe ────────────────────────── */
  {id:'a07', kind:'post', rail:1, lab:'Graded, mixed, mastered',
   t:'Graded. Mixed. Mastered.',
   d:'Not just exported. Turn it up — that is the whole point.'},

  {id:'a08', kind:'post', rail:1, lab:'Both formats',
   t:'Shoot it once, post it everywhere.',
   d:'16:9 and 9:16 from the same session. YouTube, Spotify, Instagram, TikTok, Facebook.'},

  {id:'n08', kind:'post', rail:0, lab:'Publish-ready',
   t:'Walk in with ideas.',
   d:'Walk out with a publish-ready episode.'},

  {id:'n03', kind:'post', rail:0, lab:'Monthly package',
   t:'Four sessions a month.',
   d:'Up to two hours each, a videographer on set, professional cameras and mics, and the full edit — colour, sound design, titles.'},

  {id:'n10', kind:'post', rail:0, lab:'What you don’t need',
   t:'No lights. No mics. No editor.',
   d:'Nothing to rent, buy or find. Just pick a date.'},

  /* ── Fotostudio und Auftragsdreh ─────────────────────────────────────── */
  {id:'c14', kind:'photo', rail:1, lab:'Campaign shoot',
   t:'Most people rent the room.',
   d:'We also shoot the campaign — strobes, softboxes, seamless backdrop, and a crew that runs the day, tethered so you see every frame as it lands.'},

  /* ── Praktisches: Weg, Ablauf, Sprache ───────────────────────────────── */
  {id:'n02', kind:'info', rail:0, lab:'Where we are',
   t:'Makkasan.',
   d:'A few minutes from Asoke BTS and Phetchaburi MRT, easy from anywhere in the city.'},

  {id:'n04', kind:'info', rail:0, lab:'How booking works',
   t:'Booking takes one message.',
   d:'DM us, tell us the service, date and time — we confirm availability within a few hours.'},

  {id:'n07', kind:'info', rail:0, lab:'First time?',
   t:'“I’ve never recorded a podcast.”',
   d:'Neither had most of the people who sat here first. You just talk, we handle the rest.'},

  {id:'n09', kind:'info', rail:0, lab:'ภาษาไทย',
   t:'เข้ามาพร้อมไอเดีย',
   d:'ถ่ายทำและตัดต่อพอดแคสต์ · กรุงเทพฯ'}
];

/* Die Baender auf work.html, in dieser Reihenfolge. */
window.BAENDER = [
  {k:'studio', h:'The Podcast Studio',  p:'One to three cameras, lighting set, sound at broadcast level — filmed in our own room in Makkasan.'},
  {k:'post',   h:'Edit & Delivery',     p:'What happens after the shoot: colour, sound, titles, and both formats from the same session.'},
  {k:'photo',  h:'Photo & Campaign',    p:'The photo studio, and campaign shoots we run end to end.'},
  {k:'info',   h:'Good to Know',        p:'Where we are, how booking works, and the answer to the question everyone asks first.'}
];

/* ══════════════════════════════════════════════════════════════════════
   Kachel, Leuchtkasten und Schiene -- von beiden Seiten benutzt.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  var PLAY = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">'
           + '<polygon points="6 3 20 12 6 21"/></svg>';

  /* Eine Kachel. Das Video wird erst geladen, wenn jemand darauf zeigt --
     sonst zoege die Startseite 23 MB hinter sich her. */
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
      '<video src="' + window.MEDIA + r.id + '.mp4" poster="' + window.MEDIA + r.id + '.jpg"'
      + ' autoplay loop playsinline controls></video>';
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
