// ============================================================
// ui.js — DOM rendering for all 5 screens + sign-up flow.
// State changes happen in game.js; this file only reads + renders.
// ============================================================

'use strict';

const g = window.game;
let currentScreen = 'home';
let battleAnimating = false;

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  const loaded = g.bootGame();

  // ?help=<base64> URL → enter friend-help mode regardless of save state
  const params = new URLSearchParams(location.search);
  const helpPayload = params.get('help');
  if (helpPayload) {
    enterHelpMode(helpPayload);
    return;
  }

  // Boot flow:
  //   1. No account selected:
  //        - if there ARE accounts on this device → show Login screen
  //        - if zero accounts → show Landing page → tap Play → Login (Sign Up tab)
  //   2. Account selected, save exists → into the app.
  if (!loaded) {
    if (g.listAccounts().length === 0) showLanding();
    else showLogin();
  } else {
    showApp();
  }

  // Wire bottom-nav
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });

  // Help-mode UI doesn't need the tick
  // ------------------------------------------------------------

  // Tick loop — 1s for live countdowns.
  // Don't disrupt the user if they're typing into a form field
  // (admin tables especially) — wholesale innerHTML replacement
  // would steal focus and discard in-progress edits.
  setInterval(() => {
    if (!g.state) return;
    g.tickDecay();
    // Fire any due NPC chat replies
    g.processNpcReplies();
    const ae = document.activeElement;
    const isEditing = ae && (
      ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT'
    );
    // Don't disrupt: user typing in any input, or a battle animating in
    // the battle screen — both would lose the in-flight DOM state.
    if (isEditing || battleAnimating) {
      renderHeader();
    } else {
      renderActiveScreen();
    }
  }, 1000);

  // Wire landing page CTA
  document.getElementById('landing-play-btn')?.addEventListener('click', () => showLogin('signup'));

  // Wire login screen
  document.getElementById('login-back-btn')?.addEventListener('click', () => {
    if (g.listAccounts().length === 0) showLanding();
    else { document.getElementById('login-screen').style.display = 'none'; showLanding(); }
  });
  document.querySelectorAll('.login-tab').forEach(t => {
    t.addEventListener('click', () => switchLoginTab(t.dataset.loginTab));
  });

  // Wire signup form
  document.getElementById('sign-up-btn')?.addEventListener('click', handleSignUp);
  document.getElementById('display-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSignUp();
  });
  document.getElementById('reset-btn')?.addEventListener('click', handleReset);

  // Header logout
  document.getElementById('hdr-logout')?.addEventListener('click', () => {
    g.signOut();
    location.reload();
  });
});

function handleSignUp() {
  const input = document.getElementById('display-name-input');
  const name = (input?.value || '').trim() || 'Trainer';
  try {
    const acct = g.createAccount(name);
    g.switchAccount(acct.id);
    g.newGame(name);
    showApp();
  } catch (e) { alert(e.message); }
}

function handleReset() {
  if (!confirm('Reset game? This wipes all progress.')) return;
  g.resetGame();
  location.reload();
}

// ------------------------------------------------------------
// Screen switching
// ------------------------------------------------------------

function hideAllOuterScreens() {
  ['landing-screen','login-screen','app','sign-up-screen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function showLanding() {
  hideAllOuterScreens();
  document.getElementById('landing-screen').style.display = 'flex';
}

function showLogin(tab = 'signin') {
  hideAllOuterScreens();
  document.getElementById('login-screen').style.display = 'flex';
  // If there are zero accounts, force signup tab
  const tabs = document.querySelectorAll('.login-tab');
  if (g.listAccounts().length === 0) tab = 'signup';
  switchLoginTab(tab);
  renderAccountList();
}

function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.loginTab === tab);
  });
  document.getElementById('login-signin-panel').style.display = tab === 'signin' ? 'block' : 'none';
  document.getElementById('login-signup-panel').style.display = tab === 'signup' ? 'block' : 'none';
}

function renderAccountList() {
  const root = document.getElementById('account-list');
  const accounts = g.listAccounts();
  if (accounts.length === 0) {
    root.innerHTML = '<p class="muted small">No accounts yet — tap "Sign Up" to create one.</p>';
    return;
  }
  root.innerHTML = accounts.map(a => {
    const save = g.loadStateForAccount(a.id);
    const monsters = save?.monsters?.length || 0;
    const coins = save?.player?.coins || 0;
    return `
      <button class="account-row" data-acct-id="${a.id}">
        <div class="account-avatar">${a.isAdmin ? '👑' : '🦒'}</div>
        <div class="account-meta">
          <div class="account-name">${escapeHtml(a.displayName)}${a.isAdmin ? ' <span class="admin-pill">admin</span>' : ''}</div>
          <div class="account-sub">${monsters} pet${monsters === 1 ? '' : 's'} · 🪙 ${coins}</div>
        </div>
        <span class="account-delete" data-acct-delete="${a.id}" title="Delete account">✕</span>
      </button>
    `;
  }).join('');

  root.querySelectorAll('.account-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.dataset.acctDelete) return;
      const id = btn.dataset.acctId;
      g.switchAccount(id);
      g.bootGame();
      showApp();
    });
  });
  root.querySelectorAll('.account-delete').forEach(x => {
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = x.dataset.acctDelete;
      const acct = g.listAccounts().find(a => a.id === id);
      if (!acct) return;
      if (!confirm(`Delete "${acct.displayName}" and their save? This cannot be undone.`)) return;
      g.deleteAccount(id);
      renderAccountList();
    });
  });
}

function showSignUp() {  // legacy alias used by some older paths
  showLogin('signup');
}

function showApp() {
  document.getElementById('sign-up-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  // If no pet yet, force starter picker
  const hasMonster = g.state.monsters.length > 0;
  switchScreen(hasMonster ? 'home' : 'starter');
}

function switchScreen(name) {
  currentScreen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name)?.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === name);
  });
  renderActiveScreen();
}

function renderActiveScreen() {
  renderHeader();
  switch (currentScreen) {
    case 'starter':   renderStarter();   break;
    case 'home':      renderHome();      break;
    case 'farm':      renderFarm();      break;
    case 'training':  renderTraining();  break;
    case 'event':     renderEvent();     break;
    case 'collection':renderCollection();break;
    case 'shop':      renderShop();      break;
    case 'eggs':      switchScreen('collection'); collectionTab = 'eggs'; break;
    case 'battle':    renderBattle();    break;
    case 'admin':     renderAdmin();     break;
    case 'friends':   renderFriends();   break;
  }
}

// ------------------------------------------------------------
// Header — currency bar
// ------------------------------------------------------------

function renderHeader() {
  const p = g.state.player;
  document.getElementById('hdr-name').textContent = p.name;
  const adminBtn = document.getElementById('hdr-admin');
  if (adminBtn && !adminBtn._wired) {
    adminBtn._wired = true;
    adminBtn.addEventListener('click', () => switchScreen('admin'));
  }
  document.getElementById('hdr-coins').textContent    = formatNum(p.coins);
  document.getElementById('hdr-gems').textContent     = formatNum(p.gems);
  document.getElementById('hdr-stardust').textContent = formatNum(p.stardust);
  document.getElementById('hdr-tickets').textContent  = formatNum(p.tickets);
  document.getElementById('hdr-trophies').textContent = p.trophies;
  document.getElementById('hdr-fragments').textContent= p.fragments;
}

function formatNum(n) {
  if (n >= 10000) return (n/1000).toFixed(1) + 'k';
  return String(Math.floor(n));
}

// ------------------------------------------------------------
// Starter picker
// ------------------------------------------------------------

