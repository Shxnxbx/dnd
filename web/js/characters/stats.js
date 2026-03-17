/**
 * characters/stats.js — Character HP, spell slots, conditions, death saves,
 *                        dice roller, demonic form and combat options menu.
 */

import {
    hpState, spellSlotState, inspirationState, conditionsState,
    deathSaveState, notesState, diceHistory, demonicFormState,
} from '../state.js';
import { appFlags } from '../state.js';
import { CONDITIONS } from '../config.js';
import { showNotification } from '../ui/notifications.js';

// ── Storage ───────────────────────────────────────────────────────────────────
export function saveStateToStorage() {
    try {
        localStorage.setItem('dnd_hp',         JSON.stringify(hpState));
        localStorage.setItem('dnd_slots',      JSON.stringify(spellSlotState));
        localStorage.setItem('dnd_inspiration',JSON.stringify(inspirationState));
        localStorage.setItem('dnd_conditions', JSON.stringify(conditionsState));
        localStorage.setItem('dnd_deathsaves', JSON.stringify(deathSaveState));
        localStorage.setItem('dnd_demonic',    JSON.stringify(demonicFormState));
        localStorage.setItem('dnd_notes',      JSON.stringify(notesState));
    } catch (e) {}
}

export function loadStateFromStorage() {
    try {
        const hp   = localStorage.getItem('dnd_hp');          if (hp)   Object.assign(hpState,          JSON.parse(hp));
        const sl   = localStorage.getItem('dnd_slots');        if (sl)   Object.assign(spellSlotState,   JSON.parse(sl));
        const ins  = localStorage.getItem('dnd_inspiration');  if (ins)  Object.assign(inspirationState, JSON.parse(ins));
        const cond = localStorage.getItem('dnd_conditions');   if (cond) Object.assign(conditionsState,  JSON.parse(cond));
        const ds   = localStorage.getItem('dnd_deathsaves');   if (ds)   Object.assign(deathSaveState,   JSON.parse(ds));
        const dem  = localStorage.getItem('dnd_demonic');      if (dem)  Object.assign(demonicFormState, JSON.parse(dem));
        const nt   = localStorage.getItem('dnd_notes');        if (nt)   Object.assign(notesState,       JSON.parse(nt));
    } catch (e) {}
}

// ── HP helpers ────────────────────────────────────────────────────────────────
export function initHpForChar(charId) {
    if (!hpState[charId]) {
        const maxHp = parseInt(window.characterData[charId]?.resumen?.HP) || 0;
        hpState[charId] = { current: maxHp, max: maxHp };
    }
}

export function initDeathSavesForChar(charId) {
    if (!deathSaveState[charId]) deathSaveState[charId] = { successes: 0, failures: 0 };
}

export function initSpellSlotsForChar(charId) {
    if (!spellSlotState[charId]) {
        const data = window.characterData[charId];
        spellSlotState[charId] = {};
        if (data?.ranuras) data.ranuras.forEach(s => { spellSlotState[charId][s.nombre] = s.total; });
    }
}

