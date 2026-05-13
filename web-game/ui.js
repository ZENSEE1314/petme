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
  if (!loaded) {
    showSignUp();
  } else {
    showApp();
  }

  // Wire bottom-nav
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });

  // Tick loop — 1s for live countdowns.
  // Don't disrupt the user if they're typing into a form field
  // (admin tables especially) — wholesale innerHTML replacement
  // would steal focus and discard in-progress edits.
  setInterval(() => {
    if (!g.state) return;
    g.tickDecay();
    const ae = document.activeElement;
    const isEditing = ae && (
      ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT'
    );
    if (isEditing) {
      renderHeader();   // currency bar can still refresh
    } else {
      renderActiveScreen();
    }
  }, 1000);

  // Wire sign-up form (might not exist on first render but listener is safe)
  document.getElementById('sign-up-btn')?.addEventListener('click', handleSignUp);
  document.getElementById('display-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSignUp();
  });
  document.getElementById('reset-btn')?.addEventListener('click', handleReset);
});

function handleSignUp() {
  const input = document.getElementById('display-name-input');
  const name = (input?.value || '').trim() || 'Trainer';
  g.newGame(name);
  showApp();
}

function handleReset() {
  if (!confirm('Reset game? This wipes all progress.')) return;
  g.resetGame();
  location.reload();
}

// ------------------------------------------------------------
// Screen switching
// ------------------------------------------------------------

