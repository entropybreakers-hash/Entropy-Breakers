/* ═══════════════════════════════════════════════════════════════
   Entropy Breakers — Progress Library (v2: heatmap + last-seen)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PROGRESS_KEY = 'eb.progress.v1';
  var STREAK_KEY   = 'eb.streak.v1';
  var LAST_ACTIVITY_KEY = 'eb.activity.v1';
  var DAILY_KEY    = 'eb.daily.v1';

  function readJSON(key, fallback) {
    try { var raw = localStorage.getItem(key); if (!raw) return fallback; return JSON.parse(raw); }
    catch (e) { return fallback; }
  }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function daysBetween(aISO, bISO) {
    if (!aISO || !bISO) return Infinity;
    var a = new Date(aISO + 'T00:00:00');
    var b = new Date(bISO + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  function getStreak() { return readJSON(STREAK_KEY, { current: 0, best: 0, lastDate: null }); }
  function touchStreak() {
    var s = getStreak();
    var today = todayISO();
    if (s.lastDate === today) return s;
    var diff = daysBetween(s.lastDate, today);
    if (diff === 1) s.current += 1;
    else if (diff !== 2) s.current = 1;
    if (s.current > s.best) s.best = s.current;
    s.lastDate = today;
    writeJSON(STREAK_KEY, s);
    return s;
  }

  var _catalog = null;
  function registerCatalog(cat) { _catalog = cat; }

  function getAll() { return readJSON(PROGRESS_KEY, { levels: {} }); }
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
    if (typeof rec.score === 'number' && typeof rec.total === 'number' && rec.total > 0)
      pct = Math.round((rec.score / rec.total) * 100);
    else if (typeof rec.pct === 'number') pct = rec.pct;
    else pct = 100;
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
    _bumpDaily();
    touchStreak();
    return mod;
  }

  function _bumpDaily() {
    var key = todayISO();
    var m = readJSON(DAILY_KEY, {});
    m[key] = (m[key] || 0) + 1;
    writeJSON(DAILY_KEY, m);
  }
  function getHeatmap(days) {
    days = days || 30;
    var m = readJSON(DAILY_KEY, {});
    var out = [];
    var today = new Date(); today.setHours(0,0,0,0);
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(today); d.setDate(d.getDate() - i);
      var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      var count = m[key] || 0;
      var level = count >= 6 ? 3 : count >= 3 ? 2 : count >= 1 ? 1 : 0;
      out.push({ date: key, count: count, level: level, isToday: i === 0 });
    }
    return out;
  }
  function getActiveDaysInLast(days) {
    var h = getHeatmap(days);
    var c = 0; for (var i = 0; i < h.length; i++) if (h[i].count > 0) c++; return c;
  }

  function lastSeenLabel(iso) {
    if (!iso) return '';
    var then = new Date(iso); then.setHours(0,0,0,0);
    var today = new Date(); today.setHours(0,0,0,0);
    var diff = Math.round((today - then) / 86400000);
    if (diff <= 0) return 'ma';
    if (diff === 1) return 'tegnap';
    if (diff < 7) return diff + ' napja';
    if (diff < 14) return '1 hete';
    if (diff < 30) return Math.floor(diff/7) + ' hete';
    if (diff < 60) return '1 hónapja';
    return Math.floor(diff/30) + ' hónapja';
  }
  function lastSeenBucket(iso) {
    if (!iso) return 'never';
    var then = new Date(iso); then.setHours(0,0,0,0);
    var today = new Date(); today.setHours(0,0,0,0);
    var diff = Math.round((today - then) / 86400000);
    if (diff <= 1) return 'fresh';
    if (diff <= 6) return 'warm';
    return 'cold';
  }

  function _moduleSlugsFor(level, category) {
    if (_catalog && _catalog[level] && _catalog[level][category]) return _catalog[level][category];
    var all = getAll();
    if (!all.levels[level] || !all.levels[level][category]) return [];
    return Object.keys(all.levels[level][category]);
  }
  function getCategoryPct(level, category) {
    var slugs = _moduleSlugsFor(level, category);
    if (!slugs.length) return 0;
    var sum = 0; for (var i = 0; i < slugs.length; i++) { var m = getModule(level, category, slugs[i]); sum += m ? m.best : 0; }
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
    var sum = 0; for (var i = 0; i < cats.length; i++) sum += getCategoryPct(level, cats[i]);
    return Math.round(sum / cats.length);
  }
  function listLevels() { if (_catalog) return Object.keys(_catalog); return Object.keys(getAll().levels); }
  function listCategories() {
    var levels = listLevels(); var set = {};
    for (var i = 0; i < levels.length; i++) { var cats = _levelCategories(levels[i]); for (var j = 0; j < cats.length; j++) set[cats[j]] = true; }
    return Object.keys(set);
  }
  function getOverallPct() {
    var levels = listLevels(); if (!levels.length) return 0;
    var sum = 0; for (var i = 0; i < levels.length; i++) sum += getLevelPct(levels[i]);
    return Math.round(sum / levels.length);
  }
  function getAllLevelPcts() {
    var out = {}; var levels = listLevels();
    for (var i = 0; i < levels.length; i++) out[levels[i]] = getLevelPct(levels[i]);
    return out;
  }
  function reset() {
    try { localStorage.removeItem(PROGRESS_KEY); localStorage.removeItem(STREAK_KEY); localStorage.removeItem(LAST_ACTIVITY_KEY); localStorage.removeItem(DAILY_KEY); } catch (e) {}
  }

  function _parseUrlSlug() {
    try {
      var path = location.pathname.split('/').pop() || ''; path = path.replace(/\.html$/i, '');
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
    var el = document.getElementById('result-percentage');
    if (el && !isNaN(parseInt(el.textContent, 10))) return parseInt(el.textContent, 10);
    var correct = document.getElementById('result-correct'); var total = document.getElementById('result-total');
    if (correct && total) {
      var c = parseInt(correct.textContent, 10); var t = parseInt(total.textContent, 10);
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
      if (logged || !screen.classList.contains('active')) return;
      setTimeout(function () {
        if (logged) return;
        var pct = _readResultPct(); if (pct == null) pct = 100;
        logged = true;
        logModule({ level: meta.level, category: meta.category, slug: meta.slug, title: meta.title, pct: pct });
      }, 150);
    }
    new MutationObserver(maybeLog).observe(screen, { attributes: true, attributeFilter: ['class'] });
    maybeLog();
  }
  function _enrichBackLinks() {
    try {
      var urlInfo = _parseUrlSlug();
      if (!urlInfo) return;
      var params = new URLSearchParams(location.search);
      var name = params.get('name');
      if (!name) return;
      var qs = 'name=' + encodeURIComponent(name) +
               '&level=' + encodeURIComponent(urlInfo.level) +
               '&category=' + encodeURIComponent(urlInfo.category);
      var links = document.querySelectorAll('a[href="index.html"], a[href="./index.html"], a[href="/index.html"]');
      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var base = a.getAttribute('href').split('?')[0];
        a.setAttribute('href', base + '?' + qs);
      }
    } catch (e) {}
  }

  function _wireSwipe() {
    try {
      var urlInfo = _parseUrlSlug();
      if (!urlInfo) return;
      if (urlInfo.category !== 'vocab' && urlInfo.category !== 'flashcards' && urlInfo.category !== 'theory') return;
      var container = document.querySelector('.flip-container, .flip-wrap');
      if (!container) return;
      var startX = null, startY = null, startTime = 0;
      var H_MIN = 40;
      container.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) { startX = null; return; }
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
      }, { passive: true });
      container.addEventListener('touchend', function (e) {
        if (startX == null) return;
        var t = e.changedTouches[0];
        var dx = t.clientX - startX;
        var dy = t.clientY - startY;
        startX = null; startY = null;
        if (Date.now() - startTime > 700) return;
        if (Math.abs(dx) < H_MIN) return;
        if (Math.abs(dy) > Math.abs(dx)) return;
        // Swipe LEFT (dx < 0) → next (carousel convention: content slides
        // leftward to reveal the next card). Swipe RIGHT (dx > 0) → prev.
        if (dx < 0) {
          if (typeof window.nextCard === 'function') window.nextCard();
        } else {
          if (typeof window.prevCard === 'function') window.prevCard();
        }
      }, { passive: true });
      // Swipe replaces the visible prev/next buttons on mobile — the
      // nav-row is hidden via CSS on narrow screens (see eb-theme.css,
      // body.eb-swipe-active .nav-row). Desktop keeps the buttons.
      document.body.classList.add('eb-swipe-active');
    } catch (e) {}
  }

  function _tagBodyCategory() {
    try {
      var urlInfo = _parseUrlSlug();
      if (!urlInfo || !urlInfo.category) return;
      document.body.classList.add('eb-cat-' + urlInfo.category);
    } catch (e) {}
  }

  function _unifyNavButtons() {
    try {
      var urlInfo = _parseUrlSlug();
      if (!urlInfo) return;
      var cat = urlInfo.category;
      if (cat !== 'theory' && cat !== 'vocab' && cat !== 'flashcards') return;

      // Theory pages use text labels ("Előző"/"Következő") — swap to arrows.
      var prevBtn = document.getElementById('prev-btn');
      var nextBtn = document.getElementById('next-btn');
      if (prevBtn && /\S/.test(prevBtn.textContent) && !/[←]/.test(prevBtn.textContent)) {
        prevBtn.textContent = '←';
        prevBtn.setAttribute('aria-label', 'Előző');
      }
      if (nextBtn && /\S/.test(nextBtn.textContent) && !/[→]/.test(nextBtn.textContent)) {
        nextBtn.textContent = '→';
        nextBtn.setAttribute('aria-label', 'Következő');
      }

      // Hide any on-card flip hints — the hint moves into the nav-row below.
      var cardHints = document.querySelectorAll('.flip-hint');
      for (var i = 0; i < cardHints.length; i++) cardHints[i].style.display = 'none';

      // Ensure the nav-row has a unified hint between the prev/next buttons.
      var navRow = document.querySelector('.nav-row');
      if (navRow) {
        var hint = navRow.querySelector('.nav-hint');
        if (!hint) {
          hint = document.createElement('span');
          hint.className = 'nav-hint';
          var prev = navRow.querySelector('#prev-btn');
          if (prev && prev.nextSibling) navRow.insertBefore(hint, prev.nextSibling);
          else navRow.appendChild(hint);
        }
        hint.textContent = 'Koppints a fordításért';
      }
    } catch (e) {}
  }

  function _bootPage() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _tagBodyCategory);
        document.addEventListener('DOMContentLoaded', _hookResultScreen);
        document.addEventListener('DOMContentLoaded', _enrichBackLinks);
        document.addEventListener('DOMContentLoaded', _wireSwipe);
        document.addEventListener('DOMContentLoaded', _unifyNavButtons);
      } else {
        _tagBodyCategory();
        _hookResultScreen();
        _enrichBackLinks();
        _wireSwipe();
        _unifyNavButtons();
      }
    } catch (e) {}
  }

  window.EB = {
    getStreak: getStreak, touchStreak: touchStreak, logModule: logModule, getModule: getModule,
    getCategoryPct: getCategoryPct, getLevelPct: getLevelPct, getOverallPct: getOverallPct, getAllLevelPcts: getAllLevelPcts,
    registerCatalog: registerCatalog, listLevels: listLevels, listCategories: listCategories,
    getHeatmap: getHeatmap, getActiveDaysInLast: getActiveDaysInLast,
    lastSeenLabel: lastSeenLabel, lastSeenBucket: lastSeenBucket,
    reset: reset,
    _debug: { getAll: getAll, parseUrlSlug: _parseUrlSlug, detectMeta: _detectMeta }
  };
  _bootPage();
})();
