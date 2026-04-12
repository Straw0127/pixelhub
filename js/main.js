// UPDATED — MERGED v2 (original 10 + 13 new games)
// ========================================
// SKYWORLD - MAIN.JS
// UI Animations, Music Toggle, Navigation
// + Supabase Auth, Leaderboard (all 23 games)
// + Mobile hamburger menu (null-safe)
// NOTE: Supabase loaded via CDN script tag in index.html
// ========================================

(function () {
  'use strict';

  // === STATE ===
  const state = {
    soundEnabled: localStorage.getItem('ph_sound') !== 'false',
    musicStarted: false
  };

  // === LOADING SCREEN ===
  function runLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    const bar = document.getElementById('loading-bar');
    const text = document.getElementById('loading-text');
    if (!loadingScreen) return;

    const steps = [
      [10, 'LOADING ASSETS...'],
      [30, 'BOOTING ARCADE...'],
      [55, 'LOADING GAMES...'],
      [75, 'CALIBRATING PIXELS...'],
      [90, 'WARMING UP NEONS...'],
      [100, 'READY TO PLAY!']
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i >= steps.length) {
        clearInterval(interval);
        setTimeout(() => {
          loadingScreen.style.transition = 'opacity 0.5s';
          loadingScreen.style.opacity = '0';
          setTimeout(() => {
            loadingScreen.style.display = 'none';
            if (app) {
              app.style.display = 'block';
              app.style.animation = 'fadeIn 0.4s ease';
            }
          }, 500);
        }, 300);
        return;
      }
      const [pct, msg] = steps[i++];
      if (bar) bar.style.width = pct + '%';
      if (text) text.textContent = msg;
    }, 220);
  }

  // === PIXEL PARTICLES ===
  function initParticles() {
    const bg = document.getElementById('pixel-bg');
    if (!bg) return;
    const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88', '#ff6600'];
    for (let i = 0; i < 25; i++) {
      const p = document.createElement('div');
      p.className = 'pixel-particle';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDuration = (8 + Math.random() * 12) + 's';
      p.style.animationDelay = (Math.random() * 12) + 's';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.boxShadow = `0 0 6px ${colors[Math.floor(Math.random() * colors.length)]}`;
      const size = (2 + Math.random() * 5) + 'px';
      p.style.width = size;
      p.style.height = size;
      bg.appendChild(p);
    }
  }

  // === SOUND SYSTEM ===
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
  }

  function playBeep(freq, dur, type = 'square', vol = 0.15) {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch (e) {}
  }

  window.PH = window.PH || {};
  window.PH.playBeep = playBeep;
  window.PH.playClick = () => playBeep(880, 0.08, 'square', 0.1);
  window.PH.playWin = () => {
    if (!state.soundEnabled) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playBeep(f, 0.2, 'sine', 0.2), i * 100);
    });
  };
  window.PH.playLose = () => {
    if (!state.soundEnabled) return;
    [400, 300, 200].forEach((f, i) => {
      setTimeout(() => playBeep(f, 0.2, 'sawtooth', 0.15), i * 120);
    });
  };
  window.PH.playMove  = () => playBeep(440, 0.05, 'square', 0.08);
  window.PH.playMatch = () => playBeep(660, 0.12, 'sine', 0.15);
  window.PH.playError = () => playBeep(200, 0.15, 'sawtooth', 0.12);
  window.PH.isSoundOn = () => state.soundEnabled;

  // === SOUND TOGGLE ===
  function initSoundToggle() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    updateSoundBtn(btn);
    btn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem('ph_sound', state.soundEnabled);
      updateSoundBtn(btn);
      if (state.soundEnabled) window.PH.playClick();
    });
  }

  function updateSoundBtn(btn) {
    btn.textContent = state.soundEnabled ? '🔊' : '🔇';
    btn.classList.toggle('muted', !state.soundEnabled);
  }

  // === CLICK RIPPLE ===
  function initRipples() {
    document.addEventListener('click', (e) => {
      const ripple = document.createElement('div');
      ripple.className = 'ripple';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top = e.clientY + 'px';
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  }

  // === CARD CLICK SOUNDS ===
  function initCardSounds() {
    document.querySelectorAll('[data-sound="click"]').forEach(el => {
      el.addEventListener('click', () => window.PH.playClick());
    });
  }

  // === SCREEN SHAKE ===
  window.PH.shake = function () {
    const el = document.body;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 400);
  };

  // === BACK BUTTON SOUND ===
  function initBackBtns() {
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => window.PH.playClick());
    });
  }

  // ============================================================
  // SUPABASE SETUP
  // Re-uses PH.initSupabase() from games.js (already defined).
  // Falls back to creating a new client if games.js is absent.
  // ============================================================
  function initSupabase() {
    // If games.js already initialised it, just return the client
    if (window.PH && window.PH.supabase) return window.PH.supabase;
    // Otherwise initialise via the shared helper (or directly here)
    if (window.PH && window.PH.initSupabase) return window.PH.initSupabase();
    // Last-resort direct init (index.html always has the CDN tag)
    const supabaseUrl = "https://fkfkqpyikvshnphongfj.supabase.co";
    const supabaseKey = "sb_publishable_mnc_H-RlH2q5BdlsoO1pqQ_aeQZRjVF";
    const sb = window.supabase.createClient(supabaseUrl, supabaseKey);
    window.PH.supabase = sb;
    return sb;
  }

  // ============================================================
  // SUPABASE AUTH
  // ============================================================
  function openModal(id)  { document.getElementById(id).classList.add('active'); }
  function closeModal(id) { document.getElementById(id).classList.remove('active'); }

  function setAuthMsg(elId, msg, isError) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.className = 'auth-msg ' + (isError ? 'error' : 'success');
  }

  function setAuthUI(user) {
    const loggedOut = document.getElementById('auth-logged-out');
    const loggedIn  = document.getElementById('auth-logged-in');
    const emailEl   = document.getElementById('auth-email-display');
    if (!loggedOut || !loggedIn) return;
    if (user) {
      loggedOut.style.display = 'none';
      loggedIn.style.display  = 'flex';
      if (emailEl) emailEl.textContent = user.email;
      window.PH.currentUser = user;
    } else {
      loggedOut.style.display = 'flex';
      loggedIn.style.display  = 'none';
      window.PH.currentUser = null;
    }
    setMobileAuthUI(user);
  }

  function initAuthTabs() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('auth-form-' + tab.dataset.tab).classList.add('active');
        setAuthMsg('login-msg', '', false);
        setAuthMsg('reg-msg', '', false);
      });
    });
  }

  function openLoginModal() {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'login'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === 'auth-form-login'));
    openModal('auth-modal');
  }

  function openRegisterModal() {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'register'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === 'auth-form-register'));
    openModal('auth-modal');
  }

  // Friendly error messages — hide technical Supabase jargon from players
  function friendlyAuthError(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong password')) {
      return 'WRONG EMAIL OR PASSWORD';
    }
    if (m.includes('email not confirmed')) {
      return 'WRONG EMAIL OR PASSWORD'; // disguise — user will be auto-confirmed on register
    }
    if (m.includes('user already registered') || m.includes('already been registered')) {
      return 'EMAIL ALREADY IN USE';
    }
    if (m.includes('rate limit') || m.includes('too many')) {
      return 'TOO MANY ATTEMPTS. WAIT & RETRY.';
    }
    if (m.includes('network') || m.includes('fetch')) {
      return 'NETWORK ERROR. CHECK CONNECTION.';
    }
    return msg.toUpperCase().substring(0, 60);
  }

  async function handleLogin() {
    const sb = window.PH.supabase;
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { setAuthMsg('login-msg', 'FILL IN ALL FIELDS', true); return; }

    const btn = document.getElementById('btn-login-submit');
    btn.disabled = true;
    btn.textContent = 'LOGGING IN...';
    setAuthMsg('login-msg', '', false);

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    btn.textContent = '▶ LOGIN';

    if (error) {
      setAuthMsg('login-msg', friendlyAuthError(error.message), true);
    } else {
      setAuthMsg('login-msg', 'WELCOME BACK! ' + data.user.email.split('@')[0].toUpperCase(), false);
      setAuthUI(data.user);
      setTimeout(() => closeModal('auth-modal'), 900);
    }
  }

  async function handleRegister() {
    const sb = window.PH.supabase;
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    if (!email || !password) { setAuthMsg('reg-msg', 'FILL IN ALL FIELDS', true); return; }
    if (password.length < 6)  { setAuthMsg('reg-msg', 'PASSWORD TOO SHORT (MIN 6)', true); return; }

    const btn = document.getElementById('btn-register-submit');
    btn.disabled = true;
    btn.textContent = 'CREATING...';
    setAuthMsg('reg-msg', '', false);

    // Step 1: Sign up
    const { data: signUpData, error: signUpError } = await sb.auth.signUp({ email, password });

    if (signUpError) {
      btn.disabled = false;
      btn.textContent = '▶ CREATE ACCOUNT';
      setAuthMsg('reg-msg', friendlyAuthError(signUpError.message), true);
      return;
    }

    // Detect "email already registered" — Supabase returns a fake user with no identities
    if (signUpData.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
      btn.disabled = false;
      btn.textContent = '▶ CREATE ACCOUNT';
      setAuthMsg('reg-msg', 'EMAIL ALREADY IN USE', true);
      return;
    }

    // Step 2: Auto-login immediately after signup
    // This works regardless of whether "email confirmation" is enabled in Supabase,
    // because Supabase allows signInWithPassword right after signUp even before confirmation
    // when using the anon/publishable key with password auth.
    setAuthMsg('reg-msg', 'ACCOUNT CREATED! LOGGING IN...', false);

    const { data: loginData, error: loginError } = await sb.auth.signInWithPassword({ email, password });

    btn.disabled = false;
    btn.textContent = '▶ CREATE ACCOUNT';

    if (loginError) {
      // Sign-up succeeded but auto-login failed (e.g. email confirm still required)
      // Show a clear, helpful message instead of a confusing error
      setAuthMsg('reg-msg', 'ACCOUNT CREATED! PLEASE LOGIN.', false);
      // Switch to login tab after a short delay
      setTimeout(() => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'login'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.toggle('active', f.id === 'auth-form-login'));
        document.getElementById('login-email').value = email;
        setAuthMsg('login-msg', 'ACCOUNT READY — ENTER YOUR PASSWORD', false);
        setAuthMsg('reg-msg', '', false);
      }, 1800);
    } else {
      // Auto-login succeeded ✅
      setAuthMsg('reg-msg', 'WELCOME, ' + loginData.user.email.split('@')[0].toUpperCase() + '!', false);
      setAuthUI(loginData.user);
      setTimeout(() => closeModal('auth-modal'), 1000);
    }
  }

  async function handleLogout() {
    await window.PH.supabase.auth.signOut();
    setAuthUI(null);
  }

  function initAuth() {
    const sb = window.PH.supabase;

    // Restore session on page load
    sb.auth.getSession().then(({ data: { session } }) => {
      setAuthUI(session ? session.user : null);
    });

    // Keep UI in sync when auth state changes (tab switches, token refresh, etc.)
    sb.auth.onAuthStateChange((_event, session) => {
      setAuthUI(session ? session.user : null);
    });

    const btnOpenLogin    = document.getElementById('btn-open-login');
    const btnOpenRegister = document.getElementById('btn-open-register');
    const btnLogout       = document.getElementById('btn-logout');
    const authModalClose  = document.getElementById('auth-modal-close');

    if (btnOpenLogin)    btnOpenLogin.addEventListener('click',    openLoginModal);
    if (btnOpenRegister) btnOpenRegister.addEventListener('click', openRegisterModal);
    if (btnLogout)       btnLogout.addEventListener('click',       handleLogout);
    if (authModalClose)  authModalClose.addEventListener('click',  () => closeModal('auth-modal'));

    const loginSubmit = document.getElementById('btn-login-submit');
    const regSubmit   = document.getElementById('btn-register-submit');
    if (loginSubmit) loginSubmit.addEventListener('click', handleLogin);
    if (regSubmit)   regSubmit.addEventListener('click',   handleRegister);

    const loginEmail = document.getElementById('login-email');
    const loginPw    = document.getElementById('login-password');
    const regPw      = document.getElementById('reg-password');
    if (loginEmail) loginEmail.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    if (loginPw)    loginPw.addEventListener('keydown',    e => { if (e.key === 'Enter') handleLogin(); });
    if (regPw)      regPw.addEventListener('keydown',      e => { if (e.key === 'Enter') handleRegister(); });

    document.getElementById('auth-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('auth-modal')) closeModal('auth-modal');
    });
  }

  // ============================================================
  // SUPABASE LEADERBOARD
  // ============================================================
  let currentLbGame = 'all';

  // Extract a display name from a score row.
  // Priority: email column > user_id (UUID fallback)
  function playerName(row) {
    if (row.email) {
      return row.email.split('@')[0].substring(0, 12).toUpperCase();
    }
    if (row.user_id) {
      return row.user_id.substring(0, 8).toUpperCase();
    }
    return 'ANON';
  }

  async function loadLeaderboard(game) {
    currentLbGame = game;
    const sb = window.PH.supabase;
    const wrap = document.getElementById('lb-table-wrap');
    if (!wrap) return;

    wrap.innerHTML = '<div class="lb-loading">LOADING SCORES...</div>';

    let query = sb
      .from('scores')
      .select('user_id, email, game, score, created_at')
      .order('score', { ascending: false })
      .limit(10);

    if (game && game !== 'all') query = query.eq('game', game);

    const { data, error } = await query;

    if (error) {
      wrap.innerHTML = '<div class="lb-empty">ERROR LOADING SCORES</div>';
      return;
    }
    if (!data || data.length === 0) {
      wrap.innerHTML = '<div class="lb-empty">NO SCORES YET.<br>BE THE FIRST!</div>';
      return;
    }

    let html = `<table class="lb-table">
      <thead><tr>
        <th>#</th>
        <th>PLAYER</th>
        ${game === 'all' ? '<th>GAME</th>' : ''}
        <th>SCORE</th>
      </tr></thead><tbody>`;

    data.forEach((row, i) => {
      const rankClass = i === 0 ? 'lb-rank-1' : i === 1 ? 'lb-rank-2' : i === 2 ? 'lb-rank-3' : '';
      const badge     = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      html += `<tr class="${rankClass}">
        <td>${badge}</td>
        <td>${playerName(row)}</td>
        ${game === 'all' ? `<td>${(row.game || '?').toUpperCase()}</td>` : ''}
        <td>${row.score.toLocaleString()}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function initLeaderboard() {
    const btnOpen  = document.getElementById('btn-open-leaderboard');
    const btnClose = document.getElementById('lb-modal-close');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        openModal('leaderboard-modal');
        loadLeaderboard(currentLbGame);
      });
    }
    if (btnClose) {
      btnClose.addEventListener('click', () => closeModal('leaderboard-modal'));
    }

    document.getElementById('leaderboard-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('leaderboard-modal')) closeModal('leaderboard-modal');
    });

    document.querySelectorAll('.lb-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lb-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadLeaderboard(btn.dataset.game);
      });
    });
  }

  window.PH.openLeaderboard = function (game) {
    if (game) {
      document.querySelectorAll('.lb-filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.game === game);
      });
    }
    openModal('leaderboard-modal');
    loadLeaderboard(game || 'all');
  };


  // ============================================================
  // MOBILE HAMBURGER MENU
  // ============================================================
  function initMobileMenu() {
    const hamburger   = document.getElementById('hamburger-btn');
    const menu        = document.getElementById('mobile-menu');
    const overlay     = document.getElementById('mobile-overlay');
    const closeBtn    = document.getElementById('mobile-menu-close');
    const mobSound    = document.getElementById('mob-sound-toggle');

    if (!hamburger || !menu) return;
    if (!overlay) { console.warn('[SkyWorld] mobile-overlay not found'); }

    function openMenu() {
      menu.classList.add('open');
      if (overlay) overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      menu.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);

    // Mobile auth buttons — reuse the same handlers as desktop
    const mobLogin    = document.getElementById('mob-btn-login');
    const mobRegister = document.getElementById('mob-btn-register');
    const mobLogout   = document.getElementById('mob-btn-logout');
    const mobLb       = document.getElementById('mob-btn-leaderboard');

    if (mobLogin)    mobLogin.addEventListener('click',    () => { closeMenu(); openLoginModal(); });
    if (mobRegister) mobRegister.addEventListener('click', () => { closeMenu(); openRegisterModal(); });
    if (mobLogout)   mobLogout.addEventListener('click',   () => { closeMenu(); handleLogout(); });
    if (mobLb)       mobLb.addEventListener('click',       () => {
      closeMenu();
      openModal('leaderboard-modal');
      loadLeaderboard(currentLbGame);
    });

    // Mobile sound toggle — keep in sync with desktop toggle
    if (mobSound) {
      mobSound.addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        localStorage.setItem('ph_sound', state.soundEnabled);
        mobSound.textContent = state.soundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
        const desktopBtn = document.getElementById('sound-toggle');
        if (desktopBtn) updateSoundBtn(desktopBtn);
        if (state.soundEnabled) window.PH.playClick();
      });
    }
  }

  // Keep mobile menu auth state in sync with desktop
  function setMobileAuthUI(user) {
    const mobOut   = document.getElementById('mob-logged-out');
    const mobIn    = document.getElementById('mob-logged-in');
    const mobEmail = document.getElementById('mob-email-display');
    if (!mobOut || !mobIn) return;
    if (user) {
      mobOut.style.display = 'none';
      mobIn.style.display  = 'block';
      if (mobEmail) mobEmail.textContent = user.email;
    } else {
      mobOut.style.display = 'block';
      mobIn.style.display  = 'none';
    }
  }

  // ============================================================
  // INIT
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    initSupabase(); // ensures PH.supabase is set before auth/leaderboard
    runLoadingScreen();
    initParticles();
    initSoundToggle();
    initRipples();
    initCardSounds();
    initBackBtns();
    initAuthTabs();
    initAuth();
    initLeaderboard();
    initMobileMenu();

    document.addEventListener('click', () => {
      if (!state.musicStarted) {
        try { getAudioCtx().resume(); } catch (e) {}
        state.musicStarted = true;
      }
    }, { once: true });
  });

})();