function showSignUp() {
  document.getElementById('sign-up-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
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
    case 'eggs':      renderEggs();      break;
    case 'battle':    renderBattle();    break;
    case 'admin':     renderAdmin();     break;
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
      <div class="pet-emoji${pet.isShiny ? ' shiny' : ''}">${sp.emoji}${pet.isShiny ? '✨' : ''}</div>
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

function renderTraining() {
  const root = document.getElementById('screen-training');
  const pet = g.getActivePet();
  if (!pet) { root.innerHTML = '<p class="muted center">No active pet.</p>'; return; }
  const now = Date.now();

  root.innerHTML = `
    <button class="back-btn" data-go="home">← Home</button>
    <h2 class="screen-title">💪 Training</h2>
    <p class="screen-sub">Tap as fast as you can for 5 seconds — gain a permanent stat boost. Costs 10 energy.</p>

    <div class="train-pet-info">
      <span class="train-pet-emoji">${g.species(pet.speciesId).emoji}</span>
      <span class="train-pet-stats">ATK ${pet.atk} · DEF ${pet.def} · SPD ${pet.spd} · INT ${pet.intl}</span>
      <span class="train-pet-energy">⚡ Energy ${pet.energy}</span>
    </div>

    <div class="train-grid">
      ${g.TRAINING_DEFS.map(t => {
        const cd = g.state.trainCooldowns[t.stat] || 0;
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

  root.querySelectorAll('.train-card').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        const def = g.startTraining(btn.dataset.stat);
        showTrainingModal(def);
      } catch (e) { alert(e.message); }
    });
  });
  root.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.go));
  });
}

function showTrainingModal(def) {
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
    const result = g.finishTraining(def.stat, taps);
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

function renderCollection() {
  const root = document.getElementById('screen-collection');
  const owned = new Set(g.state.monsters.map(m => m.speciesId));
  const ownedCount = owned.size;
  const total = g.SPECIES.length;

  root.innerHTML = `
    <h2 class="screen-title">Your Collection</h2>
    <p class="screen-sub">${ownedCount} / ${total} discovered</p>
    <div class="dex-grid">
      ${g.SPECIES.map(s => {
        const isOwned = owned.has(s.id);
        const rar = g.RARITY[s.rarity];
        return `
          <div class="dex-card ${isOwned ? 'owned' : 'locked'}" style="--rarity:${rar.color}; --glow:${rar.glow}">
            <div class="dex-id">#${String(s.id).padStart(2,'0')}</div>
            <div class="dex-emoji">${isOwned ? s.emoji : '❓'}</div>
            <div class="dex-name">${isOwned ? s.name : '???'}</div>
            <div class="dex-rarity" style="color:${rar.color}">${rar.label}</div>
          </div>
        `;
      }).join('')}
    </div>
    <button id="reset-game-btn" class="danger-btn">🗑️ Reset game (wipe all progress)</button>
  `;
  document.getElementById('reset-game-btn').onclick = handleReset;
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

    <h3 class="shop-section-title">🛍️ Items</h3>
    <div class="shop-grid">
      ${g.ITEMS.filter(i => i.type !== 'crop').map(i => {
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

function renderEggs() {
  const root = document.getElementById('screen-eggs');
  const eggs = g.state.eggs.filter(e => !e.hatchedAt);
  if (eggs.length === 0) {
    root.innerHTML = `
      <h2 class="screen-title">Eggs</h2>
      <p class="screen-sub">No eggs incubating. Visit the Shop to buy one!</p>
    `;
    return;
  }

  root.innerHTML = `
    <h2 class="screen-title">Eggs</h2>
    <div class="eggs-grid">
      ${eggs.map(e => {
        const eggType = g.EGG_BY_ID[e.eggTypeId];
        const rar = g.RARITY[eggType.tier];
        const msLeft = Math.max(0, e.readyAt - Date.now());
        const ready = msLeft === 0;
        const mins = Math.floor(msLeft / 60000);
        const secs = Math.floor((msLeft % 60000) / 1000);
        return `
          <div class="egg-card ${ready ? 'ready' : ''}" style="--rarity:${rar.color}; --glow:${rar.glow}">
            <div class="egg-emoji ${ready ? 'wiggle' : ''}">${eggType.emoji}</div>
            <div class="egg-name" style="color:${rar.color}">${eggType.name}</div>
            <div class="egg-timer">${ready ? '✨ Ready to hatch!' : `⏳ ${mins}:${String(secs).padStart(2,'0')}`}</div>
            <button class="hatch-btn" data-egg="${e.id}" ${ready ? '' : 'disabled'}>Hatch!</button>
          </div>
        `;
      }).join('')}
    </div>
  `;

  root.querySelectorAll('.hatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        const { monster, species: sp } = g.hatchEgg(btn.dataset.egg);
        const rar = g.RARITY[sp.rarity];
        showHatchModal(sp, monster.isShiny);
        renderEggs();
      } catch (e) { alert(e.message); }
    });
  });
}

function showHatchModal(sp, isShiny) {
  const rar = g.RARITY[sp.rarity];
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card" style="--rarity:${rar.color}; --glow:${rar.glow}">
      <div class="modal-title">🎉 You hatched ${isShiny ? 'a SHINY ' : ''}${sp.name}!</div>
      <div class="modal-emoji">${sp.emoji}${isShiny ? '✨' : ''}</div>
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
      li.innerHTML = `💀 <b>${ev.targetName}</b> fainted!`;
      li.className = 'battle-faint';
    } else {
      const tag = ev.actor === 'a' ? '🟢' : '🔴';
      const hpPct = Math.round((ev.targetHpAfter / ev.targetHpMax) * 100);
      li.innerHTML = `${tag} <b>${ev.attackerName}</b> hit <b>${ev.targetName}</b> for ${ev.damage}  (${ev.targetName} HP: ${hpPct}%)`;
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
      ${['pets','seeds','items','eggs'].map(t => `
        <button class="admin-tab ${adminTab === t ? 'active' : ''}" data-admin-tab="${t}">${tabIcon(t)} ${t}</button>
      `).join('')}
    </div>

    <div class="admin-table-wrap">
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
    if (!category || !id || !field) return;
    try {
      g.setAdminOverride(category, id, { [field]: inp.value });
      flashCell(inp);
      if (field === 'growSeconds' || field === 'hatchSeconds') {
        const pretty = inp.closest('tr')?.querySelector('.admin-cell-pretty');
        if (pretty) pretty.textContent = formatDuration(Number(inp.value));
      }
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
      if (ae && ae.classList?.contains('admin-input') && ae.dataset.category) {
        const { category, id, field } = ae.dataset;
        try { g.setAdminOverride(category, id, { [field]: ae.value }); }
        catch {}
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

  root.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => switchScreen(b.dataset.go)));
}

function tabIcon(t) {
  return { pets: '🦒', seeds: '🌱', items: '🛍️', eggs: '🥚' }[t] || '⚙️';
}

function flashCell(inp) {
  inp.style.transition = 'background-color 0.4s';
  inp.style.backgroundColor = '#bbf7d0';
  setTimeout(() => inp.style.backgroundColor = '', 600);
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