function renderStarter() {
  const root = document.getElementById('screen-starter');
  const starters = g.SPECIES.filter(s => s.isStarter);
  root.innerHTML = `
    <h2 class="screen-title">Pick your first pet!</h2>
    <p class="screen-sub">Your starter is yours forever — it can never be traded away.</p>
    <div class="starter-grid">
      ${starters.map(s => `
        <button class="starter-card" data-species="${s.id}">
          <div class="starter-emoji">${s.emoji}</div>
          <div class="starter-name">${s.name}</div>
          <div class="starter-element">${g.ELEMENT[s.element].emoji} ${g.ELEMENT[s.element].label}</div>
          <div class="starter-stats">
            HP ${s.baseStats.hp}<br>
            ATK ${s.baseStats.atk}<br>
            DEF ${s.baseStats.def}
          </div>
        </button>
      `).join('')}
    </div>
  `;
  root.querySelectorAll('.starter-card').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        g.claimStarter(Number(btn.dataset.species));
        switchScreen('home');
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

// ------------------------------------------------------------
// Home — active pet + care buttons
// ------------------------------------------------------------

function renderHome() {
  const root = document.getElementById('screen-home');
  const pet = g.getActivePet();
  if (!pet) {
    root.innerHTML = '<p class="muted center">No active pet — pick one from your Collection.</p>';
    return;
  }
  const sp = g.species(pet.speciesId);
  const rar = g.RARITY[sp.rarity];
  const mood = pet.mood;
  const moodFace = mood > 70 ? '😊' : mood > 40 ? '😐' : '😢';

  // Inventory chips — group items by what they DO, not by raw type,
  // so harvested crops appear next to shop-bought food.
  // Rules:
  //   Feed   = any 'food' or 'crop' item (crops are always edible)
  //   Clean  = any item with cleanliness effect
  //   Energy = any item with energy effect (e.g. Energy Drink)
  //   Toys   = type 'toy'
  // An item can appear in multiple groups if it heals multiple needs.
  const inv = Object.entries(g.state.inventory);
  const hasEffect = (id, key) => (g.ITEM_BY_ID[id]?.effect?.[key] ?? 0) > 0;
  const foods   = inv.filter(([id]) => {
    const t = g.ITEM_BY_ID[id]?.type;
    return t === 'food' || t === 'crop' || hasEffect(id, 'hunger');
  });
  const cleans  = inv.filter(([id]) => hasEffect(id, 'cleanliness'));
  const energys = inv.filter(([id]) => hasEffect(id, 'energy'));
  const toys    = inv.filter(([id]) => g.ITEM_BY_ID[id]?.type === 'toy');

  const activeEvent = g.getActiveEvent();
  const allQuestsDone = activeEvent && activeEvent.quests.every(q =>
    g.eventProgress(activeEvent.id, q.id) >= q.goal
  );

  root.innerHTML = `
    ${activeEvent ? `
      <button class="event-banner" data-go="event">
        <span class="event-banner-emoji">${activeEvent.emoji}</span>
        <span class="event-banner-text">
          <span class="event-banner-title">${activeEvent.name}</span>
          <span class="event-banner-sub">${allQuestsDone ? '🎁 All quests complete — claim your Mythic Egg!' : 'Complete quests for rewards →'}</span>
        </span>
      </button>
    ` : ''}

    <div class="hub-quick-grid">
      <button class="hub-quick" data-go="farm">
        <div class="hub-emoji">🌱</div>
        <div class="hub-label">Farm</div>
      </button>
      <button class="hub-quick" data-go="training">
        <div class="hub-emoji">💪</div>
        <div class="hub-label">Train</div>
      </button>
    </div>

    <div class="pet-card" style="--rarity:${rar.color}; --glow:${rar.glow}">
      <div class="pet-emoji${pet.isShiny ? ' shiny' : ''}">${petArt(sp, 200)}${pet.isShiny ? '<span class="shiny-spark">✨</span>' : ''}</div>
      <div class="pet-name">${sp.name}${pet.isStarter ? ' ⭐' : ''}</div>
      <div class="pet-element">${g.ELEMENT[sp.element].emoji} ${g.ELEMENT[sp.element].label} · <span class="rarity-chip" style="color:${rar.color}">${rar.label}</span></div>
      <div class="pet-mood">${moodFace} Mood ${mood}/100</div>
      <div class="pet-stats">ATK ${pet.atk} · DEF ${pet.def} · SPD ${pet.spd} · INT ${pet.intl} · HP ${pet.hp}</div>
    </div>

    <div class="needs-grid">
      ${needBar('🍖 Hunger',      pet.hunger,      'hunger')}
      ${needBar('🧼 Cleanliness', pet.cleanliness, 'clean')}
      ${needBar('⚡ Energy',       pet.energy,      'energy')}
    </div>

    ${g.isSleeping(pet) ? renderSleepStatus(pet) : ''}

    <div class="actions-grid">
      ${actionGroup('🍖 Feed',   foods,   'food')}
      ${actionGroup('🧼 Clean',  cleans,  'clean')}
      ${actionGroup('⚡ Energy', energys, 'energy')}
      ${actionGroup('🧸 Toys',   toys,    'toy')}
      <button class="action-btn solo ${g.isSleeping(pet) ? 'sleeping' : ''}" id="sleep-btn">
        ${g.isSleeping(pet) ? '⏰ Wake up' : '😴 Sleep'}
        <span class="action-sub">${g.isSleeping(pet) ? 'tap to end' : '+1 Energy / 10 min'}</span>
      </button>
      <button class="action-btn solo" id="play-bare-btn">🎾 Play<span class="action-sub">+10 Mood</span></button>
      <button class="action-btn solo" id="pet-btn">🤚 Pet<span class="action-sub">+2 Mood</span></button>
    </div>

    <div class="muted center small">All your pets:</div>
    <div class="mini-collection">
      ${g.state.monsters.map(m => {
        const s = g.species(m.speciesId);
        const r = g.RARITY[s.rarity];
        const active = m.id === g.state.activePetId;
        return `
          <button class="mini-mon ${active ? 'active' : ''}" data-mid="${m.id}" style="border-color:${r.color}">
            <span class="mini-emoji">${s.emoji}${m.isShiny ? '✨' : ''}</span>
            <span class="mini-name">${s.name}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  document.getElementById('sleep-btn').onclick     = () => { try { g.sleepPet(); renderHome(); } catch (e) { alert(e.message); } };
  document.getElementById('play-bare-btn').onclick = () => { try { g.playWithPet(); renderHome(); } catch (e) { alert(e.message); } };
  document.getElementById('pet-btn').onclick       = () => { try { g.petPet(); renderHome(); } catch (e) { alert(e.message); } };

  root.querySelectorAll('.use-item').forEach(btn => {
    btn.addEventListener('click', () => {
      try { g.useItem(Number(btn.dataset.itemId)); renderHome(); }
      catch (e) { alert(e.message); }
    });
  });

  root.querySelectorAll('.mini-mon').forEach(btn => {
    btn.addEventListener('click', () => {
      g.setActivePet(btn.dataset.mid);
      renderHome();
    });
  });

  root.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.go));
  });
}

// ------------------------------------------------------------
// Farm
// ------------------------------------------------------------

function renderFarm() {
  const root = document.getElementById('screen-farm');
  const seeds = Object.entries(g.state.inventory)
    .filter(([id]) => g.ITEM_BY_ID[id]?.type === 'seed');
  const crops = Object.entries(g.state.inventory)
    .filter(([id]) => g.ITEM_BY_ID[id]?.type === 'crop');

  root.innerHTML = `
    <button class="back-btn" data-go="home">← Home</button>
    <h2 class="screen-title">🌱 Farm</h2>
    <p class="screen-sub">Plant seeds, water for +1 yield, harvest when ready.</p>

    <div class="farm-grid">
      ${g.state.farmPlots.map(plot => renderPlot(plot)).join('')}
    </div>

    <div class="farm-help-row">
      <button class="help-action-btn" id="get-help-btn">🔗 Get help (share link)</button>
      <button class="help-action-btn" id="claim-help-btn">📬 Enter claim code</button>
    </div>

    <h3 class="shop-section-title">Seeds in inventory</h3>
    <div class="seed-bar">
      ${seeds.length === 0 ? '<div class="muted small">No seeds — buy some in the Shop.</div>' : seeds.map(([id, qty]) => {
        const s = g.ITEM_BY_ID[id];
        return `<div class="seed-chip">${s.emoji} ${s.name} <b>x${qty}</b> <span class="muted small">(${formatGrow(s.effect.grow_seconds)})</span></div>`;
      }).join('')}
    </div>

    ${crops.length > 0 ? `
      <h3 class="shop-section-title">Harvested crops</h3>
      <div class="crops-grid">
        ${crops.map(([id, qty]) => {
          const c = g.ITEM_BY_ID[id];
          const sellPrices = { 201: 5, 202: 25, 203: 80, 204: 200, 205: 600 };
          return `
            <div class="crop-card">
              <div class="crop-emoji">${c.emoji}</div>
              <div class="crop-name">${c.name}</div>
              <div class="crop-qty">x${qty}</div>
              <button class="sell-crop" data-id="${id}" data-qty="${qty}">Sell all (+${(sellPrices[id]||5)*qty}🪙)</button>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}
  `;

  // Plot click handlers
  root.querySelectorAll('.farm-plot').forEach(el => {
    const idx = Number(el.dataset.idx);
    const plot = g.state.farmPlots[idx];
    el.addEventListener('click', () => {
      if (!plot.seedItemId) {
        // Plant something
        if (seeds.length === 0) { alert('No seeds — buy from Shop.'); return; }
        showPlantPicker(idx, seeds);
      } else if (Date.now() >= plot.readyAt) {
        // Harvest
        try {
          const { cropItemId, qty } = g.harvestPlot(idx);
          showToast(`Harvested +${qty} ${g.ITEM_BY_ID[cropItemId].name}!`);
          renderFarm();
        } catch (e) { alert(e.message); }
      } else if (!plot.wateredAt) {
        // Water
        try { g.waterPlot(idx); showToast('Watered 💧 +10% faster, +1 yield'); renderFarm(); }
        catch (e) { alert(e.message); }
      }
    });
  });

  root.querySelectorAll('.sell-crop').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      try {
        const got = g.sellCrop(Number(btn.dataset.id), Number(btn.dataset.qty));
        showToast(`+${got} 🪙`);
        renderFarm();
      } catch (e) { alert(e.message); }
    });
  });

  root.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.go));
  });

  document.getElementById('get-help-btn').onclick = () => {
    // Pick the first growing plot
    const plot = g.state.farmPlots.find(p => p.seedItemId && Date.now() < p.readyAt);
    if (!plot) { alert('Plant a seed first, then your friends can help water it.'); return; }
    showShareHelpModal(plot.idx);
  };
  document.getElementById('claim-help-btn').onclick = () => {
    const code = prompt('Paste the claim code your friend sent:');
    if (!code) return;
    try {
      const r = g.claimHelpCode(code);
      showToast(`✅ Plot #${r.plotIndex + 1}: -${r.minutesOff} min off the timer!`);
      renderFarm();
    } catch (e) { alert(e.message); }
  };
}

