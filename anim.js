// Zug-Animationen für die Brettspiele. Jedes Spiel zeichnet das Brett bei jedem
// Zug komplett neu; der Zielstein steht also schon am Ziel. slide() lässt ihn
// kurz von der Startposition dorthin rutschen, pop() lässt einen neu gesetzten
// Stein aufpoppen. Respektiert "Bewegung reduzieren".
(function () {
  'use strict';

  function reduce() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  const Anim = {
    DUR: 300,   // ms – auch die Wartezeit, bevor die KI „denkt“ (sonst überzeichnet sie die Animation)

    // Element steht bereits am Ziel; dx/dy = Pixel-Versatz der Startposition dazu.
    slide: function (el, dx, dy) {
      if (!el || reduce() || (!dx && !dy)) return;
      const holder = el.parentElement;
      const altZ = holder ? holder.style.zIndex : '';
      if (holder) holder.style.zIndex = '5';   // über den anderen Feldern rutschen
      el.style.transition = 'none';
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      void el.offsetWidth;                      // Reflow, damit der Startzustand greift
      requestAnimationFrame(function () {
        el.style.transition = 'transform .26s cubic-bezier(.33,0,.2,1)';
        el.style.transform = 'translate(0,0)';
      });
      if (holder) el.addEventListener('transitionend', function reset(ev) {
        if (ev.propertyName !== 'transform') return;
        el.removeEventListener('transitionend', reset);
        holder.style.zIndex = altZ;
      });
    },

    // Neu gesetzter Stein poppt auf.
    pop: function (el) {
      if (!el || reduce()) return;
      el.style.transition = 'none';
      el.style.transform = 'scale(.2)';
      el.style.opacity = '0';
      void el.offsetWidth;
      requestAnimationFrame(function () {
        el.style.transition = 'transform .24s cubic-bezier(.34,1.56,.64,1), opacity .16s linear';
        el.style.transform = 'scale(1)';
        el.style.opacity = '1';
      });
    }
  };

  window.Anim = Anim;
})();
