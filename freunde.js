// Freunde-System: Freunde suchen/anfragen/bestätigen und zu einer Partie herausfordern.
// Zwei Teile:
//   1) Seitenweite Benachrichtigung (läuft auf JEDER Seite, die dieses Skript lädt):
//      zeigt eingehende Herausforderungen als Einblendung, legt bei Annahme die Partie an
//      und leitet beide Spieler per ?partie=… in die bestehende Online-Mechanik (online.js).
//   2) Seitenlogik der Freunde-Seite (nur wenn #freundeSeite vorhanden ist).
// Nutzt window.DB (supabase.js). Braucht die Tabellen `freunde`/`herausforderungen` (siehe SETUP.md).
(function () {
  'use strict';
  const DB = window.DB;
  const client = DB && DB.client;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Spiel-Infos lokal halten, damit das Skript auf jeder Seite ohne games-registry.js auskommt.
  // Ein neues Spiel hier ebenfalls eintragen (Name, Seite, Farbbezeichnungen).
  const SPIELE_INFO = {
    schach: { name: 'Schach',       href: 'schach.html', farben: { w: 'Weiß', b: 'Schwarz' } },
    dame:   { name: 'Dame',         href: 'dame.html',   farben: { w: 'Weiß', b: 'Schwarz' } },
    muehle: { name: 'Mühle',        href: 'muehle.html', farben: { w: 'Weiß', b: 'Schwarz' } },
    vier:   { name: 'Vier gewinnt', href: 'vier.html',   farben: { w: 'Rot',  b: 'Gelb' } }
  };
  const spielName = id => (SPIELE_INFO[id] ? SPIELE_INFO[id].name : id);
  const spielHref = id => (SPIELE_INFO[id] ? SPIELE_INFO[id].href : 'index.html');

  let me = null;   // eingeloggter Nutzer

  // ===================================================================
  //  Partie aus einer angenommenen Herausforderung erzeugen (beide IDs
  //  gesetzt → bestehendes joinPartie() in online.js übernimmt ab Link).
  // ===================================================================
  async function partieAusHf(hf) {
    const weiss  = hf.von_farbe === 'w' ? hf.von_id : hf.an_id;
    const schwarz = hf.von_farbe === 'w' ? hf.an_id : hf.von_id;
    const { data, error } = await client.from('partien')
      .insert({ spiel: hf.spiel, weiss_id: weiss, schwarz_id: schwarz, fen: 'start', zuege: [], am_zug: 'w', status: 'laeuft' })
      .select().single();
    if (error || !data) return null;
    await client.from('herausforderungen').update({ status: 'angenommen', partie_id: data.id }).eq('id', hf.id);
    return data.id;
  }

  async function herausforderungAnnehmen(hf) {
    const pid = await partieAusHf(hf);
    if (pid) location.href = spielHref(hf.spiel) + '?partie=' + pid;
  }
  async function herausforderungAblehnen(hf) {
    await client.from('herausforderungen').update({ status: 'abgelehnt' }).eq('id', hf.id);
  }

  // Zu einer (angenommenen) Partie wechseln – aber nie in einer Schleife:
  // nicht, wenn wir schon in dieser Partie sind oder sie diese Sitzung schon geöffnet wurde.
  function geheZurPartie(hf) {
    if (!hf || !hf.partie_id) return;
    try {
      if (new URLSearchParams(location.search).get('partie') === hf.partie_id) return;
      const k = 'hf_auf_' + hf.id;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    } catch (e) {
      if (new URLSearchParams(location.search).get('partie') === hf.partie_id) return;
    }
    location.href = spielHref(hf.spiel) + '?partie=' + hf.partie_id;
  }

  // ===================================================================
  //  Teil 1: Seitenweite Benachrichtigung (Toasts)
  // ===================================================================
  const gezeigt = new Set();   // bereits eingeblendete Herausforderungs-IDs

  function toastContainer() {
    let box = $('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      document.body.appendChild(box);
    }
    return box;
  }

  async function zeigeHf(hf) {
    if (gezeigt.has(hf.id)) return;
    gezeigt.add(hf.id);
    const name = (await DB.anzeigename(hf.von_id)) || 'Jemand';
    const meineFarbe = hf.von_farbe === 'w' ? 'b' : 'w';
    const farbtext = (SPIELE_INFO[hf.spiel] ? SPIELE_INFO[hf.spiel].farben[meineFarbe] : (meineFarbe === 'w' ? 'Weiß' : 'Schwarz'));
    const el = document.createElement('div');
    el.className = 'einladung';
    el.innerHTML =
      '<p><b>' + esc(name) + '</b> fordert dich zu <b>' + esc(spielName(hf.spiel)) + '</b> heraus.' +
      '<br><small>Du spielst ' + esc(farbtext) + '.</small></p>' +
      '<div class="row"><button class="primary ja">Annehmen</button><button class="nein">Ablehnen</button></div>';
    el.querySelector('.ja').onclick = () => { el.remove(); herausforderungAnnehmen(hf); };
    el.querySelector('.nein').onclick = () => { el.remove(); herausforderungAblehnen(hf); };
    toastContainer().appendChild(el);
  }

  function entferneToast(hfId) {
    gezeigt.delete(hfId);
    const box = $('toasts');
    if (!box) return;
    box.querySelectorAll('.einladung').forEach(el => { if (el.dataset.hf === hfId) el.remove(); });
  }

  async function ladeOffeneHf() {
    const { data } = await client.from('herausforderungen').select('*')
      .eq('an_id', me.id).eq('status', 'offen');
    (data || []).forEach(zeigeHf);
  }

  // Herausforderer: wartet auf Annahme einer eigenen offenen Herausforderung.
  async function pruefeEigeneAngenommen() {
    const { data } = await client.from('herausforderungen').select('*')
      .eq('von_id', me.id).eq('status', 'angenommen').not('partie_id', 'is', null)
      .order('erstellt', { ascending: false }).limit(1);
    const hf = data && data[0];
    // Nur sehr frische Annahmen (letzte 2 Min) automatisch öffnen, um Alt-Zeilen zu ignorieren.
    if (hf && Date.now() - new Date(hf.erstellt).getTime() < 120000) geheZurPartie(hf);
  }

  function startBenachrichtigung() {
    // Eingehende Herausforderungen (an mich)
    client.channel('hf-an-' + me.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'herausforderungen', filter: 'an_id=eq.' + me.id },
        payload => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (row.status === 'offen') zeigeHf(row); else entferneToast(row.id);
        })
      .subscribe();
    // Antworten auf meine eigenen Herausforderungen
    client.channel('hf-von-' + me.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'herausforderungen', filter: 'von_id=eq.' + me.id },
        payload => {
          const row = payload.new;
          if (row && row.status === 'angenommen' && row.partie_id) geheZurPartie(row);
        })
      .subscribe();
    ladeOffeneHf();
    // Sicherheitsnetz, falls eine Echtzeit-Nachricht verloren geht.
    setInterval(() => { if (me) { ladeOffeneHf(); pruefeEigeneAngenommen(); } }, 5000);
  }

  // ===================================================================
  //  Teil 2: Freunde-Seite (#freundeSeite)
  // ===================================================================
  function initSeite() {
    const wrap = $('freundeSeite');
    if (!wrap) return;
    if (!client) { wrap.innerHTML = '<p class="leer">Online ist noch nicht eingerichtet (siehe <b>SETUP.md</b>).</p>'; return; }
    if (!me) { wrap.innerHTML = '<p class="leer">Zum Freunde-Verwalten bitte <a href="login.html">anmelden</a>.</p>'; return; }

    // Namensverzeichnis für eine Menge IDs holen.
    async function namen(ids) {
      const map = {};
      const liste = ids.filter((v, i) => v && ids.indexOf(v) === i);
      if (!liste.length) return map;
      const { data } = await client.from('profiles').select('id,anzeigename').in('id', liste);
      (data || []).forEach(p => map[p.id] = p.anzeigename);
      return map;
    }
    const kurz = id => '#' + String(id).slice(0, 4);

    async function render() {
      const [frRes, einRes, ausRes] = await Promise.all([
        client.from('freunde').select('*').eq('status', 'angenommen').or('von_id.eq.' + me.id + ',an_id.eq.' + me.id),
        client.from('freunde').select('*').eq('status', 'offen').eq('an_id', me.id),
        client.from('freunde').select('*').eq('status', 'offen').eq('von_id', me.id)
      ]);
      const freunde = frRes.data || [], ein = einRes.data || [], aus = ausRes.data || [];
      const ids = []
        .concat(freunde.map(f => f.von_id === me.id ? f.an_id : f.von_id))
        .concat(ein.map(f => f.von_id)).concat(aus.map(f => f.an_id));
      const nm = await namen(ids);
      const zeigeName = id => esc(nm[id] || 'Unbekannt') + ' <span class="kuerzel">' + kurz(id) + '</span>';

      // Eingehende Anfragen
      $('anfragenEin').innerHTML = !ein.length ? '' :
        '<h2>Anfragen an dich</h2>' + ein.map(f =>
          '<div class="zeile"><span>' + zeigeName(f.von_id) + '</span>' +
          '<span class="row"><button class="primary klein" data-ok="' + f.id + '">Annehmen</button>' +
          '<button class="klein" data-nein="' + f.id + '">Ablehnen</button></span></div>').join('');

      // Freundesliste
      $('freundeListe').innerHTML = !freunde.length ? '<p class="leer">Noch keine Freunde. Suche oben nach einem Namen.</p>' :
        freunde.map(f => {
          const fid = f.von_id === me.id ? f.an_id : f.von_id;
          return '<div class="zeile"><span>' + zeigeName(fid) + '</span>' +
            '<span class="row"><button class="primary klein" data-hf="' + fid + '">Herausfordern</button>' +
            '<button class="klein" data-weg="' + f.id + '">Entfernen</button></span></div>';
        }).join('');

      // Ausgehende Anfragen
      $('anfragenAus').innerHTML = !aus.length ? '' :
        '<h2>Gesendete Anfragen</h2>' + aus.map(f =>
          '<div class="zeile"><span>' + zeigeName(f.an_id) + '</span>' +
          '<span class="wartet">wartet …</span></div>').join('');

      // Verdrahtung
      wrap.querySelectorAll('[data-ok]').forEach(b => b.onclick = async () => {
        await client.from('freunde').update({ status: 'angenommen' }).eq('id', b.dataset.ok); render();
      });
      wrap.querySelectorAll('[data-nein]').forEach(b => b.onclick = async () => {
        await client.from('freunde').update({ status: 'abgelehnt' }).eq('id', b.dataset.nein); render();
      });
      wrap.querySelectorAll('[data-weg]').forEach(b => b.onclick = async () => {
        await client.from('freunde').delete().eq('id', b.dataset.weg); render();
      });
      wrap.querySelectorAll('[data-hf]').forEach(b => b.onclick = () => oeffneHf(b.dataset.hf, nm[b.dataset.hf] || 'Unbekannt'));
    }

    // Suche nach Anzeigename → Anfrage senden
    async function suche(q) {
      const erg = $('suchErgebnis');
      q = q.trim();
      if (q.length < 2) { erg.innerHTML = '<p class="leer">Mindestens 2 Zeichen eingeben.</p>'; return; }
      const { data, error } = await client.from('profiles').select('id,anzeigename')
        .ilike('anzeigename', '%' + q + '%').limit(12);
      if (error) { erg.innerHTML = '<p class="leer">Fehler: ' + esc(error.message) + '</p>'; return; }
      const treffer = (data || []).filter(p => p.id !== me.id);
      if (!treffer.length) { erg.innerHTML = '<p class="leer">Niemand gefunden.</p>'; return; }
      erg.innerHTML = treffer.map(p =>
        '<div class="zeile"><span>' + esc(p.anzeigename) + ' <span class="kuerzel">' + kurz(p.id) + '</span></span>' +
        '<button class="primary klein" data-add="' + p.id + '">Hinzufügen</button></div>').join('');
      erg.querySelectorAll('[data-add]').forEach(b => b.onclick = () => anfrageSenden(b.dataset.add, b));
    }

    async function anfrageSenden(ziel, btn) {
      btn.disabled = true;
      // Besteht schon eine Beziehung? (beide Richtungen prüfen)
      const { data: vorhanden } = await client.from('freunde').select('id,von_id,an_id,status')
        .or('and(von_id.eq.' + me.id + ',an_id.eq.' + ziel + '),and(von_id.eq.' + ziel + ',an_id.eq.' + me.id + ')');
      const reverseOffen = (vorhanden || []).find(f => f.von_id === ziel && f.status === 'offen');
      if (reverseOffen) {   // Gegenanfrage vorhanden → direkt annehmen
        await client.from('freunde').update({ status: 'angenommen' }).eq('id', reverseOffen.id);
        btn.textContent = 'Befreundet ✓'; render(); return;
      }
      if ((vorhanden || []).some(f => f.status === 'angenommen')) { btn.textContent = 'Schon befreundet'; return; }
      if ((vorhanden || []).some(f => f.von_id === me.id && f.status === 'offen')) { btn.textContent = 'Anfrage läuft'; return; }
      const { error } = await client.from('freunde').insert({ von_id: me.id, an_id: ziel, status: 'offen' });
      btn.textContent = error ? 'Fehler' : 'Angefragt ✓';
      if (!error) render();
    }

    // Herausfordern-Dialog
    function oeffneHf(freundId, freundName) {
      $('hfName').textContent = freundName;
      const sel = $('hfSpiel');
      sel.innerHTML = Object.keys(SPIELE_INFO).map(id =>
        '<option value="' + id + '">' + esc(SPIELE_INFO[id].name) + '</option>').join('');
      fuelleFarben();
      sel.onchange = fuelleFarben;
      $('hfBox').classList.add('offen');
      $('hfSenden').onclick = async () => {
        const spiel = sel.value, farbe = $('hfFarbe').value;
        $('hfSenden').disabled = true;
        const { error } = await client.from('herausforderungen')
          .insert({ von_id: me.id, an_id: freundId, spiel: spiel, von_farbe: farbe, status: 'offen' });
        $('hfSenden').disabled = false;
        $('hfBox').classList.remove('offen');
        if (error) alert('Herausforderung fehlgeschlagen: ' + error.message);
      };
    }
    function fuelleFarben() {
      const farben = SPIELE_INFO[$('hfSpiel').value].farben;
      $('hfFarbe').innerHTML = '<option value="w">' + esc(farben.w) + '</option><option value="b">' + esc(farben.b) + '</option>';
    }
    $('hfAbbrechen').onclick = () => $('hfBox').classList.remove('offen');

    const form = $('suchForm');
    form.onsubmit = e => { e.preventDefault(); suche($('suchFeld').value); };

    render();
    // Sicherheitsnetz: neue Anfragen/Annahmen eines Freundes erscheinen auch ohne Neuladen der Seite.
    setInterval(render, 4000);
  }

  // ===================================================================
  //  Start
  // ===================================================================
  async function start() {
    if (!client) { initSeite(); return; }   // Seite zeigt dann den SETUP-Hinweis
    try { me = await DB.nutzer(); } catch (e) { me = null; }
    initSeite();
    if (me) startBenachrichtigung();
    // Bei späterem Login/Logout neu aufsetzen (einfacher Weg: Seite richtet sich beim nächsten Laden ein).
  }

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);

  window.Freunde = { annehmen: herausforderungAnnehmen, ablehnen: herausforderungAblehnen };
})();