function showShareHelpModal(plotIdx) {
  let url, code;
  try {
    const r = g.issueHelpLinkForPlot(plotIdx);
    code = r.code;
    url = `${location.origin}${location.pathname}?help=${encodeURIComponent(r.payload)}`;
  } catch (e) { alert(e.message); return; }

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card share-help-modal">
      <div class="modal-title">🔗 Share help link</div>
      <p>Send this link to a friend. They open it, tap "Water it!", and send the claim code back to you.</p>
      <input class="share-link-input" id="share-link-input" readonly value="${url}">
      <button id="copy-share-link" class="big-btn">📋 Copy link</button>
      <p class="muted small" style="margin-top:8px">Claim code (will appear on their side): <code>${code}</code></p>
      <button class="modal-close-btn" id="share-help-close">Done</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('copy-share-link').onclick = async () => {
    const inp = document.getElementById('share-link-input');
    inp.select();
    try { await navigator.clipboard.writeText(url); document.getElementById('copy-share-link').textContent = '✅ Copied'; }
    catch { document.execCommand('copy'); }
  };
  document.getElementById('share-help-close').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function renderPlot(plot) {
  if (!plot.seedItemId) {
    return `<button class="farm-plot empty" data-idx="${plot.idx}"><span class="plot-emoji">🟫</span><span class="plot-label">Empty</span></button>`;
  }
  const seed = g.ITEM_BY_ID[plot.seedItemId];
  const cropEmoji = g.ITEM_BY_ID[seed.effect.crop_item]?.emoji || '🌱';
  const remaining = Math.max(0, plot.readyAt - Date.now());
  if (remaining === 0) {
    return `<button class="farm-plot ready" data-idx="${plot.idx}"><span class="plot-emoji wiggle">${cropEmoji}</span><span class="plot-label">Harvest!</span></button>`;
  }
  const growthPct = 100 - Math.round((remaining / (seed.effect.grow_seconds * 1000)) * 100);
  const stage = growthPct < 40 ? '🌱' : growthPct < 80 ? '🌿' : cropEmoji;
  const wateredIcon = plot.wateredAt ? '💧' : '';
  return `
    <button class="farm-plot growing" data-idx="${plot.idx}">
      <span class="plot-emoji">${stage}${wateredIcon}</span>
      <span class="plot-label">${formatGrow(remaining/1000)}</span>
      <span class="plot-progress"><span class="plot-fill" style="width:${growthPct}%"></span></span>
    </button>
  `;
}

/** Debounce: returns a wrapper that calls `fn` only after `ms` of inactivity. */
function debounce(fn, ms) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Returns HTML for a pet's portrait — uses real chibi art if available,
 * falls back to the emoji if the image can't load.
 *   petArt(species, size, opts)
 *     size : pixel size of the rendered art (defaults 96)
 *     opts.classes : extra CSS classes
 *
 * Filename convention: web-game/assets/pets/{id:02}-{name-lower}.png
 * Generated by scripts/generate-pet-art.ps1 via Pollinations.ai
 */
function petArt(s, size = 96, opts = {}) {
  if (!s) return '';
  const fn = `${String(s.id).padStart(2, '0')}-${s.name.toLowerCase()}.png`;
  const cls = ['pet-img', opts.classes || ''].filter(Boolean).join(' ');
  // onerror swaps to an emoji span if the file isn't found yet (during partial generation)
  const safeEmoji = (s.emoji || '🐾').replace(/'/g, '&#39;');
  return `<img src="assets/pets/${fn}" alt="${s.name}" class="${cls}"
               style="width:${size}px;height:${size}px"
               onerror="this.outerHTML='<span class=&quot;pet-emoji-fallback&quot; style=&quot;font-size:${Math.round(size*0.9)}px&quot;>${safeEmoji}</span>'">`;
}

/**
 * Human-readable duration like "30 minutes", "2 hours", "3 days".
 * Used in shop displays where DD:HH:MM:SS is too dense.
 */
function formatHumanDuration(sec) {
  sec = Math.max(0, Math.floor(sec));
  if (sec < 60)    return `${sec} second${sec === 1 ? '' : 's'}`;
  if (sec < 3600)  { const m = Math.round(sec / 60); return `${m} minute${m === 1 ? '' : 's'}`; }
  if (sec < 86400) { const h = Math.round(sec / 3600); return `${h} hour${h === 1 ? '' : 's'}`; }
  const d = Math.round(sec / 86400);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/** DD:HH:MM:SS clock format. Always 4 fields, 2 digits each. */
function formatDuration(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return `${p(d)}:${p(h)}:${p(m)}:${p(s)}`;
}
// alias kept for any old callers
const formatGrow = formatDuration;

function showPlantPicker(plotIdx, seeds) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 360px;">
      <div class="modal-title">Plant a seed</div>
      <div class="plant-picker">
        ${seeds.map(([id, qty]) => {
          const s = g.ITEM_BY_ID[id];
          return `<button class="plant-pick-btn" data-id="${id}">${s.emoji} ${s.name} <span class="muted">x${qty} · ${formatGrow(s.effect.grow_seconds)}</span></button>`;
        }).join('')}
      </div>
      <button class="modal-close-btn">Cancel</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelectorAll('.plant-pick-btn').forEach(b => {
    b.addEventListener('click', () => {
      try {
        g.plantSeed(plotIdx, Number(b.dataset.id));
        modal.remove();
        showToast('Planted 🌱');
        renderFarm();
      } catch (e) { alert(e.message); }
    });
  });
}

// ------------------------------------------------------------
// Training
// ------------------------------------------------------------

let trainingPetId = null;  // currently-selected pet for training

function renderTraining() {
  const root = document.getElementById('screen-training');
  const monsters = g.state.monsters || [];
  if (monsters.length === 0) { root.innerHTML = '<p class="muted center">No pets yet — hatch one first!</p>'; return; }

  // Pick a default training pet if none selected (or if the previous one was traded/lost)
  if (!trainingPetId || !monsters.find(m => m.id === trainingPetId)) {
    trainingPetId = g.state.activePetId || monsters[0].id;
  }
  const pet = monsters.find(m => m.id === trainingPetId);
  const sp  = g.species(pet.speciesId);
  const now = Date.now();

  root.innerHTML = `
    <button class="back-btn" data-go="home">← Home</button>
    <h2 class="screen-title">💪 Training</h2>
    <p class="screen-sub">Choose which pet to train, then tap as fast as you can for 5 seconds. Each session costs ${g.TRAINING_CONFIG.energyCost} energy.</p>

    <div class="train-pet-picker">
      <div class="pet-picker-label">Train who?</div>
      <div class="pet-picker-grid">
        ${monsters.map(m => {
          const s = g.species(m.speciesId);
          const r = g.RARITY[s.rarity];
          const active = m.id === trainingPetId;
          return `
            <button class="train-pet-chip ${active ? 'active' : ''}" data-train-pet="${m.id}" style="border-color:${r.color}">
              <span class="train-pet-chip-emoji">${s.emoji}${m.isShiny ? '✨' : ''}</span>
              <span class="train-pet-chip-name">${s.name}</span>
              <span class="train-pet-chip-energy">⚡ ${Math.floor(m.energy)}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>

    <div class="train-pet-info">
      <span class="train-pet-emoji">${petArt(sp, 64)}</span>
      <span class="train-pet-stats">ATK ${pet.atk} · DEF ${pet.def} · SPD ${pet.spd} · INT ${pet.intl}</span>
      <span class="train-pet-energy">⚡ Energy ${Math.floor(pet.energy)}</span>
    </div>

    <div class="train-grid">
      ${g.TRAINING_DEFS.map(t => {
        const cd = g.state.trainCooldowns?.[pet.id]?.[t.stat] || 0;
        const cdLeft = Math.max(0, Math.ceil((cd - now)/1000));
        const ready = cdLeft === 0 && pet.energy >= g.TRAINING_CONFIG.energyCost;
        return `
          <button class="train-card" data-stat="${t.stat}" ${ready ? '' : 'disabled'}>
            <div class="train-emoji">${t.emoji}</div>
            <div class="train-label">${t.label}</div>
            <div class="train-stat">+${t.stat.toUpperCase()}</div>
            <div class="train-status">${cdLeft > 0 ? `⏳ ${cdLeft}s` : pet.energy < g.TRAINING_CONFIG.energyCost ? '💤 low energy' : '✅ ready'}</div>
          </button>
        `;
      }).join('')}
    </div>
  `;

  root.querySelectorAll('.train-pet-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      trainingPetId = btn.dataset.trainPet;
      renderTraining();
    });
  });
  root.querySelectorAll('.train-card').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        const { def, pet: trainee } = g.startTraining(btn.dataset.stat, trainingPetId);
        showTrainingModal(def, trainee.id);
      } catch (e) { alert(e.message); }
    });
  });
  root.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.go));
  });
}

function showTrainingModal(def, monsterId) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const dur = g.TRAINING_CONFIG.durationSeconds;
  modal.innerHTML = `
    <div class="modal-card train-modal">
      <div class="modal-title">${def.emoji} ${def.label}</div>
      <p>${def.desc}</p>
      <div class="train-timer">⏱️ <span id="train-timer">${dur}</span>s</div>
      <div class="train-taps">Taps: <span id="train-taps">0</span></div>
      <button id="tap-btn" class="train-tap-btn">${def.emoji} TAP!</button>
      <div class="train-thresholds">
        ${g.TRAINING_CONFIG.thresholds.filter(t=>t.gain>0).map(t => `<span>${t.taps}+ taps → +${t.gain} ${def.stat.toUpperCase()}</span>`).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  let taps = 0;
  let remaining = dur;
  const tapBtn = modal.querySelector('#tap-btn');
  const tapsEl = modal.querySelector('#train-taps');
  const timerEl = modal.querySelector('#train-timer');
  tapBtn.addEventListener('click', () => {
    if (remaining <= 0) return;
    taps++;
    tapsEl.textContent = taps;
    tapBtn.style.transform = 'scale(0.92)';
    setTimeout(() => tapBtn.style.transform = '', 60);
  });

  const interval = setInterval(() => {
    remaining = Math.max(0, remaining - 0.1);
    timerEl.textContent = remaining.toFixed(1);
    if (remaining <= 0) {
      clearInterval(interval);
      finishMinigame();
    }
  }, 100);

  function finishMinigame() {
    tapBtn.disabled = true;
    const result = g.finishTraining(def.stat, taps, monsterId);
    modal.querySelector('.modal-title').textContent = result.gain > 0
      ? `+${result.gain} ${def.stat.toUpperCase()}!`
      : 'Not enough taps — try again.';
    setTimeout(() => {
      modal.remove();
      renderTraining();
    }, 1400);
  }
}

// ------------------------------------------------------------
// Event
// ------------------------------------------------------------

function renderEvent() {
  const root = document.getElementById('screen-event');
  const event = g.getActiveEvent();
  if (!event) {
    root.innerHTML = `<button class="back-btn" data-go="home">← Home</button><p class="muted center">No active event right now.</p>`;
    root.querySelector('[data-go]').addEventListener('click', () => switchScreen('home'));
    return;
  }
  const allDone = event.quests.every(q => g.eventProgress(event.id, q.id) >= q.goal);
  const finalClaimed = g.state.eventProgress[event.id]?.finalClaimed;

  root.innerHTML = `
    <button class="back-btn" data-go="home">← Home</button>
    <div class="event-hero">
      <div class="event-hero-emoji">${event.emoji}</div>
      <h2 class="event-hero-title">${event.name}</h2>
      <p class="event-hero-desc">${event.description}</p>
    </div>

    <h3 class="shop-section-title">Quests</h3>
    <div class="quests-grid">
      ${event.quests.map(q => {
        const prog = g.eventProgress(event.id, q.id);
        const done = prog >= q.goal;
        const claimed = g.state.eventProgress[event.id]?.[q.id + '_claimed'];
        return `
          <div class="quest-card ${done ? 'done' : ''} ${claimed ? 'claimed' : ''}">
            <div class="quest-label">${q.label}</div>
            <div class="quest-progress">
              <span class="quest-bar"><span class="quest-fill" style="width:${Math.min(100, (prog/q.goal)*100)}%"></span></span>
              <span class="quest-num">${Math.min(prog, q.goal)} / ${q.goal}</span>
            </div>
            <div class="quest-reward">${rewardLabel(q.reward)}</div>
            <button class="quest-claim" data-q="${q.id}" ${done && !claimed ? '' : 'disabled'}>
              ${claimed ? '✓ Claimed' : done ? 'Claim' : 'In progress'}
            </button>
          </div>
        `;
      }).join('')}
    </div>

    <div class="event-final ${allDone ? 'unlocked' : ''}">
      <h3>🎁 Final Reward</h3>
      <p>${rewardLabel(event.finalReward)} ${event.finalReward.mythicEgg ? '+ 🌈 Mythic Egg' : ''}</p>
      <button class="big-btn" id="claim-final" ${allDone && !finalClaimed ? '' : 'disabled'}>
        ${finalClaimed ? '✓ Already Claimed' : allDone ? 'Claim Mythic Egg!' : 'Complete all quests'}
      </button>
    </div>
  `;

  root.querySelectorAll('.quest-claim').forEach(btn => {
    btn.addEventListener('click', () => {
      try { g.claimEventQuest(btn.dataset.q); showToast('Reward claimed!'); renderEvent(); }
      catch (e) { alert(e.message); }
    });
  });
  document.getElementById('claim-final').addEventListener('click', () => {
    try {
      g.claimEventFinalReward();
      showToast('🎉 Mythic Egg added to your eggs!');
      renderEvent();
    } catch (e) { alert(e.message); }
  });
  root.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.go));
  });
}