export function getSliderGradient(pct) {
    const color = pct <= 25 ? '#ff4444' : pct <= 50 ? '#ffaa00' : '#44cc66';
    return `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
}

export function setHp(value) {
    const charId = appFlags.currentCharacterId;
    if (!charId) return;
    initHpForChar(charId);
    const hp    = hpState[charId];
    const wasAlive = hp.current > 0;
    hp.current  = Math.max(0, Math.min(hp.max, value));

    const pct       = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
    const currentEl = document.getElementById('hpCurrent');
    const sliderEl  = document.getElementById('hpSlider');
    const sectionEl = document.querySelector('.hp-bar-section');
    const deathEl   = document.getElementById('deathSavesSection');

    if (currentEl) currentEl.textContent = hp.current;
    if (sliderEl)  { sliderEl.value = hp.current; sliderEl.style.background = getSliderGradient(pct); }
    if (sectionEl) {
        sectionEl.classList.toggle('unconscious', hp.current === 0);
        sectionEl.classList.toggle('critical', pct <= 25 && hp.current > 0);
    }
    if (deathEl) deathEl.style.display = hp.current === 0 ? 'flex' : 'none';
    if (!wasAlive && hp.current > 0 && deathSaveState[charId]) {
        deathSaveState[charId] = { successes: 0, failures: 0 };
    }
    saveStateToStorage();
    if (hp.current === 0) showNotification('💀 ¡Sin puntos de golpe!', 3000);
    else if (hp.current <= Math.floor(hp.max * 0.25)) showNotification('⚠️ HP crítico', 2000);
}

export function renderHpSection(charId) {
    initHpForChar(charId);
    initDeathSavesForChar(charId);
    const hp  = hpState[charId];
    const ds  = deathSaveState[charId];
    const pct = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
    const isCritical    = pct <= 25 && hp.current > 0;
    const isUnconscious = hp.current === 0;
    const hasInspiration = inspirationState[charId] || false;

    const makeDsPips = (type, count) =>
        [0,1,2].map(i => `<button class="ds-pip ${type}${i < count ? ' filled' : ''}"
            onclick="toggleDeathSave('${charId}','${type}',${i})" title="${type === 'success' ? 'Éxito' : 'Fallo'}"></button>`).join('');

    return `
        <div class="hp-bar-section${isUnconscious ? ' unconscious' : ''}${isCritical ? ' critical' : ''}">
            <div class="hp-bar-header">
                <div class="hp-info">
                    <div class="pill-label">❤️ Puntos de Golpe</div>
                    <div class="hp-display">
                        <span id="hpCurrent">${hp.current}</span><span class="hp-max"> / ${hp.max}</span>
                    </div>
                </div>
                <button class="inspiration-btn${hasInspiration ? ' active' : ''}"
                        onclick="toggleInspiration('${charId}')" title="Inspiración">⭐</button>
            </div>
            <input type="range" class="hp-slider" id="hpSlider"
                   min="0" max="${hp.max}" value="${hp.current}"
                   oninput="setHp(parseInt(this.value))"
                   style="background: ${getSliderGradient(pct)}"
                   aria-label="Puntos de golpe">
            <div class="death-saves-section" id="deathSavesSection" style="display:${isUnconscious ? 'flex' : 'none'}">
                <div class="ds-title">💀 Salvaciones de Muerte</div>
                <div class="ds-row"><span class="ds-label success">Éxitos</span>
                    <div class="ds-pips">${makeDsPips('success', ds.successes)}</div></div>
                <div class="ds-row"><span class="ds-label failure">Fallos</span>
                    <div class="ds-pips">${makeDsPips('failure', ds.failures)}</div></div>
            </div>
        </div>`;
}

export function toggleInspiration(charId) {
    inspirationState[charId] = !inspirationState[charId];
    const btn = document.querySelector('.inspiration-btn');
    if (btn) btn.classList.toggle('active', inspirationState[charId]);
    saveStateToStorage();
    showNotification(inspirationState[charId] ? '⭐ ¡Inspiración!' : '⭐ Inspiración usada', 2000);
}

export function toggleDeathSave(charId, type, index) {
    initDeathSavesForChar(charId);
    const ds  = deathSaveState[charId];
    const key = type + 's';
    ds[key] = (index < ds[key]) ? index : Math.min(3, index + 1);
    document.querySelectorAll(`#deathSavesSection .ds-pip.${type}`).forEach((pip, i) => {
        pip.classList.toggle('filled', i < ds[key]);
    });
    saveStateToStorage();
    if (ds.successes >= 3) showNotification('✅ ¡Estabilizado!', 3000);
    if (ds.failures  >= 3) showNotification('💀 ¡Has muerto!', 5000);
}

