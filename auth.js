// Login/Registrierung über Supabase + Login-Status im Header jeder Seite.
// Stellt window.Auth bereit und füllt automatisch <nav id="authbar"> (falls vorhanden).
(function () {
  'use strict';
  const DB = window.DB;
  const client = DB && DB.client;

  const Auth = {
    bereit: !!client,

    async registrieren(email, passwort, anzeigename) {
      if (!client) throw new Error('Online nicht eingerichtet (siehe SETUP.md).');
      const { data, error } = await client.auth.signUp({ email, password: passwort });
      if (error) throw error;
      // Profil mit Anzeigename anlegen (sofern direkt eine Session besteht).
      const uid = data.user && data.user.id;
      if (uid) await client.from('profiles').upsert({ id: uid, anzeigename });
      return data;
    },

    async anmelden(email, passwort) {
      if (!client) throw new Error('Online nicht eingerichtet (siehe SETUP.md).');
      const { data, error } = await client.auth.signInWithPassword({ email, password: passwort });
      if (error) throw error;
      return data;
    },

    async abmelden() {
      if (client) await client.auth.signOut();
      location.reload();
    }
  };

  // Header-Statusleiste rendern.
  async function renderAuthbar() {
    const bar = document.getElementById('authbar');
    if (!bar) return;
    if (!client) { bar.innerHTML = ''; return; }
    const user = await DB.nutzer();
    if (user) {
      const name = (await DB.anzeigename(user.id)) || user.email;
      bar.innerHTML = '<span class="authname">' + escapeHtml(name) + '</span>' +
        '<a href="freunde.html">Freunde</a>' +
        '<a href="rangliste.html">Rangliste</a>' +
        '<a href="#" id="abmeldenLink">Abmelden</a>';
      const ab = document.getElementById('abmeldenLink');
      if (ab) ab.onclick = e => { e.preventDefault(); Auth.abmelden(); };
    } else {
      bar.innerHTML = '<a href="rangliste.html">Rangliste</a><a href="login.html">Anmelden</a>';
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  Auth.renderAuthbar = renderAuthbar;
  window.Auth = Auth;

  // Bei Login-/Logout-Wechsel Header aktualisieren.
  if (client) client.auth.onAuthStateChange(() => renderAuthbar());
  if (document.readyState !== 'loading') renderAuthbar();
  else document.addEventListener('DOMContentLoaded', renderAuthbar);
})();