function rewardLabel(r) {
  const parts = [];
  if (r.coins)     parts.push(`🪙 ${r.coins}`);
  if (r.gems)      parts.push(`💎 ${r.gems}`);
  if (r.stardust)  parts.push(`✨ ${r.stardust}`);
  if (r.tickets)   parts.push(`🎟️ ${r.tickets}`);
  if (r.fragments) parts.push(`🧩 ${r.fragments}`);
  return parts.join(' · ');
}

function needBar(label, value, kind) {
  const pct = Math.round(value);
  const cls = pct < 30 ? 'need-low' : pct < 60 ? 'need-mid' : 'need-high';
  return `
    <div class="need">
      <div class="need-label">${label}</div>
      <div class="need-bar"><div class="need-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="need-val">${pct}</div>
    </div>
  `;
}

function renderSleepStatus(pet) {
  const slept = Math.floor((Date.now() - pet.sleepingSince) / 1000);
  const nextIn = g.secondsToNextEnergyPoint(pet);
  return `
    <div class="sleep-status">
      <div class="sleep-z">💤</div>
      <div class="sleep-info">
        <div class="sleep-row"><span class="sleep-key">Sleeping for</span> <span class="sleep-clock">${formatDuration(slept)}</span></div>
        <div class="sleep-row"><span class="sleep-key">Next +1 energy</span> <span class="sleep-clock">${formatDuration(nextIn)}</span></div>
      </div>
    </div>
  `;
}