export function renderConditionsBar(charId) {
    if (!conditionsState[charId]) conditionsState[charId] = [];
    const active = conditionsState[charId];
    return `<div class="conditions-bar" id="conditionsBar">
        ${CONDITIONS.map(c => `<button class="condition-btn${active.includes(c.id) ? ' active' : ''}"
            onclick="toggleCondition('${charId}','${c.id}')" title="${c.title}">${c.label} ${c.title}</button>`).join('')}
    </div>`;
}

export function toggleCondition(charId, condId) {
    if (!conditionsState[charId]) conditionsState[charId] = [];
    const idx = conditionsState[charId].indexOf(condId);
    if (idx >= 0) conditionsState[charId].splice(idx, 1);
    else          conditionsState[charId].push(condId);
    document.querySelectorAll('#conditionsBar .condition-btn').forEach(btn => {
        const id = btn.getAttribute('onclick').match(/'([^']+)'\)$/)?.[1];
        if (id) btn.classList.toggle('active', conditionsState[charId].includes(id));
    });
    saveStateToStorage();
}

export function toggleSpellSlot(charId, slotName, index) {
    initSpellSlotsForChar(charId);
    const data    = window.characterData[charId];
    const slotDef = data.ranuras?.find(s => s.nombre === slotName);
    if (!slotDef) return;
    const cur = spellSlotState[charId][slotName];
    spellSlotState[charId][slotName] = Math.max(0, Math.min(slotDef.total, index < cur ? index : index + 1));
    const remaining = spellSlotState[charId][slotName];
    document.querySelectorAll(`.slot-track[data-slot="${slotName}"] .slot-pip`).forEach((pip, i) => {
        pip.classList.toggle('used', i >= remaining);
    });
    const countEl = document.querySelector(`.slot-count[data-slot="${slotName}"]`);
    if (countEl) countEl.textContent = `${remaining}/${slotDef.total}`;
    saveStateToStorage();
}

export function resetSpellSlots(charId) {
    const data = window.characterData[charId];
    if (!data?.ranuras) return;
    data.ranuras.forEach(s => { spellSlotState[charId][s.nombre] = s.total; });
    window.renderSpellsWithFilters(data);
    saveStateToStorage();
    showNotification('🌙 Descanso largo: slots restaurados', 2500);
}

export function saveNote(charId, text) {
    notesState[charId] = text;
    saveStateToStorage();
}

// ── Dice roller ───────────────────────────────────────────────────────────────
export function updateDiceHistory() {
    const el = document.getElementById('diceHistory');
    if (!el || diceHistory.length === 0) return;
    el.innerHTML = diceHistory.map(r => {
        const cls = r.sides === 20 && r.result === 20 ? ' crit' : r.sides === 20 && r.result === 1 ? ' fumble' : '';
        return `<span class="history-chip${cls}">d${r.sides}:${r.result}</span>`;
    }).join('');
}

export function setupDiceRoller() {
    const toggleBtn = document.getElementById('diceToggleBtn');
    const panel     = document.getElementById('dicePanel');
    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = panel.classList.toggle('open');
        toggleBtn.classList.toggle('open', isOpen);
    });
    document.querySelectorAll('.die-btn').forEach(btn => {
        btn.addEventListener('click', () => rollDie(parseInt(btn.dataset.sides)));
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.dice-roller-widget')) {
            panel.classList.remove('open');
            toggleBtn.classList.remove('open');
        }
    });
}

export function _closeOptionsMenu() {
    document.getElementById('optionsMenu')?.classList.remove('open');
    document.getElementById('optionsMenuToggle')?.classList.remove('open');
}

export function setupCombatOptionsMenu() {
    const toggleBtn = document.getElementById('optionsMenuToggle');
    const menu      = document.getElementById('optionsMenu');
    if (!toggleBtn || !menu) return;
    if (toggleBtn.dataset.menuBound) return;
    toggleBtn.dataset.menuBound = '1';

    toggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = menu.classList.toggle('open');
        toggleBtn.classList.toggle('open', isOpen);
    });
    document.addEventListener('click', e => {
        if (!menu.contains(e.target) && !toggleBtn.contains(e.target)) _closeOptionsMenu();
    }, true);
}

