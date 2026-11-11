// Zentrale Anbindung an Supabase. Stellt window.DB bereit.
// Lädt nur, wenn config.js echte Werte hat und das Supabase-CDN geladen wurde –
// so bleibt das Offline-Schach auch ohne Konfiguration lauffähig.
(function () {
  'use strict';
  const cfg = window.BRETT_CONFIG || {};
  const konfiguriert = !!cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith('HIER_');
  const sdkDa = typeof window.supabase !== 'undefined' && window.supabase.createClient;
  const bereit = konfiguriert && sdkDa;
  const client = bereit ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  if (konfiguriert && !sdkDa) {
    console.warn('Supabase-SDK nicht geladen – Online-Funktionen deaktiviert.');
  }

  window.DB = {
    bereit,
    konfiguriert,
    client,

    // Aktuell eingeloggter Nutzer oder null.
    async nutzer() {
      if (!client) return null;
      const { data } = await client.auth.getUser();
      return data && data.user ? data.user : null;
    },

    // Anzeigename zu einer Nutzer-ID (oder null).
    async anzeigename(id) {
      if (!client || !id) return null;
      const { data } = await client.from('profiles').select('anzeigename').eq('id', id).maybeSingle();
      return data ? data.anzeigename : null;
    }
  };
})();