function actionGroup(label, items, _kind) {
  if (items.length === 0) {
    return `<div class="action-group empty"><div class="action-label">${label}</div><div class="action-sub">(none)</div></div>`;
  }
  return `
    <div class="action-group">
      <div class="action-label">${label}</div>
      <div class="action-items">
        ${items.map(([id, qty]) => {
          const it = g.ITEM_BY_ID[id];
          return `
            <button class="use-item" data-item-id="${id}">
              <span class="item-emoji">${it.emoji}</span>
              <span class="item-name">${it.name}</span>
              <span class="item-qty">x${qty}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// Collection — 30-slot dex grid
// ------------------------------------------------------------

let collectionTab = 'eggs';   // default to eggs (first page)

function renderCollection() {
  const root = document.getElementById('screen-collection');
  const eggsCount = (g.state.eggs || []).filter(e => !e.hatchedAt).length;
  const owned = new Set(g.state.monsters.map(m => m.speciesId));
  const ownedCount = owned.size;
  const total = g.SPECIES.length;

  root.innerHTML = `
    <div class="sub-tabs">
      <button class="sub-tab ${collectionTab === 'eggs' ? 'active' : ''}" data-sub="eggs">
        🥚 Eggs${eggsCount > 0 ? ` <span class="sub-badge">${eggsCount}</span>` : ''}
      </button>
      <button class="sub-tab ${collectionTab === 'dex' ? 'active' : ''}" data-sub="dex">
        📦 Dex <span class="sub-badge">${ownedCount}/${total}</span>
      </button>
    </div>
    <div id="collection-content"></div>
  `;
  root.querySelectorAll('.sub-tab').forEach(b => {
    b.addEventListener('click', () => {
      collectionTab = b.dataset.sub;
      renderCollection();
    });
  });

  const content = document.getElementById('collection-content');
  if (collectionTab === 'eggs')      content.innerHTML = renderEggsBody();
  else if (collectionTab === 'dex')  content.innerHTML = renderDexBody();
  wireCollectionEvents(content);
}

function renderEggsBody() {
  const eggs = (g.state.eggs || []).filter(e => !e.hatchedAt);
  if (eggs.length === 0) {
    return `<p class="screen-sub center" style="margin-top:32px">No eggs incubating. Visit the Shop to buy one!</p>`;
  }
  return `
    <div class="eggs-grid">
      ${eggs.map(e => {
        const eggType = g.EGG_BY_ID[e.eggTypeId];
        const rar = g.RARITY[eggType.tier];
        const msLeft = Math.max(0, e.readyAt - Date.now());
        const ready = msLeft === 0;
        return `
          <div class="egg-card ${ready ? 'ready' : ''}" style="--rarity:${rar.color}; --glow:${rar.glow}">
            <div class="egg-emoji ${ready ? 'wiggle' : ''}">${eggType.emoji}</div>
            <div class="egg-name" style="color:${rar.color}">${eggType.name}</div>
            <div class="egg-timer">${ready ? '✨ Ready to hatch!' : `⏳ ${formatDuration(Math.ceil(msLeft/1000))}`}</div>
            <button class="hatch-btn" data-egg="${e.id}" ${ready ? '' : 'disabled'}>Hatch!</button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderDexBody() {
  const owned = new Set(g.state.monsters.map(m => m.speciesId));
  return `
    <div class="dex-grid">
      ${g.SPECIES.map(s => {
        const isOwned = owned.has(s.id);
        const rar = g.RARITY[s.rarity];
        return `
          <div class="dex-card ${isOwned ? 'owned' : 'locked'}" style="--rarity:${rar.color}; --glow:${rar.glow}">
            <div class="dex-id">#${String(s.id).padStart(2,'0')}</div>
            <div class="dex-emoji">${isOwned ? petArt(s, 64) : '<span class="dex-locked-glyph">❓</span>'}</div>
            <div class="dex-name">${isOwned ? s.name : '???'}</div>
            <div class="dex-rarity" style="color:${rar.color}">${rar.label}</div>
          </div>
        `;
      }).join('')}
    </div>
    <button id="reset-game-btn" class="danger-btn">🗑️ Reset game (wipe all progress)</button>
  `;
}

function wireCollectionEvents(root) {
  root.querySelectorAll('.hatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        const { monster, species: sp } = g.hatchEgg(btn.dataset.egg);
        showHatchModal(sp, monster.isShiny);
        renderCollection();
      } catch (e) { alert(e.message); }
    });
  });
  const reset = document.getElementById('reset-game-btn');
  if (reset) reset.onclick = handleReset;
}

// ------------------------------------------------------------
// Shop — eggs + items
// ------------------------------------------------------------

function renderShop() {
  const root = document.getElementById('screen-shop');
  root.innerHTML = `
    <h2 class="screen-title">Shop</h2>

    <h3 class="shop-section-title">🥚 Eggs</h3>
    <p class="screen-sub">Drop rates are published — check each egg. If an egg has multiple prices, pick which currency to spend.</p>
    <div class="shop-grid">
      ${g.EGG_TYPES.map(e => {
        const rar = g.RARITY[e.tier];
        const prices = g.eggAvailablePrices(e);
        const dropsStr = Object.entries(e.dropWeights)
          .map(([r,w]) => `<span style="color:${g.RARITY[r]?.color || '#000'}">${(w*100).toFixed(0)}% ${r}</span>`)
          .join('  ');
        return `
          <div class="shop-card" style="--rarity:${rar.color}; --glow:${rar.glow}">
            <div class="shop-emoji">${e.emoji}</div>
            <div class="shop-name" style="color:${rar.color}">${e.name}</div>
            <div class="shop-sub">${formatDuration(e.hatchSeconds)} hatch</div>
            <div class="shop-drops">${dropsStr}</div>
            <div class="buy-options">
              ${prices.length === 0
                ? '<button class="buy-egg-btn" disabled>event only</button>'
                : prices.map(p => `<button class="buy-egg-btn" data-egg="${e.id}" data-currency="${p.currency}">${currencyEmoji(p.currency)} ${p.amount}</button>`).join('')
              }
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="pity-row">
      Pity progress per tier (resets when you hit one):
      ${Object.entries(g.state.pity).map(([tier, p]) =>
        `<span class="pity-chip" style="color:${g.RARITY[tier]?.color || '#888'}">${tier}: R${p.rare}/E${p.epic}/L${p.legendary}</span>`
      ).join(' ')}
    </div>

    <h3 class="shop-section-title">🌱 Seeds</h3>
    <div class="shop-grid">
      ${g.ITEMS.filter(i => i.type === 'seed').map(i => {
        const prices = g.itemAvailablePrices(i);
        const growSec  = i.effect?.grow_seconds || 0;
        const cropEmoji = g.ITEM_BY_ID[i.effect?.crop_item]?.emoji || '🌾';
        const cropName  = g.ITEM_BY_ID[i.effect?.crop_item]?.name  || 'crop';
        return `
          <div class="shop-card">
            <div class="shop-emoji">${i.emoji}</div>
            <div class="shop-name">${i.name}</div>
            <div class="shop-effect">⏱️ ${formatHumanDuration(growSec)} → ${cropEmoji} ${cropName}</div>
            <div class="buy-options">
              ${prices.length === 0
                ? '<button class="buy-item-btn" disabled>not for sale</button>'
                : prices.map(p => `<button class="buy-item-btn" data-item="${i.id}" data-currency="${p.currency}">${currencyEmoji(p.currency)} ${p.amount}</button>`).join('')
              }
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <h3 class="shop-section-title">🛍️ Items</h3>
    <div class="shop-grid">
      ${g.ITEMS.filter(i => i.type !== 'crop' && i.type !== 'seed').map(i => {
        const prices = g.itemAvailablePrices(i);
        return `
          <div class="shop-card">
            <div class="shop-emoji">${i.emoji}</div>
            <div class="shop-name">${i.name}</div>
            <div class="shop-effect">${effectLabel(i.effect)}</div>
            <div class="buy-options">
              ${prices.length === 0
                ? '<button class="buy-item-btn" disabled>not for sale</button>'
                : prices.map(p => `<button class="buy-item-btn" data-item="${i.id}" data-currency="${p.currency}">${currencyEmoji(p.currency)} ${p.amount}</button>`).join('')
              }
            </div>
          </div>
        `;
      }).join('')}
    </div>

    ${g.state.player.fragments >= g.CONFIG.fragmentsPerFreeEgg ? `
      <div class="frag-redeem-row">
        <div>🧩 You have ${g.state.player.fragments} egg fragments. Redeem 10 for a free Common Egg!</div>
        <button id="redeem-frags">Redeem</button>
      </div>` : ''}
  `;

  root.querySelectorAll('.buy-egg-btn').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      try {
        const currency = btn.dataset.currency || undefined;
        const egg = g.buyEgg(Number(btn.dataset.egg), currency);
        showToast(`🥚 Egg bought! Incubating — check Eggs tab.`);
        renderShop();
      } catch (e) { alert(e.message); }
    });
  });
  root.querySelectorAll('.buy-item-btn').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', () => {
      try {
        const currency = btn.dataset.currency || undefined;
        g.buyItem(Number(btn.dataset.item), currency);
        renderShop();
        showToast('Bought!');
      }
      catch (e) { alert(e.message); }
    });
  });
  document.getElementById('redeem-frags')?.addEventListener('click', () => {
    try { g.redeemFragments(); renderShop(); showToast('Free egg added!'); }
    catch (e) { alert(e.message); }
  });
}

function priceLabel(thing) {
  const parts = [];
  if (thing.priceCoins)    parts.push(`🪙 ${thing.priceCoins}`);
  if (thing.priceGems)     parts.push(`💎 ${thing.priceGems}`);
  if (thing.priceStardust) parts.push(`✨ ${thing.priceStardust}`);
  return parts.join(' or ');
}

function currencyEmoji(c) {
  return ({ coins: '🪙', gems: '💎', stardust: '✨', tickets: '🎟️' })[c] || '?';
}

function effectLabel(eff) {
  if (!eff) return '';
  return Object.entries(eff).map(([k,v]) => `${k}+${v}`).join(' · ');
}

// ------------------------------------------------------------
// Eggs — incubating + ready
// ------------------------------------------------------------

// renderEggs() removed — eggs now live as a sub-tab inside renderCollection()

function showHatchModal(sp, isShiny) {
  const rar = g.RARITY[sp.rarity];
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card" style="--rarity:${rar.color}; --glow:${rar.glow}">
      <div class="modal-title">🎉 You hatched ${isShiny ? 'a SHINY ' : ''}${sp.name}!</div>
      <div class="modal-emoji">${petArt(sp, 180, { classes: isShiny ? 'shiny' : '' })}${isShiny ? '<span class="shiny-spark">✨</span>' : ''}</div>
      <div class="modal-rarity" style="color:${rar.color}">${rar.label}</div>
      <div class="modal-element">${g.ELEMENT[sp.element].emoji} ${g.ELEMENT[sp.element].label}</div>
      <button class="modal-close-btn">Awesome!</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });
}

