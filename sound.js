// Kurze Zug-/Schlag-Geräusche für alle Spiele (wie das Klicken bei chess.com), synthetisiert
// per Web Audio API – keine Audiodatei nötig, keine Lizenzfrage, funktioniert offline.
// window.Sound.zug()    – normaler Zug/Setzen/Einwerfen
// window.Sound.schlag() – eine Figur/ein Stein wird geschlagen bzw. entfernt (etwas satter)
(function () {
  'use strict';
  let ctx = null;
  function context() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    return ctx;
  }

  // Kurzer, abklingender Rauschimpuls durch einen Bandpass gefiltert = mechanisches "Klick"-Gefühl.
  function klick(c, zeit, dauer, freq, lautstaerke) {
    const n = Math.max(1, Math.round(c.sampleRate * dauer));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.1;
    const g = c.createGain();
    g.gain.setValueAtTime(lautstaerke, zeit);
    g.gain.exponentialRampToValueAtTime(0.001, zeit + dauer);
    src.connect(filter); filter.connect(g); g.connect(c.destination);
    src.start(zeit); src.stop(zeit + dauer);
  }
  // Tiefer, kurzer Sinuston als "Körper" unter dem Klick.
  function koerper(c, zeit, dauer, freq, lautstaerke) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, zeit);
    const g = c.createGain();
    g.gain.setValueAtTime(lautstaerke, zeit);
    g.gain.exponentialRampToValueAtTime(0.001, zeit + dauer);
    osc.connect(g); g.connect(c.destination);
    osc.start(zeit); osc.stop(zeit + dauer);
  }

  window.Sound = {
    zug: function () {
      const c = context(); if (!c) return;
      const t = c.currentTime;
      klick(c, t, 0.045, 1500, 0.5);
      koerper(c, t, 0.05, 220, 0.12);
    },
    schlag: function () {
      const c = context(); if (!c) return;
      const t = c.currentTime;
      klick(c, t, 0.06, 1100, 0.55);
      koerper(c, t, 0.09, 140, 0.22);
    }
  };
})();
