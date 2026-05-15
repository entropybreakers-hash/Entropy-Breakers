/* ═══════════════════════════════════════════════════════════════
   Entropy Breakers — progress sync (automatic, name-based)
   ───────────────────────────────────────────────────────────────
   localStorage marad az elsődleges, offline-képes réteg (eb-progress.js).
   Ez a modul a háttérben szinkronizálja a haladást a Supabase-be, a
   bejelentkezett tanuló NEVE alapján — nincs külön bejelentkezés.

   Minden hívás a Supabase REST/RPC végpontján megy (sima fetch),
   nincs SDK-betöltés. A táblákhoz közvetlenül nem nyúl: a
   security-definer függvényeket hívja (lásd supabase-schema.sql).

   Publikus API — window.EBSync:
     status()       → { configured }
     checkAccess(n) → névlista-ellenőrzés (a belépéshez)
     pull() / push()→ kézi szinkron (általában nem kell hívni)
   Esemény: window 'eb:sync' — a UI ebből frissül egy pull után.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var cfg = window.EB_SUPABASE || {};
  var configured = !!(cfg.url && cfg.anonKey) &&
    cfg.url.indexOf('YOUR_') !== 0 && cfg.anonKey.indexOf('YOUR_') !== 0;
  var RPC = configured ? cfg.url.replace(/\/+$/, '') + '/rest/v1/rpc/' : null;

  var pushTimer = null;

  function rpc(fn, args) {
    if (!configured) return Promise.reject(new Error('A szinkron nincs konfigurálva'));
    return fetch(RPC + fn, {
      method: 'POST',
      headers: {
        'apikey': cfg.anonKey,
        'Authorization': 'Bearer ' + cfg.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args || {})
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('HTTP ' + res.status + ' ' + t);
        });
      }
      return res.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }

  function currentName() {
    try {
      var p = new URLSearchParams(location.search).get('name');
      if (p) return decodeURIComponent(p).trim();
    } catch (e) {}
    try {
      var s = localStorage.getItem('eb.student');
      if (s && s.trim()) return s.trim();
    } catch (e) {}
    return null;
  }

  // Enrolled-students allowlist check (used by the login gate).
  function checkAccess(name) {
    if (!configured) return Promise.resolve({ ok: true });
    return rpc('eb_check_student', { p_name: name }).then(function (data) {
      return { ok: data === true };
    }, function (e) {
      return { ok: false, error: e };
    });
  }

  function pull() {
    var name = currentName();
    if (!configured || !name) return Promise.resolve();
    return rpc('eb_progress_load', { p_name: name }).then(function (data) {
      if (data && window.EB && EB.merge) {
        EB.merge(data);
        try { window.dispatchEvent(new CustomEvent('eb:sync')); } catch (e) {}
      }
      push();
    }, function (e) { console.error('[EBSync] pull', e); });
  }

  function push() {
    var name = currentName();
    if (!configured || !name || !window.EB || !EB.snapshot) return Promise.resolve();
    return rpc('eb_progress_save', { p_name: name, p_data: EB.snapshot() })
      .catch(function (e) { console.error('[EBSync] push', e); });
  }

  function schedulePush() {
    if (!configured || !currentName()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushTimer = null; push(); }, 1500);
  }

  function status() { return { configured: configured }; }

  window.addEventListener('eb:changed', schedulePush);

  window.EBSync = {
    status: status,
    checkAccess: checkAccess,
    pull: pull, push: push
  };

  function init() {
    if (configured && currentName()) pull();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    init();
})();