// ------------------------------------------------------------
// Battle
// ------------------------------------------------------------

function renderBattle() {
  const root = document.getElementById('screen-battle');
  if (g.state.monsters.length === 0) {
    root.innerHTML = '<p class="muted center">You need at least one pet to battle.</p>';
    return;
  }

  root.innerHTML = `
    <h2 class="screen-title">Async Battle</h2>
    <p class="screen-sub">Fight an opponent of similar trophy count. Pick 1–3 pets.</p>
    <div class="team-builder">
      ${g.state.monsters.map(m => {
        const s = g.species(m.speciesId);
        const r = g.RARITY[s.rarity];
        return `
          <label class="team-mon" style="border-color:${r.color}">
            <input type="checkbox" class="team-pick" value="${m.id}">
            <span class="mini-emoji">${s.emoji}${m.isShiny ? '✨' : ''}</span>
            <span class="mini-name">${s.name}</span>
            <span class="mini-stats">ATK ${m.atk} · DEF ${m.def} · SPD ${m.spd}</span>
          </label>
        `;
      }).join('')}
    </div>
    <button id="fight-btn" class="big-btn">⚔️ Fight!</button>
    <div id="battle-log" class="battle-log"></div>
    <h3 class="screen-sub">Recent battles</h3>
    <div class="history">
      ${g.state.battleHistory.slice(0, 10).map(h => `
        <div class="history-row ${h.won ? 'win' : 'loss'}">
          <span>${h.won ? '🏆 Win' : '💔 Loss'}</span>
          <span>${h.trophyDelta > 0 ? '+' : ''}${h.trophyDelta} 🏆</span>
          <span>+${h.coinsReward} 🪙</span>
          ${h.fragmentDrop ? '<span>+1 🧩</span>' : ''}
          <span class="history-teams">${h.yourTeam} vs ${h.npcTeam}</span>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('fight-btn').onclick = () => {
    if (battleAnimating) return;
    const picks = Array.from(root.querySelectorAll('.team-pick:checked')).map(c => c.value);
    if (picks.length === 0) { alert('Pick at least 1 pet.'); return; }
    if (picks.length > 3)   { alert('Max 3 pets per team.'); return; }
    try {
      const result = g.runBattle(picks);
      animateBattle(result);
    } catch (e) { alert(e.message); }
  };
}

function animateBattle(result) {
  battleAnimating = true;
  const logEl = document.getElementById('battle-log');
  logEl.innerHTML = `
    <div class="battle-vs">
      <div class="battle-side">YOU: ${result.finalTeams.a.map(t => t.emoji).join(' ')}</div>
      <div class="battle-vs-sep">vs</div>
      <div class="battle-side">NPC: ${result.npcTeam.map(t => t.emoji).join(' ')}</div>
    </div>
    <ol class="battle-steps"></ol>
  `;
  const stepsEl = logEl.querySelector('.battle-steps');

  let i = 0;
  const showNext = () => {
    if (i >= result.log.length) {
      const finalLine = document.createElement('li');
      finalLine.className = 'battle-final ' + (result.won ? 'win' : 'loss');
      finalLine.innerHTML = result.won
        ? `🏆 <b>You won!</b>  +${result.coinsReward} 🪙  ${result.trophyDelta > 0 ? '+' : ''}${result.trophyDelta} 🏆${result.fragmentDrop ? '  +1 🧩' : ''}`
        : `💔 <b>You lost.</b>  ${result.trophyDelta} 🏆`;
      stepsEl.appendChild(finalLine);
      renderHeader();
      battleAnimating = false;
      return;
    }
    const ev = result.log[i++];
    const li = document.createElement('li');
    if (ev.fainted != null) {
      li.innerHTML = `💀 <b>${ev.targetEmoji || ''} ${ev.targetName}</b> fainted!`;
      li.className = 'battle-faint';
    } else {
      const tag = ev.actor === 'a' ? '🟢' : '🔴';
      const die = ['⚀','⚁','⚂','⚃','⚄','⚅'][ev.roll - 1] || '🎲';
      const hpPct = Math.round((ev.targetHpAfter / ev.targetHpMax) * 100);
      li.innerHTML = `${tag} <b>${ev.attackerEmoji || ''} ${ev.attackerName}</b> rolled <span class="die-face">${die} ${ev.roll}</span> → <span class="dmg-calc">${ev.roll}×${ev.atk} − ${ev.def} = <b>${ev.damage}</b></span> dmg to ${ev.targetEmoji || ''} ${ev.targetName} <span class="hp-after">(${hpPct}% HP)</span>`;
    }
    stepsEl.appendChild(li);
    li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(showNext, 400);
  };
  showNext();
}

// ------------------------------------------------------------
// Admin
// ------------------------------------------------------------

let adminTab = 'pets';

function renderAdmin() {
  const root = document.getElementById('screen-admin');
  root.innerHTML = `
    <button class="back-btn" data-go="home">← Home</button>
    <h2 class="screen-title">⚙️ Admin Panel</h2>
    <p class="screen-sub">Edit any catalog value live. Changes persist in your save and apply immediately.</p>

    <div class="admin-tabs">
      ${['player','pets','seeds','items','eggs'].map(t => `
        <button class="admin-tab ${adminTab === t ? 'active' : ''}" data-admin-tab="${t}">${tabIcon(t)} ${t}</button>
      `).join('')}
    </div>

    <div class="admin-table-wrap">
      ${adminTab === 'player'? renderAdminPlayer(): ''}
      ${adminTab === 'pets'  ? renderAdminPets()  : ''}
      ${adminTab === 'seeds' ? renderAdminSeeds() : ''}
      ${adminTab === 'items' ? renderAdminItems() : ''}
      ${adminTab === 'eggs'  ? renderAdminEggs()  : ''}
    </div>

    <div class="admin-bottom-bar">
      <button id="admin-reset" class="danger-btn">↺ Reset ALL overrides to defaults</button>
    </div>
  `;

  // Tab switching
  root.querySelectorAll('.admin-tab').forEach(b => {
    b.addEventListener('click', () => {
      adminTab = b.dataset.adminTab;
      renderAdmin();
    });
  });

  // Cell editing — save on EVERY keystroke (debounced) so a fast
  // refresh before blurring still persists the edit.
  // `change` fires only on blur, which used to drop edits if user hit
  // F5 while still focused on the cell.
  const saveAdminCell = (inp) => {
    const { category, id, field } = inp.dataset;
    if (!field) return;
    try {
      // "player" category bypasses the override layer — direct state edits
      if (category === 'player') {
        g.setPlayerField(field, inp.value);
      } else if (category === 'inventory') {
        g.setInventoryQty(field, inp.value);
      } else if (category) {
        g.setAdminOverride(category, id, { [field]: inp.value });
      } else {
        return;
      }
      flashCell(inp);
      if (field === 'growSeconds' || field === 'hatchSeconds') {
        const pretty = inp.closest('tr')?.querySelector('.admin-cell-pretty');
        if (pretty) pretty.textContent = formatDuration(Number(inp.value));
      }
      // Player edits affect the header currency display — refresh it
      if (category === 'player') renderHeader();
    } catch (e) { alert(e.message); }
  };
  const debouncedSave = debounce(saveAdminCell, 350);

  root.querySelectorAll('.admin-input').forEach(inp => {
    // Fires on every keystroke / select change. Debounced so we
    // don't hammer localStorage 5 times while typing "99999".
    inp.addEventListener('input',  () => debouncedSave(inp));
    // Fires on blur / Enter — also save IMMEDIATELY so the green
    // flash is responsive when user commits an edit deliberately.
    inp.addEventListener('change', () => saveAdminCell(inp));
  });

  // Safety net: if user navigates away (F5, close tab, back-button)
  // while still focused on an admin input, flush their pending edit.
  if (!window.__adminFlushHooked) {
    window.__adminFlushHooked = true;
    const flushFocused = () => {
      const ae = document.activeElement;
      if (ae && ae.classList?.contains('admin-input') && ae.dataset.field) {
        const { category, id, field } = ae.dataset;
        try {
          if (category === 'player')         g.setPlayerField(field, ae.value);
          else if (category === 'inventory') g.setInventoryQty(field, ae.value);
          else if (category)                 g.setAdminOverride(category, id, { [field]: ae.value });
        } catch {}
      }
    };
    window.addEventListener('beforeunload', flushFocused);
    window.addEventListener('pagehide',     flushFocused);
    // visibilitychange catches mobile-app-switch / tab-switch cases
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushFocused();
    });
  }

  document.getElementById('admin-reset').addEventListener('click', () => {
    if (!confirm('Reset all admin overrides? All pets/seeds/items/eggs return to defaults. Save data is kept.')) return;
    g.resetAdminOverrides();
    showToast('Reset to defaults');
    renderAdmin();
  });

  // Account-picker on the Player tab — switch active save
  const picker = document.getElementById('admin-account-picker');
  if (picker) {
    picker.addEventListener('change', () => {
      const id = picker.value;
      const acct = g.listAccounts().find(a => a.id === id);
      if (!acct) return;
      if (!confirm(`Switch the game to "${acct.displayName}"? Your current edits stay saved on whichever account you were on.`)) {
        picker.value = g.getCurrentAccount()?.id || '';
        return;
      }
      g.switchAccount(id);
      g.bootGame();
      showToast(`Now editing as ${acct.displayName}`);
      renderActiveScreen();
    });
  }

  root.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => switchScreen(b.dataset.go)));
}

