/* ═══════════════════════════════════════════════════════════════
   Entropy Breakers — Progress Library
   Auto-detecting progress tracking, streak management, and
   aggregation. Drop-in: just include <script src="assets/eb-progress.js" defer></script>
   on every page (including index.html).

   Public API (attached to window.EB):
     EB.getStreak()                     → { current, best, lastDate }
     EB.touchStreak()                   → increments if today not counted
     EB.logModule({score,total,level,category,slug,title,meta})
     EB.getModule(level, category, slug) → { best, last, attempts, ... }
     EB.getCategoryPct(level, category) → 0..100
     EB.getLevelPct(level)              → 0..100
     EB.getOverallPct()                 → 0..100
     EB.getAllLevelPcts()               → { a2: 45, b1: 10, ... }
     EB.registerCatalog(catalog)        → tells the lib which modules exist
     EB.listLevels()                    → ['a2','b1','b2','c1']
     EB.listCategories()                → ['theory','practice','vocab','flashcards',...]
     EB.reset()                         → wipes progress (dev)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PROGRESS_KEY = 'eb.progress.v1';
  var STREAK_KEY   = 'eb.streak.v1';
  var LAST_ACTIVITY_KEY = 'eb.activity.v1';

  /* ═══ Storage primitives ═══ */
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ═══ Date helpers ═══ */
  function todayISO() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function daysBetween(aISO, bISO) {
    if (!aISO || !bISO) return Infinity;
    var a = new Date(aISO + 'T00:00:00');
    var b = new Date(bISO + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  /* ═══ Streak management ═══ */
  function getStreak() {
    return readJSON(STREAK_KEY, { current: 0, best: 0, lastDate: null });
  }
  function touchStreak() {
    var s = getStreak();
    var today = todayISO();
    if (s.lastDate === today) return s;
    var diff = daysBetween(s.lastDate, today);
    if (diff === 1) {
      s.current += 1;
    } else if (diff === 2) {
      // Grace day — one missed day forgiven; streak frozen, not incremented.
    } else {
      s.current = 1;
    }
    if (s.current > s.best) s.best = s.current;
    s.lastDate = today;
    writeJSON(STREAK_KEY, s);
    return s;
  }

  /* ═══ Catalog ═══ */
  var _catalog = null;
  function registerCatalog(cat) { _catalog = cat; }

  /* ═══ Progress reads/writes ═══ */
  function getAll() {
    return readJSON(PROGRESS_KEY, { levels: {} });
  }
  function writeAll(data) { writeJSON(PROGRESS_KEY, data); }

  function getModule(level, category, slug) {
    var all = getAll();
    if (!all.levels[level]) return null;
    if (!all.levels[level][category]) return null;
    return all.levels[level][category][slug] || null;
  }

  function logModule(rec) {
    if (!rec || !rec.level || !rec.category || !rec.slug) return;
    var pct = 0;
    if (typeof rec.score === 'number' && typeof rec.total === 'number' && rec.total > 0) {
      pct = Math.round((rec.score / rec.total) * 100);
    } else if (typeof rec.pct === 'number') {
      pct = rec.pct;
    } else {
      pct = 100;
    }
    pct = Math.max(0, Math.min(100, pct));

    var all = getAll();
    if (!all.levels[rec.level]) all.levels[rec.level] = {};
    if (!all.levels[rec.level][rec.category]) all.levels[rec.level][rec.category] = {};
    var mod = all.levels[rec.level][rec.category][rec.slug] || {
      best: 0, last: 0, attempts: 0, firstAt: null, lastAt: null, title: rec.title || null
    };
    mod.last = pct;
    if (pct > mod.best) mod.best = pct;
    mod.attempts += 1;
    var now = new Date().toISOString();
    if (!mod.firstAt) mod.firstAt = now;
    mod.lastAt = now;
    if (rec.title) mod.title = rec.title;

    all.levels[rec.level][rec.category][rec.slug] = mod;
    writeAll(all);

    writeJSON(LAST_ACTIVITY_KEY, { at: now, level: rec.level, category: rec.category, slug: rec.slug, pct: pct });
    touchStreak();
    return mod;
  }

  /* ═══ Aggregation ═══ */
  function _moduleSlugsFor(level, category) {
    if (_catalog && _catalog[level] && _catalog[level][category]) {
      return _catalog[level][category];
    }
    var all = getAll();
    if (!all.levels[level] || !all.levels[level][category]) return [];
    return Object.keys(all.levels[level][category]);
  }

  function getCategoryPct(level, category) {
    var slugs = _moduleSlugsFor(level, category);
    if (!slugs.length) return 0;
    var sum = 0;
    for (var i = 0; i < slugs.length; i++) {
      var m = getModule(level, category, slugs[i]);
      sum += m ? m.best : 0;
    }
    return Math.round(sum / slugs.length);
  }

  function _levelCategories(level) {
    if (_catalog && _catalog[level]) return Object.keys(_catalog[level]);
    var all = getAll();
    return all.levels[level] ? Object.keys(all.levels[level]) : [];
  }

  function getLevelPct(level) {
    var cats = _levelCategories(level);
    if (!cats.length) return 0;
    var sum = 0;
    for (var i = 0; i < cats.length; i++) sum += getCategoryPct(level, cats[i]);
    return Math.round(sum / cats.length);
  }

  function listLevels() {
    if (_catalog) return Object.keys(_catalog);
    return Object.keys(getAll().levels);
  }
  function listCategories() {
    var levels = listLevels();
    var set = {};
    for (var i = 0; i < levels.length; i++) {
      var cats = _levelCategories(levels[i]);
      for (var j = 0; j < cats.length; j++) set[cats[j]] = true;
    }
    return Object.keys(set);
  }

  function getOverallPct() {
    var levels = listLevels();
    if (!levels.length) return 0;
    var sum = 0;
    for (var i = 0; i < levels.length; i++) sum += getLevelPct(levels[i]);
    return Math.round(sum / levels.length);
  }

  function getAllLevelPcts() {
    var out = {};
    var levels = listLevels();
    for (var i = 0; i < levels.length; i++) out[levels[i]] = getLevelPct(levels[i]);
    return out;
  }

  function reset() {
    try {
      localStorage.removeItem(PROGRESS_KEY);
      localStorage.removeItem(STREAK_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch (e) {}
  }

  /* ═══ Auto-detect on practice/theory/vocab/flashcard pages ═══ */
  function _parseUrlSlug() {
    try {
      var path = location.pathname.split('/').pop() || '';
      path = path.replace(/\.html$/i, '');
      var m;
      if ((m = path.match(/^(a2|b1|b2|c1)-theory-(.+)$/))) return { level: m[1], category: 'theory', slug: m[2] };
      if ((m = path.match(/^(a2|b1|b2|c1)-practice-(.+)$/))) return { level: m[1], category: 'practice', slug: m[2] };
      if ((m = path.match(/^vocab-(a2|b1|b2|c1)-(.+)$/))) return { level: m[1], category: 'vocab', slug: m[2] };
      if ((m = path.match(/^wordorder-(a2|b1|b2|c1)$/))) return { level: m[1], category: 'practice', slug: 'wordorder' };
      if ((m = path.match(/^(a2|b1|b2|c1)-grammar-master$/))) return { level: m[1], category: 'practice', slug: 'grammar-master' };
      if ((m = path.match(/^(a2|b1|b2|c1)-verb-(learner|test)$/))) return { level: m[1], category: 'practice', slug: 'verb-' + m[2] };
      if ((m = path.match(/^(a2|b1|b2|c1)-phrase-(learner|test)$/))) return { level: m[1], category: 'practice', slug: 'phrase-' + m[2] };
      if ((m = path.match(/^traveling-guide-(a2|b1|b2|c1)-flashcards$/))) return { level: m[1], category: 'flashcards', slug: 'traveling-guide' };
      if (path === 'traveling-guide-b1b2-flashcards') return { level: 'b1', category: 'flashcards', slug: 'traveling-guide-b1b2' };
      return null;
    } catch (e) { return null; }
  }

  function _detectMeta() {
    var urlInfo = _parseUrlSlug();
    var metaObj = (typeof window !== 'undefined' && window.MODULE_META) ? window.MODULE_META : null;
    if (!urlInfo && !metaObj) return null;
    return {
      level: (urlInfo && urlInfo.level) || (metaObj && String(metaObj.level || '').toLowerCase()) || null,
      category: (urlInfo && urlInfo.category) || null,
      slug: (urlInfo && urlInfo.slug) || null,
      title: metaObj && metaObj.title || null
    };
  }

  function _readResultPct() {
    var el;
    el = document.getElementById('result-percentage');
    if (el && !isNaN(parseInt(el.textContent, 10))) return parseInt(el.textContent, 10);
    var correct = document.getElementById('result-correct');
    var total = document.getElementById('result-total');
    if (correct && total) {
      var c = parseInt(correct.textContent, 10);
      var t = parseInt(total.textContent, 10);
      if (!isNaN(c) && !isNaN(t) && t > 0) return Math.round((c / t) * 100);
    }
    return null;
  }

  function _hookResultScreen() {
    var meta = _detectMeta();
    if (!meta || !meta.level || !meta.category || !meta.slug) return;
    var screen = document.getElementById('result-screen');
    if (!screen) return;
    var logged = false;
    function maybeLog() {
      if (logged) return;
      if (!screen.classList.contains('active')) return;
      setTimeout(function () {
        if (logged) return;
        var pct = _readResultPct();
        if (pct == null) pct = 100;
        logged = true;
        logModule({
          level: meta.level,
          category: meta.category,
          slug: meta.slug,
          title: meta.title,
          pct: pct
        });
      }, 150);
    }
    var obs = new MutationObserver(maybeLog);
    obs.observe(screen, { attributes: true, attributeFilter: ['class'] });
    maybeLog();
  }

  function _bootPage() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _hookResultScreen);
      } else {
        _hookResultScreen();
      }
    } catch (e) {}
  }

  window.EB = {
    getStreak: getStreak,
    touchStreak: touchStreak,
    logModule: logModule,
    getModule: getModule,
    getCategoryPct: getCategoryPct,
    getLevelPct: getLevelPct,
    getOverallPct: getOverallPct,
    getAllLevelPcts: getAllLevelPcts,
    registerCatalog: registerCatalog,
    listLevels: listLevels,
    listCategories: listCategories,
    reset: reset,
    _debug: { getAll: getAll, parseUrlSlug: _parseUrlSlug, detectMeta: _detectMeta }
  };

  _bootPage();
})();
