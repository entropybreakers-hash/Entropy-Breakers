/* ═══════════════════════════════════════════════════════════════
   Entropy Breakers — kiejtés-felolvasás (text-to-speech)
   ───────────────────────────────────────────────────────────────
   A böngésző beépített beszédszintézisét használja (Web Speech API):
   ingyenes, nincs hálózati hívás, nincs API-kulcs.

   Magától hozzáad egy hangszóró-gombot minden szókártya-oldalhoz
   (ahol van #card-en) — vocab, flashcard, verb-/phrase-learner.
   A gomb a kártyán épp látható angol szót/kifejezést mondja ki.

   Publikus API: window.EBSpeak.say(text)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;

  var LANG = 'en-GB';
  var voice = null;

  function pickVoice() {
    var vs = synth.getVoices() || [];
    if (!vs.length) return;
    function byPrefix(p) {
      for (var i = 0; i < vs.length; i++) {
        if ((vs[i].lang || '').toLowerCase().replace('_', '-').indexOf(p) === 0) return vs[i];
      }
      return null;
    }
    voice = byPrefix('en-gb') || byPrefix('en-us') || byPrefix('en') || null;
  }
  pickVoice();
  if ('onvoiceschanged' in synth) {
    synth.addEventListener('voiceschanged', pickVoice);
  }

  function say(text) {
    if (!text) return;
    text = String(text).trim();
    if (!text || text === '—') return;
    try {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = LANG;
      if (voice) u.voice = voice;
      u.rate = 0.95;
      synth.speak(u);
    } catch (e) {}
  }

  var ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 5L6 9H2v6h4l5 4V5z"/>' +
    '<path d="M15.5 8.5a5 5 0 0 1 0 7"/>' +
    '<path d="M19.5 5a10 10 0 0 1 0 14"/></svg>';

  function wireCard() {
    var container = document.querySelector('.flip-container, .flip-wrap');
    var enEl = document.getElementById('card-en');
    if (!container || !enEl) return;
    if (container.querySelector('.eb-speak-btn')) return;

    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eb-speak-btn';
    btn.setAttribute('aria-label', 'Kiejtés meghallgatása');
    btn.innerHTML = ICON;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      btn.classList.add('eb-speak-active');
      setTimeout(function () { btn.classList.remove('eb-speak-active'); }, 420);
      say(enEl.textContent);
    });
    container.appendChild(btn);
  }

  function boot() {
    try { wireCard(); } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.EBSpeak = { say: say };
})();