function tabIcon(t) {
  return { player: '👤', pets: '🦒', seeds: '🌱', items: '🛍️', eggs: '🥚' }[t] || '⚙️';
}

function flashCell(inp) {
  inp.style.transition = 'background-color 0.4s';
  inp.style.backgroundColor = '#bbf7d0';
  setTimeout(() => inp.style.backgroundColor = '', 600);
}

function renderAdminPlayer() {
  const p = g.state.player;
  const inv = Object.entries(g.state.inventory || {});
  const sortedItems = g.ITEMS.slice().sort((a,b) => a.id - b.id);
  const accounts = g.listAccounts();
  const currentAcct = g.getCurrentAccount();

  return `
    <p class="admin-table-hint">Tweak your player stats, currencies, and inventory directly. Empty an item's qty to remove it.</p>

    ${accounts.length > 1 ? `
      <div class="admin-account-switcher">
        <label class="muted small">📁 Edit save for account:</label>
        <select id="admin-account-picker">
          ${accounts.map(a => `
            <option value="${a.id}" ${a.id === currentAcct?.id ? 'selected' : ''}>
              ${escapeHtml(a.displayName)}${a.isAdmin ? ' (admin)' : ''}
            </option>
          `).join('')}
        </select>
        <span class="muted small">Switches the whole game to that account's save.</span>
      </div>
    ` : `<p class="muted small">Only one account exists in this browser. Sign out and sign up again to create more accounts.</p>`}

    <h3 class="admin-section-title">👤 Player</h3>
    <table class="admin-table">
      <thead><tr><th>Field</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Name</td>     <td><input class="admin-input" data-category="player" data-field="name" value="${escapeHtml(p.name)}"></td></tr>
        <tr><td>🪙 Coins</td>  <td><input class="admin-input num" type="number" data-category="player" data-field="coins"     value="${p.coins}"></td></tr>
        <tr><td>💎 Gems</td>   <td><input class="admin-input num" type="number" data-category="player" data-field="gems"      value="${p.gems}"></td></tr>
        <tr><td>✨ Stardust</td><td><input class="admin-input num" type="number" data-category="player" data-field="stardust"  value="${p.stardust}"></td></tr>
        <tr><td>🎟️ Tickets</td><td><input class="admin-input num" type="number" data-category="player" data-field="tickets"   value="${p.tickets}"></td></tr>
        <tr><td>🏆 Trophies</td><td><input class="admin-input num" type="number" data-category="player" data-field="trophies" value="${p.trophies}"></td></tr>
        <tr><td>🧩 Fragments</td><td><input class="admin-input num" type="number" data-category="player" data-field="fragments" value="${p.fragments || 0}"></td></tr>
      </tbody>
    </table>

    <h3 class="admin-section-title">🎒 Inventory</h3>
    <p class="admin-table-hint">Set quantity for any item. 0 removes it. Items not in your inventory show as 0 — type a number to add them.</p>
    <table class="admin-table">
      <thead><tr><th>#</th><th>Emoji</th><th>Name</th><th>Type</th><th>Quantity</th></tr></thead>
      <tbody>
        ${sortedItems.map(it => {
          const qty = g.state.inventory?.[it.id] || 0;
          return `
            <tr>
              <td>${it.id}</td>
              <td>${it.emoji}</td>
              <td>${escapeHtml(it.name)}</td>
              <td><span class="muted small">${it.type}</span></td>
              <td><input class="admin-input num" type="number" min="0" data-category="inventory" data-field="${it.id}" value="${qty}"></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderAdminPets() {
  const rows = g.SPECIES.map(s => {
    const rar = g.RARITY[s.rarity];
    return `
      <tr style="border-left:4px solid ${rar.color}">
        <td>${s.id}</td>
        <td><input class="admin-input small" data-category="species" data-id="${s.id}" data-field="emoji" value="${s.emoji}"></td>
        <td><input class="admin-input" data-category="species" data-id="${s.id}" data-field="name" value="${s.name}"></td>
        <td>
          <select class="admin-input" data-category="species" data-id="${s.id}" data-field="rarity">
            ${Object.keys(g.RARITY).map(r => `<option value="${r}" ${s.rarity===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </td>
        <td><input class="admin-input num" type="number" data-category="species" data-id="${s.id}" data-field="hp"   value="${s.baseStats.hp}"></td>
        <td><input class="admin-input num" type="number" data-category="species" data-id="${s.id}" data-field="atk"  value="${s.baseStats.atk}"></td>
        <td><input class="admin-input num" type="number" data-category="species" data-id="${s.id}" data-field="def"  value="${s.baseStats.def}"></td>
        <td><input class="admin-input num" type="number" data-category="species" data-id="${s.id}" data-field="spd"  value="${s.baseStats.spd}"></td>
        <td><input class="admin-input num" type="number" data-category="species" data-id="${s.id}" data-field="intl" value="${s.baseStats.intl}"></td>
      </tr>
    `;
  }).join('');
  return `
    <table class="admin-table">
      <thead><tr><th>#</th><th>Emoji</th><th>Name</th><th>Rarity</th><th>HP</th><th>ATK</th><th>DEF</th><th>SPD</th><th>INT</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderAdminSeeds() {
  const seeds = g.ITEMS.filter(i => i.type === 'seed');
  const rows = seeds.map(it => `
    <tr>
      <td>${it.id}</td>
      <td><input class="admin-input small" data-category="items" data-id="${it.id}" data-field="emoji" value="${it.emoji}"></td>
      <td><input class="admin-input" data-category="items" data-id="${it.id}" data-field="name" value="${it.name}"></td>
      <td><input class="admin-input num" type="number" data-category="items" data-id="${it.id}" data-field="growSeconds" value="${it.effect.grow_seconds}"></td>
      <td class="admin-cell-pretty">${formatDuration(it.effect.grow_seconds)}</td>
      <td><input class="admin-input num" type="number" data-category="items" data-id="${it.id}" data-field="priceCoins" value="${it.priceCoins ?? ''}"></td>
      <td><input class="admin-input num" type="number" data-category="items" data-id="${it.id}" data-field="priceGems"  value="${it.priceGems  ?? ''}"></td>
    </tr>
  `).join('');
  return `
    <table class="admin-table">
      <thead><tr><th>#</th><th>Emoji</th><th>Name</th><th>Grow (sec)</th><th>DD:HH:MM:SS</th><th>Price 🪙</th><th>Price 💎</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderAdminItems() {
  // Includes food, medicine, toys, AND crops (so admin can tune how much crops heal when fed)
  const items = g.ITEMS.filter(i => i.type !== 'seed');
  const rows = items.map(it => {
    const eff = it.effect || {};
    return `
      <tr>
        <td>${it.id}</td>
        <td><input class="admin-input small" data-category="items" data-id="${it.id}" data-field="emoji" value="${it.emoji}"></td>
        <td><input class="admin-input" data-category="items" data-id="${it.id}" data-field="name" value="${it.name}"></td>
        <td><span class="muted small">${it.type}</span></td>
        <td><input class="admin-input num" type="number" data-category="items" data-id="${it.id}" data-field="hunger"      value="${eff.hunger      ?? ''}" placeholder="-" title="+hunger when used"></td>
        <td><input class="admin-input num" type="number" data-category="items" data-id="${it.id}" data-field="cleanliness" value="${eff.cleanliness ?? ''}" placeholder="-" title="+cleanliness"></td>
        <td><input class="admin-input num" type="number" data-category="items" data-id="${it.id}" data-field="energy"      value="${eff.energy      ?? ''}" placeholder="-" title="+energy"></td>
        <td><input class="admin-input num" type="number" data-category="items" data-id="${it.id}" data-field="mood"        value="${eff.mood        ?? ''}" placeholder="-" title="+mood"></td>
        <td><input class="admin-input num" type="number" data-category="items" data-id="${it.id}" data-field="priceCoins"    value="${it.priceCoins    ?? ''}" placeholder="-"></td>
        <td><input class="admin-input num" type="number" data-category="items" data-id="${it.id}" data-field="priceGems"     value="${it.priceGems     ?? ''}" placeholder="-"></td>
        <td><input class="admin-input num" type="number" data-category="items" data-id="${it.id}" data-field="priceStardust" value="${it.priceStardust ?? ''}" placeholder="-"></td>
      </tr>
    `;
  }).join('');
  return `
    <p class="admin-table-hint">Empty effect cell = no effect. Leave price empty for "not for sale" in that currency. Set multiple prices ⇒ player picks which currency to spend.</p>
    <table class="admin-table">
      <thead>
        <tr>
          <th>#</th><th>Emoji</th><th>Name</th><th>Type</th>
          <th>+🍖</th><th>+🧼</th><th>+⚡</th><th>+😊</th>
          <th>🪙</th><th>💎</th><th>✨</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderAdminEggs() {
  const rows = g.EGG_TYPES.map(e => {
    const rar = g.RARITY[e.tier];
    return `
      <tr style="border-left:4px solid ${rar.color}">
        <td>${e.id}</td>
        <td><input class="admin-input small" data-category="eggs" data-id="${e.id}" data-field="emoji" value="${e.emoji}"></td>
        <td><input class="admin-input" data-category="eggs" data-id="${e.id}" data-field="name" value="${e.name}"></td>
        <td>${e.tier}</td>
        <td><input class="admin-input num" type="number" data-category="eggs" data-id="${e.id}" data-field="hatchSeconds" value="${e.hatchSeconds}"></td>
        <td class="admin-cell-pretty">${formatDuration(e.hatchSeconds)}</td>
        <td><input class="admin-input num" type="number" data-category="eggs" data-id="${e.id}" data-field="priceCoins"    value="${e.priceCoins    ?? ''}" placeholder="-"></td>
        <td><input class="admin-input num" type="number" data-category="eggs" data-id="${e.id}" data-field="priceGems"     value="${e.priceGems     ?? ''}" placeholder="-"></td>
        <td><input class="admin-input num" type="number" data-category="eggs" data-id="${e.id}" data-field="priceStardust" value="${e.priceStardust ?? ''}" placeholder="-"></td>
      </tr>
    `;
  }).join('');
  return `
    <table class="admin-table">
      <thead><tr><th>#</th><th>Emoji</th><th>Name</th><th>Tier</th><th>Hatch (sec)</th><th>DD:HH:MM:SS</th><th>Price 🪙</th><th>Price 💎</th><th>Price ✨</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ------------------------------------------------------------
// Friends + Chat (local NPC friends — no backend)
// ------------------------------------------------------------

let activeChat = null;   // friend.id currently open

function renderFriends() {
  const root = document.getElementById('screen-friends');
  const friends = g.state.friends || [];
  const f = activeChat ? friends.find(x => x.id === activeChat) : null;

  if (f) {
    // Chat view for selected friend
    const msgs = (g.state.chats?.[f.id] || []);
    root.innerHTML = `
      <button class="back-btn" id="back-to-friends">← All friends</button>
      <div class="chat-header">
        <span class="chat-friend-emoji">${f.emoji}</span>
        <div class="chat-friend-name">${f.name}</div>
      </div>
      <div class="chat-thread" id="chat-thread">
        ${msgs.map(m => `
          <div class="chat-msg ${m.from}"><div class="chat-bubble">${escapeHtml(m.text)}</div></div>
        `).join('')}
      </div>
      <form class="chat-form" id="chat-form">
        <input id="chat-input" type="text" maxlength="200" placeholder="Type a message…" autocomplete="off">
        <button type="submit">Send</button>
      </form>
      <p class="muted small center" style="margin-top:8px">
        Type "help" or "water" to ask for plant watering!
      </p>
    `;
    document.getElementById('back-to-friends').onclick = () => { activeChat = null; renderFriends(); };
    document.getElementById('chat-form').onsubmit = (e) => {
      e.preventDefault();
      const inp = document.getElementById('chat-input');
      try { g.sendMessage(f.id, inp.value); inp.value = ''; renderFriends(); }
      catch (er) { alert(er.message); }
    };
    const thread = document.getElementById('chat-thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
    return;
  }

  // Friends list view
  root.innerHTML = `
    <h2 class="screen-title">👥 Friends</h2>
    <p class="screen-sub">Add friends to chat — they can also help water your plants!</p>
    <form class="add-friend-form" id="add-friend-form">
      <input id="friend-name-input" type="text" maxlength="20" placeholder="Friend's name" autocomplete="off">
      <button type="submit">+ Add</button>
    </form>
    ${friends.length === 0 ? `
      <p class="muted center" style="margin-top:32px">No friends yet. Add one above to get started!</p>
    ` : `
      <div class="friends-list">
        ${friends.map(f => {
          const msgs = g.state.chats?.[f.id] || [];
          const last = msgs[msgs.length - 1];
          const unread = msgs.filter(m => m.from === 'them' && !m.read).length;
          return `
            <button class="friend-row" data-friend-id="${f.id}">
              <span class="friend-emoji">${f.emoji}</span>
              <div class="friend-meta">
                <div class="friend-name">${f.name}${unread > 0 ? ` <span class="unread-dot">${unread}</span>` : ''}</div>
                <div class="friend-last">${last ? escapeHtml(last.text).slice(0, 50) : 'Tap to chat'}</div>
              </div>
              <button class="friend-remove" data-remove="${f.id}" title="Remove">✕</button>
            </button>
          `;
        }).join('')}
      </div>
    `}
    ${renderHelpInbox()}
  `;

  document.getElementById('add-friend-form').onsubmit = (e) => {
    e.preventDefault();
    const inp = document.getElementById('friend-name-input');
    try { g.addFriend(inp.value); inp.value = ''; renderFriends(); }
    catch (er) { alert(er.message); }
  };
  root.querySelectorAll('.friend-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.dataset.remove) return;     // ignore click on the X
      activeChat = row.dataset.friendId;
      // Mark all messages from this friend as read
      const msgs = g.state.chats?.[activeChat] || [];
      msgs.forEach(m => m.read = true);
      g.saveState();
      renderFriends();
    });
  });
  root.querySelectorAll('.friend-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Remove this friend?')) { g.removeFriend(btn.dataset.remove); renderFriends(); }
    });
  });
}

function renderHelpInbox() {
  const codes = Object.entries(g.state.receivedHelpCodes || {})
    .filter(([, info]) => !info.claimed);
  if (codes.length === 0) return '';
  return `
    <h3 class="screen-title" style="margin-top:24px;font-size:18px">📬 Help received</h3>
    <p class="screen-sub">A friend watered one of your plants! Tap claim to apply -5 min.</p>
    <div class="help-inbox">
      ${codes.map(([code, info]) => `
        <div class="help-row">
          <div>${info.friendName} watered your plot #${info.plotIndex + 1}</div>
          <button class="help-claim-btn" data-code="${code}">Claim -5 min</button>
        </div>
      `).join('')}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ------------------------------------------------------------
// Help mode — opened by a friend via ?help=<payload> URL
// ------------------------------------------------------------

function enterHelpMode(payload) {
  document.getElementById('sign-up-screen').style.display = 'none';
  document.getElementById('app').style.display = 'none';

  let decoded;
  try { decoded = g.friendWaterPlant(payload); }
  catch { return showHelpError('That link looks broken or expired.'); }

  const helpRoot = document.createElement('div');
  helpRoot.id = 'help-mode-screen';
  helpRoot.innerHTML = `
    <div class="help-card">
      <div class="help-emoji">🌱</div>
      <h1>Help ${escapeHtml(decoded.ownerName)}!</h1>
      <p>Their plant in plot #${decoded.plotIndex + 1} could use a watering. Want to help?</p>
      <button id="help-water-btn" class="big-btn">🚿 Water it (-5 min off their timer)</button>
      <div id="help-code-output" class="help-code-output" style="display:none">
        <p style="margin-top:24px">🎉 Thanks! Tell <b>${escapeHtml(decoded.ownerName)}</b> to enter this claim code:</p>
        <div class="help-code-display"><code id="claim-code-text"></code></div>
        <button id="copy-help-code" class="big-btn">📋 Copy code</button>
        <p class="muted small" style="margin-top:16px">They can also paste it into their Friends → 📬 Help inbox.</p>
      </div>
    </div>
  `;
  document.body.appendChild(helpRoot);

  document.getElementById('help-water-btn').onclick = () => {
    document.getElementById('claim-code-text').textContent = decoded.claimCode;
    document.getElementById('help-code-output').style.display = 'block';
    document.getElementById('help-water-btn').disabled = true;
    document.getElementById('help-water-btn').textContent = '✅ Watered!';
  };
  document.getElementById('copy-help-code').onclick = async () => {
    try {
      await navigator.clipboard.writeText(decoded.claimCode);
      document.getElementById('copy-help-code').textContent = '✅ Copied';
    } catch { /* clipboard blocked */ }
  };
}

function showHelpError(msg) {
  const root = document.createElement('div');
  root.id = 'help-mode-screen';
  root.innerHTML = `<div class="help-card"><h1>😕</h1><p>${msg}</p></div>`;
  document.body.appendChild(root);
}

// ------------------------------------------------------------
// Toast
// ------------------------------------------------------------

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
