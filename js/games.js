// UPDATED — MERGED v2 (original 10 + 13 new games)
// ========================================
// SKYWORLD - GAMES.JS
// Shared Game Logic, Score, Timer, Utils
// + Supabase Score Saving (all 23 games)
// ========================================

(function () {
  'use strict';

  window.PH = window.PH || {};

  // ============================================================
  // SUPABASE INIT (runs on every page — game pages included)
  // Safe to call multiple times; guarded by _supabaseReady flag.
  // ============================================================
  PH._supabaseReady = false;

  PH.initSupabase = function () {
    if (PH._supabaseReady) return window.PH.supabase;
    if (!window.supabase) return null; // CDN not loaded yet
    const SUPABASE_URL = "https://fkfkqpyikvshnphongfj.supabase.co";
    const SUPABASE_KEY = "sb_publishable_mnc_H-RlH2q5BdlsoO1pqQ_aeQZRjVF";
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.PH.supabase = sb;
    PH._supabaseReady = true;
    return sb;
  };

  // === HIGH SCORES (local) ===
  const HS_KEY = 'ph_highscores';

  // Internal: saves locally only — does NOT trigger a remote push (no recursion)
  PH._localSetHighScore = function (game, score) {
    try {
      const data = JSON.parse(localStorage.getItem(HS_KEY) || '{}');
      const prev = data[game] || 0;
      if (score > prev) {
        data[game] = score;
        localStorage.setItem(HS_KEY, JSON.stringify(data));
        return true;
      }
      return false;
    } catch (e) { return false; }
  };

  PH.getHighScore = function (game) {
    try {
      const data = JSON.parse(localStorage.getItem(HS_KEY) || '{}');
      return data[game] || 0;
    } catch (e) { return 0; }
  };

  // Public setHighScore — saves locally AND pushes to Supabase (no recursion)
  PH.setHighScore = function (game, score) {
    const isNew = PH._localSetHighScore(game, score);
    PH._pushScoreToSupabase(game, score); // fire-and-forget
    return isNew;
  };

  PH.getAllScores = function () {
    try { return JSON.parse(localStorage.getItem(HS_KEY) || '{}'); } catch (e) { return {}; }
  };

  // ============================================================
  // SUPABASE SCORE SAVING
  // _pushScoreToSupabase — internal worker, never recursive
  // saveScore            — public API (local + remote)
  // submitScore          — save + show toast
  // ============================================================

  PH._pushScoreToSupabase = async function (game, score) {
    const sb = PH.initSupabase();
    if (!sb) return;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return; // not logged in — skip silently

      const { error } = await sb.from('scores').insert([{
        game:  game,
        score: score,
        email: session.user.email || null  // readable name for leaderboard
        // user_id auto-set by Supabase RLS via auth.uid()
      }]);

      if (error) console.warn('[SkyWorld] Score save error:', error.message);
    } catch (e) {
      console.warn('[SkyWorld] Score save failed:', e);
    }
  };

  PH.saveScore = async function (game, score) {
    PH._localSetHighScore(game, score);
    await PH._pushScoreToSupabase(game, score);
  };

  PH.submitScore = async function (game, score) {
    PH._localSetHighScore(game, score);
    await PH._pushScoreToSupabase(game, score);
    const sb = window.PH.supabase;
    if (!sb) return;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) PH._showScoreToast(score);
    } catch (e) {}
  };

  PH._showScoreToast = function (score) {
    const old = document.getElementById('ph-score-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'ph-score-toast';
    toast.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:99999;
      font-family:'Press Start 2P',monospace; font-size:8px;
      background:#0a0a1a; border:2px solid #00ff88;
      color:#00ff88; padding:12px 16px;
      box-shadow:0 0 16px #00ff8866;
      animation: fadeIn .3s ease;
      letter-spacing:1px; line-height:1.6;
    `;
    toast.innerHTML = `&#x2705; SCORE SAVED!<br><span style="color:#ffff00">${score.toLocaleString()} PTS</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .5s';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  };

  // === TIMER ===
  PH.Timer = function (displayEl, onTick, onEnd) {
    let interval = null;
    let seconds = 0;
    this.start = function (initialSeconds) {
      seconds = initialSeconds || 0;
      if (displayEl) displayEl.textContent = seconds;
      interval = setInterval(() => {
        if (initialSeconds !== undefined) {
          seconds--;
          if (seconds <= 0) {
            seconds = 0;
            if (displayEl) displayEl.textContent = seconds;
            clearInterval(interval);
            if (onEnd) onEnd();
            return;
          }
        } else { seconds++; }
        if (displayEl) displayEl.textContent = seconds;
        if (onTick) onTick(seconds);
      }, 1000);
    };
    this.stop  = function () { clearInterval(interval); };
    this.reset = function () { clearInterval(interval); seconds = 0; if (displayEl) displayEl.textContent = seconds; };
    this.getSeconds = function () { return seconds; };
  };

  // === SCORE MANAGER ===
  PH.ScoreManager = function (displayEl) {
    let score = 0;
    this.add = function (pts) { score += pts; this.update(); };
    this.set = function (pts) { score = pts;  this.update(); };
    this.get = function () { return score; };
    this.reset = function () { score = 0; this.update(); };
    this.update = function () {
      if (displayEl) {
        displayEl.textContent = score;
        displayEl.classList.remove('score-pop');
        void displayEl.offsetWidth;
        displayEl.classList.add('score-pop');
      }
    };
  };

  // === SHUFFLE ARRAY ===
  PH.shuffle = function (arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  PH.randInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  PH.formatTime = function (seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  PH.showScreen = function (id) {
    document.querySelectorAll('.game-screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); el.style.animation = 'zoomIn 0.3s ease'; }
  };

  PH.hideScreen = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  };

  PH.hideAllScreens = function () {
    document.querySelectorAll('.game-screen').forEach(s => s.classList.add('hidden'));
  };

  PH.createGameNav = function (title) {
    const stored = PH.getHighScore(title.toLowerCase().replace(/\s+/g, '-'));
    return `
      <nav class="game-nav">
        <a href="../index.html" class="back-btn" onclick="PH.playClick()">&#x2190; BACK</a>
        <span class="game-title-nav">${title}</span>
        <span class="score-display">BEST: <span id="nav-best">${stored}</span></span>
      </nav>
    `;
  };

  PH.onSwipe = function (el, callback) {
    let startX, startY;
    el.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) < 20) return;
      if (adx > ady) callback(dx > 0 ? 'right' : 'left');
      else callback(dy > 0 ? 'down' : 'up');
    }, { passive: true });
  };

  PH.confetti = function () {
    const colors = ['#00ffff','#ff00ff','#ffff00','#00ff88','#ff6600'];
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.style.cssText = `
          position:fixed;width:8px;height:8px;
          background:${colors[Math.floor(Math.random()*colors.length)]};
          left:${Math.random()*100}vw;top:-10px;z-index:9999;
          pointer-events:none;
          transition:transform ${1+Math.random()*2}s ease-in,opacity ${1+Math.random()*2}s ease-in;
        `;
        document.body.appendChild(p);
        requestAnimationFrame(() => {
          p.style.transform = `translateY(${80+Math.random()*20}vh) rotate(${Math.random()*720}deg)`;
          p.style.opacity = '0';
        });
        setTimeout(() => p.remove(), 3000);
      }, i * 30);
    }
  };

  PH.initGamePage = function () {
    const gameId = document.body.dataset.game;
    if (gameId) {
      const best = PH.getHighScore(gameId);
      const el = document.getElementById('nav-best');
      if (el) el.textContent = best;
    }
    const soundBtn = document.getElementById('sound-toggle');
    if (soundBtn) {
      soundBtn.textContent = PH.isSoundOn ? (PH.isSoundOn() ? '&#x1F50A;' : '&#x1F507;') : '&#x1F50A;';
      soundBtn.addEventListener('click', () => {
        const s = localStorage.getItem('ph_sound');
        const newVal = s === 'false' ? 'true' : 'false';
        localStorage.setItem('ph_sound', newVal);
        soundBtn.textContent = newVal === 'false' ? '&#x1F507;' : '&#x1F50A;';
      });
    }
  };

  // Auto-init Supabase after DOM + CDN scripts have loaded
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => PH.initSupabase(), 150);
  });

})();
