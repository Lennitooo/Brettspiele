// Gemeinsame Online-Steuerung für alle Spiele: Partie erstellen/beitreten, Züge via Supabase-Realtime.
// Aufruf pro Seite:  Online.init({ spiel: 'vier', ui: window.VierUI, farben: { w: 'Rot', b: 'Gelb' } })
// Die UI muss bereitstellen: startOnline(meineFarbe, zuege), syncMoves(zuege), setHandlers({ onLocalMove, onModeChange }).
(function () {
  'use strict';
  const SEITEN = { schach: 'schach.html', vier: 'vier.html', dame: 'dame.html', muehle: 'muehle.html' };

  function init(opts) {
    const UI = opts && opts.ui;
    const SPIEL = opts && opts.spiel;
    const NAMEN = (opts && opts.farben) || { w: 'Weiß', b: 'Schwarz' };
    const DB = window.DB;
    const client = DB && DB.client;
    const $ = id => document.getElementById(id);
    if (!UI || !SPIEL) return;

    let partieId = null;
    let meineFarbe = null;   // 'w' | 'b' | 'spectator'
    let channel = null;
    let abfrage = null;      // Sicherheitsnetz: regelmäßige Abfrage, falls eine Echtzeit-Nachricht verloren geht
    let gegnerDa = false;
    let beendet = false;

    function setInfo(html) { const el = $('onlineInfo'); if (el) el.innerHTML = html; }

    // ---------- Panel bei Moduswechsel ----------
    function onModeChange(m) {
      const box = $('onlineBox');
      if (!box) return;
      if (m !== 'online') { box.style.display = 'none'; resetOnline(); return; }
      box.style.display = '';
      resetOnline();
      zeigeErstellen();
    }

    async function zeigeErstellen() {
      $('onlineLinkWrap').style.display = 'none';
      const btn = $('btnErstellen');
      if (!client) { btn.style.display = 'none'; setInfo('Online ist noch nicht eingerichtet (siehe <b>SETUP.md</b>).'); return; }
      const user = await DB.nutzer();
      if (!user) { btn.style.display = 'none'; setInfo('Zum Online-Spielen bitte <a href="login.html">anmelden</a>.'); return; }
      btn.style.display = '';
      setInfo('Erstelle eine Partie und teile den Link mit einem Freund.');
    }

    function resetOnline() {
      if (channel) { try { client.removeChannel(channel); } catch (e) {} channel = null; }
      if (abfrage) { clearInterval(abfrage); abfrage = null; }
      partieId = null;
      meineFarbe = null;
      gegnerDa = false;
      beendet = false;
    }

    // ---------- Partie erstellen ----------
    async function erstellePartie() {
      const user = await DB.nutzer();
      if (!user) { setInfo('Bitte zuerst <a href="login.html">anmelden</a>.'); return; }
      $('btnErstellen').disabled = true;
      const { data, error } = await client.from('partien')
        .insert({ spiel: SPIEL, weiss_id: user.id, fen: 'start', zuege: [], am_zug: 'w', status: 'offen' })
        .select().single();
      $('btnErstellen').disabled = false;
      if (error) { setInfo('Fehler: ' + error.message); return; }
      partieId = data.id;
      meineFarbe = 'w';
      setLinkInUrl(partieId);
      $('btnErstellen').style.display = 'none';
      $('onlineLink').value = location.href;
      $('onlineLinkWrap').style.display = '';
      subscribe(partieId);
      UI.startOnline('w', []);
      setInfo('Partie erstellt – teile den Link. Warte auf Gegner …');
    }

    // ---------- Partie beitreten / laden (per ?partie=…) ----------
    async function joinPartie(pid) {
      const box = $('onlineBox');
      if (box) box.style.display = '';
      if (!client) { setInfo('Online ist noch nicht eingerichtet (siehe <b>SETUP.md</b>).'); return; }
      const user = await DB.nutzer();
      if (!user) { setInfo('Zum Mitspielen bitte <a href="login.html">anmelden</a> und den Link erneut öffnen.'); return; }

      const { data: row, error } = await client.from('partien').select('*').eq('id', pid).maybeSingle();
      if (error || !row) { setInfo('Partie nicht gefunden.'); return; }

      // Link gehört zu einem anderen Spiel → auf die passende Seite weiterleiten.
      if (row.spiel !== SPIEL) {
        if (SEITEN[row.spiel]) location.replace(SEITEN[row.spiel] + '?partie=' + encodeURIComponent(pid));
        else setInfo('Dieser Link gehört zu einem unbekannten Spiel.');
        return;
      }

      if (row.weiss_id === user.id) meineFarbe = 'w';
      else if (row.schwarz_id === user.id) meineFarbe = 'b';
      else if (!row.schwarz_id) {
        const { data: upd, error: e2 } = await client.from('partien')
          .update({ schwarz_id: user.id, status: 'laeuft' }).eq('id', pid).select();
        if (e2) { setInfo('Beitreten fehlgeschlagen: ' + e2.message); return; }
        if (!upd || !upd.length) { setInfo('Beitreten nicht erlaubt – bitte SETUP.md/RLS prüfen.'); return; }
        meineFarbe = 'b';
        row.schwarz_id = user.id;
      } else {
        meineFarbe = 'spectator';
      }

      partieId = pid;
      $('mode').value = 'online';
      $('onlineLink').value = location.href;
      $('onlineLinkWrap').style.display = '';
      $('btnErstellen').style.display = 'none';
      subscribe(pid);
      UI.startOnline(meineFarbe, row.zuege || []);
      farbInfo(row);
    }

    function farbInfo(row) {
      if (meineFarbe === 'spectator') { setInfo('Diese Partie ist voll – Zuschauer-Modus.'); return; }
      const warten = (meineFarbe === 'w' && !row.schwarz_id);
      setInfo('Du spielst <b>' + NAMEN[meineFarbe] + '</b>.' + (warten ? ' Warte auf Gegner – teile den Link.' : ''));
    }

    // ---------- Realtime ----------
    // Neuen Stand der Partie übernehmen (aus Echtzeit-Nachricht oder Abfrage). Mehrfach aufrufbar.
    function verarbeite(row) {
      if (!row) return;
      if (meineFarbe === 'w' && row.schwarz_id && !gegnerDa && row.status !== 'beendet') {
        gegnerDa = true;
        setInfo('Du spielst <b>' + NAMEN.w + '</b>. Gegner ist da – viel Erfolg!');
      }
      UI.syncMoves(row.zuege || []);
      if (row.status === 'beendet' && !beendet) {
        beendet = true;
        setInfo('Partie beendet.');
        if (abfrage) { clearInterval(abfrage); abfrage = null; }
      }
    }

    async function holeStand() {
      const id = partieId;
      if (!id) return;
      const { data: row } = await client.from('partien').select('schwarz_id,status,zuege').eq('id', id).maybeSingle();
      if (row && id === partieId) verarbeite(row);
    }

    function subscribe(id) {
      if (channel) { try { client.removeChannel(channel); } catch (e) {} }
      if (abfrage) clearInterval(abfrage);
      channel = client.channel('partie-' + id)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'partien', filter: 'id=eq.' + id },
          payload => { if (id === partieId) verarbeite(payload.new); })
        .subscribe(status => { if (status === 'SUBSCRIBED') holeStand(); });   // Lücke beim Verbindungsaufbau schließen
      abfrage = setInterval(holeStand, 3000);
    }

    // ---------- eigener Zug → an Server senden ----------
    async function onLocalMove(zuege, amZug, ergebnis) {
      if (!partieId || meineFarbe === 'spectator') return;
      const patch = { zuege: zuege, am_zug: amZug, geaendert: new Date().toISOString() };
      if (ergebnis) { patch.status = 'beendet'; patch.ergebnis = ergebnis; }
      const { error } = await client.from('partien').update(patch).eq('id', partieId);
      if (error) setInfo('Zug konnte nicht gesendet werden: ' + error.message);
    }

    // ---------- Hilfen ----------
    function setLinkInUrl(id) {
      history.replaceState(null, '', location.origin + location.pathname + '?partie=' + id);
    }

    async function kopiereLink() {
      const t = $('onlineLink').value;
      try { await navigator.clipboard.writeText(t); setInfo('Link kopiert ✓'); }
      catch (e) { $('onlineLink').select(); document.execCommand && document.execCommand('copy'); setInfo('Link markiert – mit Strg+C kopieren.'); }
    }

    // ---------- Verdrahtung ----------
    UI.setHandlers({ onLocalMove: onLocalMove, onModeChange: onModeChange });
    const be = $('btnErstellen'); if (be) be.onclick = erstellePartie;
    const bk = $('btnKopieren'); if (bk) bk.onclick = kopiereLink;

    // Deep-Link: direkt in eine Partie einsteigen.
    const pid = new URLSearchParams(location.search).get('partie');
    if (pid) joinPartie(pid);
  }

  window.Online = { init: init };
})();
