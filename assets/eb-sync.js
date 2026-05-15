/* ═══════════════════════════════════════════════════════════════
   Entropy Breakers — Supabase sync layer (hybrid)
   ───────────────────────────────────────────────────────────────
   localStorage marad az elsődleges, offline-képes réteg (eb-progress.js).
   Ez a modul a háttérben szinkronizálja a haladást a Supabase-be:
     • bejelentkezett (email magic link) felhasználónál tölt + ment,
     • a Supabase SDK-t csak akkor tölti be, ha tényleg kell
       (van mentett munkamenet, vagy épp belépés zajlik) — így a
       modul-oldalak betöltése nem lassul azoknál, akik nem szinkronizálnak.

   Publikus API — window.EBSync:
     status()        → { configured, ready, user }
     onChange(cb)    → feliratkozás állapotváltozásra (azonnal hív, ha kész)
     signIn(email)   → magic link küldése
     signOut()       → kijelentkezés
     pull() / push() → kézi szinkron (általában nem kell hívni)
   Esemény: window 'eb:sync' — a UI ebből frissül.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var cfg = window.EB_SUPABASE || {};
  var configured = !!(cfg.url && cfg.anonKey) &&
    cfg.url.indexOf('YOUR_') !== 0 && cfg.anonKey.indexOf('YOUR_') !== 0;

  var TABLE = 'eb_progress';
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  var client = null;
  var clientPromise = null;
  var user = null;
  var ready = false;
  var listeners = [];
  var pushTimer = null;

  function status() {
    return { configured: configured, ready: ready, user: user };
  }
  function emit() {
    var st = status();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](st); } catch (e) {}
    }
    try { window.dispatchEvent(new CustomEvent('eb:sync', { detail: st })); } catch (e) {}
  }
  function onChange(cb) {
    if (typeof cb !== 'function') return;
    listeners.push(cb);
    if (ready) { try { cb(status()); } catch (e) {} }
  }

  function projectRef() {
    try { return new URL(cfg.url).hostname.split('.')[0]; }
    catch (e) { return null; }
  }
  function hasStoredSession() {
    var ref = projectRef();
    if (!ref) return false;
    try { return !!localStorage.getItem('sb-' + ref + '-auth-token'); }
    catch (e) { return false; }
  }
  function returningFromMagicLink() {
    var s = (location.hash || '') + ' ' + (location.search || '');
    return /access_token=|[?&#]code=/.test(s);
  }

  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = function () {
        if (window.supabase && window.supabase.createClient) resolve();
        else reject(new Error('Supabase SDK nem elérhető'));
      };
      s.onerror = function () { reject(new Error('Supabase SDK betöltése sikertelen')); };
      document.head.appendChild(s);
    });
  }

  function ensureClient() {
    if (clientPromise) return clientPromise;
    clientPromise = loadSdk().then(function () {
      client = window.supabase.createClient(cfg.url, cfg.anonKey);
      client.auth.onAuthStateChange(function (event, session) {
        user = (session && session.user) ? session.user : null;
        ready = true;
        emit();
        if (user && event !== 'TOKEN_REFRESHED') pull();
      });
      return client;
    });
    return clientPromise;
  }

  function pull() {
    if (!client || !user) return Promise.resolve();
    return client.from(TABLE).select('data').eq('user_id', user.id).maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        if (res.data && res.data.data && window.EB && EB.merge) {
          EB.merge(res.data.data);
          emit();
        }
        push();
      })
      .catch(function (e) { console.error('[EBSync] pull', e); });
  }

  function push() {
    if (!client || !user || !window.EB || !EB.snapshot) return Promise.resolve();
    return client.from(TABLE).upsert({
      user_id: user.id,
      data: EB.snapshot(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' }).then(function (res) {
      if (res.error) console.error('[EBSync] push', res.error);
    }, function (e) { console.error('[EBSync] push', e); });
  }

  function schedulePush() {
    if (!client || !user) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { pushTimer = null; push(); }, 1500);
  }

  function signIn(email) {
    if (!configured) return Promise.reject(new Error('A szinkron nincs konfigurálva'));
    return ensureClient().then(function (c) {
      return c.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: location.origin + location.pathname }
      });
    });
  }
  function signOut() {
    if (!client) { user = null; emit(); return Promise.resolve(); }
    return client.auth.signOut().then(function () { user = null; emit(); });
  }

  function init() {
    if (!configured) { ready = true; emit(); return; }
    if (hasStoredSession() || returningFromMagicLink()) {
      ensureClient().catch(function (e) {
        console.error('[EBSync] init', e);
        ready = true; emit();
      });
    } else {
      ready = true;
      emit();
    }
  }

  window.addEventListener('eb:changed', schedulePush);

  window.EBSync = {
    status: status, onChange: onChange,
    signIn: signIn, signOut: signOut,
    pull: pull, push: push
  };

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    init();
})();