export function rollDie(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    diceHistory.unshift({ sides, result });
    if (diceHistory.length > 5) diceHistory.pop();
    updateDiceHistory();
    const resultEl = document.getElementById('diceResultValue');
    const labelEl  = document.getElementById('diceDieLabel');
    if (!resultEl) return;

    resultEl.classList.remove('rolling', 'crit', 'fumble');
    void resultEl.offsetWidth;
    resultEl.classList.add('rolling');

    const isCrit   = sides === 20 && result === 20;
    const isFumble = sides === 20 && result === 1;
    resultEl.textContent = result;
    if (labelEl) labelEl.textContent = `d${sides}`;

    if (isCrit)   { resultEl.classList.add('crit');   showNotification('⭐ ¡CRÍTICO! ¡Resultado perfecto!', 3000); }
    else if (isFumble) { resultEl.classList.add('fumble'); showNotification('💀 ¡Pifia! El destino es cruel...', 3000); }
}

// ── Demonic form (character sheet context) ────────────────────────────────────
export function renderDemonicSection(charId) {
    const section = document.getElementById('sheetResources');
    if (!section) return;
    section.style.display = 'flex';
    let html = renderConditionsBar(charId);
    if (charId === 'Vel') {
        const ds    = demonicFormState[charId] || { active: false, turnsLeft: 0 };
        const btnCls = 'btn-demonic' + (ds.active ? ' active' : '');
        const label  = ds.active ? `😈 Demoníaca — ${ds.turnsLeft}🔥` : '😈 Forma Demoníaca';
        html += `<button class="${btnCls}" onclick="toggleDemonicForm('Vel')">${label}</button>`;
        if (ds.active) {
            html += `<button class="btn-demonic-turn" onclick="advanceDemonicTurn('Vel')">⏭️ Siguiente turno</button>`;
        }
    }
    section.innerHTML = html;
}

export function toggleDemonicForm(charId) {
    if (!demonicFormState[charId]) demonicFormState[charId] = { active: false, turnsLeft: 0 };
    const ds   = demonicFormState[charId];
    ds.active  = !ds.active;
    ds.turnsLeft = ds.active ? 6 : 0;
    updateDemonicFormDisplay(charId);
    saveStateToStorage();
    showNotification(ds.active ? '😈 ¡Forma Demoníaca activa!' : '💔 Forma Demoníaca terminada', 2200);
}

export function advanceDemonicTurn(charId) {
    const ds = demonicFormState[charId];
    if (!ds?.active) return;
    ds.turnsLeft = Math.max(0, ds.turnsLeft - 1);
    if (ds.turnsLeft === 0) { ds.active = false; showNotification('💀 Forma Demoníaca terminada', 2500); }
    updateDemonicFormDisplay(charId);
    saveStateToStorage();
}

export function updateDemonicFormDisplay(charId) {
    const ds   = demonicFormState[charId] || { active: false };
    const data = window.characterData[charId];
    if (!data) return;

    const pillCA = document.getElementById('pillCA');
    if (pillCA) {
        const v = pillCA.querySelector('.pill-value');
        if (v) v.textContent = ds.active ? String(parseInt(data.resumen.CA) + 2) : data.resumen.CA;
        pillCA.classList.toggle('demonic-active', ds.active);
        pillCA.style.borderLeftColor = ds.active ? '#ff2222' : '#4488ff';
    }
    const pillSpeed = document.getElementById('pillSpeed');
    if (pillSpeed) {
        const v = pillSpeed.querySelector('.pill-value');
        if (v) v.textContent = ds.active ? '50ft' : data.resumen.Velocidad;
        pillSpeed.classList.toggle('demonic-active', ds.active);
        pillSpeed.style.borderLeftColor = ds.active ? '#ff2222' : '#ffcc44';
    }
    renderDemonicSection(charId);
}
