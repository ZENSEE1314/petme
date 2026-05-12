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

  // Tick loop — decay + render every 2 seconds
  setInterval(() => {
    if (g.state) {
      g.tickDecay();
      renderActiveScreen();
    }
  }, 2000);

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
    case 'collection':renderCollection();break;
    case 'shop':      renderShop();      break;
    case 'eggs':      renderEggs();      break;
    case 'battle':    renderBattle();    break;
  }
}

// ------------------------------------------------------------
// Header — currency bar
// ------------------------------------------------------------

function renderHeader() {
  const p = g.state.player;
  document.getElementById('hdr-name').textContent = p.name;
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

  // Inventory chips
  const foods    = Object.entries(g.state.inventory).filter(([id]) => g.ITEM_BY_ID[id]?.type === 'food');
  const meds     = Object.entries(g.state.inventory).filter(([id]) => g.ITEM_BY_ID[id]?.type === 'medicine');
  const toys     = Object.entries(g.state.inventory).filter(([id]) => g.ITEM_BY_ID[id]?.type === 'toy');

  root.innerHTML = `
    <div class="pet-card" style="--rarity:${rar.color}; --glow:${rar.glow}">
      <div class="pet-emoji${pet.isShiny ? ' shiny' : ''}">${sp.emoji}${pet.isShiny ? '✨' : ''}</div>
      <div class="pet-name">${sp.name}${pet.isStarter ? ' ⭐' : ''}</div>
      <div class="pet-element">${g.ELEMENT[sp.element].emoji} ${g.ELEMENT[sp.element].label} · <span class="rarity-chip" style="color:${rar.color}">${rar.label}</span></div>
      <div class="pet-mood">${moodFace} Mood ${mood}/100</div>
    </div>

    <div class="needs-grid">
      ${needBar('🍖 Hunger',      pet.hunger,      'hunger')}
      ${needBar('🧼 Cleanliness', pet.cleanliness, 'clean')}
      ${needBar('⚡ Energy',       pet.energy,      'energy')}
    </div>

    <div class="actions-grid">
      ${actionGroup('Feed', foods, 'food')}
      ${actionGroup('Clean', meds.filter(([id]) => g.ITEM_BY_ID[id].effect.cleanliness), 'med')}
      ${actionGroup('Play', toys, 'toy')}
      <button class="action-btn solo" id="sleep-btn">😴 Sleep<span class="action-sub">+50 Energy</span></button>
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
    <p class="screen-sub">Drop rates are published — check each egg.</p>
    <div class="shop-grid">
      ${g.EGG_TYPES.map(e => {
        const rar = g.RARITY[e.tier];
        const priceStr = priceLabel(e);
        const dropsStr = Object.entries(e.dropWeights)
          .map(([r,w]) => `<span style="color:${g.RARITY[r]?.color || '#000'}">${(w*100).toFixed(0)}% ${r}</span>`)
          .join('  ');
        return `
          <div class="shop-card" style="--rarity:${rar.color}; --glow:${rar.glow}">
            <div class="shop-emoji">${e.emoji}</div>
            <div class="shop-name" style="color:${rar.color}">${e.name}</div>
            <div class="shop-sub">${priceStr} · ${Math.ceil(e.hatchSeconds/60)} min hatch</div>
            <div class="shop-drops">${dropsStr}</div>
            <button class="buy-egg-btn" data-egg="${e.id}">Buy</button>
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
      ${g.ITEMS.map(i => `
        <div class="shop-card">
          <div class="shop-emoji">${i.emoji}</div>
          <div class="shop-name">${i.name}</div>
          <div class="shop-sub">${priceLabel(i)}</div>
          <div class="shop-effect">${effectLabel(i.effect)}</div>
          <button class="buy-item-btn" data-item="${i.id}">Buy</button>
        </div>
      `).join('')}
    </div>

    ${g.state.player.fragments >= g.CONFIG.fragmentsPerFreeEgg ? `
      <div class="frag-redeem-row">
        <div>🧩 You have ${g.state.player.fragments} egg fragments. Redeem 10 for a free Common Egg!</div>
        <button id="redeem-frags">Redeem</button>
      </div>` : ''}
  `;

  root.querySelectorAll('.buy-egg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        const egg = g.buyEgg(Number(btn.dataset.egg));
        const sp = g.species(egg.predeterminedSpeciesId);
        // Hide species, just tell them it's incubating
        showToast(`🥚 Egg bought! Incubating — check Eggs tab in ${Math.ceil((egg.readyAt-Date.now())/60000)} min.`);
        renderShop();
      } catch (e) { alert(e.message); }
    });
  });
  root.querySelectorAll('.buy-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      try { g.buyItem(Number(btn.dataset.item)); renderShop(); showToast('Bought!'); }
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
