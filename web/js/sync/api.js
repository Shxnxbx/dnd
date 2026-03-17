/**
 * sync/api.js — Persistence layer: localStorage + debounced/immediate API PUT.
 */

import { API_BASE, CLIENT_ID, COMBAT_SAVE_KEY } from '../config.js';
import { combatState, onlineState, appFlags } from '../state.js';
import { buildSirvienteCharData } from '../combat/summons.js';

// ── Build the body for an API save ────────────────────────────────────────────
export function _buildSaveBody() {
    return {
        participants:      combatState.participants.map(p => ({ ...p, charData: null })),
        currentIndex:      combatState.currentIndex,
        round:             combatState.round,
        isActive:          combatState.isActive,
        segundaAccionTurn: combatState.segundaAccionTurn,
        extraAttackTurn:   combatState.extraAttackTurn,
        nextLogId:         combatState.nextLogId,
        log:               combatState.log,
        _clientId:         CLIENT_ID,
    };
}

// ── Debounced PUT (800 ms) ────────────────────────────────────────────────────
export function saveToApi() {
    if (!onlineState.activeCombatId || !combatState.isActive) return;
    clearTimeout(onlineState.saveTimer);
    onlineState.saveTimer = setTimeout(async () => {
        try {
            await fetch(`${API_BASE}/api/combats/${onlineState.activeCombatId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(_buildSaveBody()),
            });
        } catch (e) { console.warn('[sync] PUT failed:', e.message); }
    }, 800);
}

// ── Immediate PUT (bypasses debounce for turn-revert) ─────────────────────────
export function saveToApiNow() {
    if (!onlineState.activeCombatId || !combatState.isActive) return;
    clearTimeout(onlineState.saveTimer);
    onlineState.saveTimer = null;
    fetch(`${API_BASE}/api/combats/${onlineState.activeCombatId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_buildSaveBody()),
    }).catch(e => console.warn('[sync] immediate PUT failed:', e.message));
}

// ── Combined save: localStorage + optional API ────────────────────────────────
// opts.immediate — use saveToApiNow instead of debounced saveToApi
export function saveCombatState(opts = {}) {
    if (!combatState.isActive) return;
    const toSave = {
        ...combatState,
        participants: combatState.participants.map(p => ({ ...p, charData: null })),
    };
    try { localStorage.setItem(COMBAT_SAVE_KEY, JSON.stringify(toSave)); } catch (e) {}
    if (onlineState.isOnlineCombat) {
        if (opts.immediate) saveToApiNow(); else saveToApi();
    }
}

export function clearSavedCombat() {
    localStorage.removeItem(COMBAT_SAVE_KEY);
}

// ── Load saved combat on startup ──────────────────────────────────────────────
export function loadSavedCombatIfAny() {
    const raw = localStorage.getItem(COMBAT_SAVE_KEY);
    if (!raw) return;
    try {
        const saved = JSON.parse(raw);
        if (!saved.isActive || !saved.participants?.length) return;
        saved.participants.forEach(p => {
            if (p._isSirvienteInvisible) {
                p.charData = buildSirvienteCharData(p.ac);
            } else {
                p.charData = window.characterData?.[p.id] || null;
            }
            if (!p.customActions) p.customActions = [];
            if (p.isGroup) {
                if (p.totalHp          === undefined) p.totalHp          = p.hp.current;
                if (p.hpPerMember      === undefined) p.hpPerMember      = p.hp.max / (p.groupSize || 1);
                if (p.membersRemaining === undefined) p.membersRemaining = Math.ceil(p.totalHp / (p.hpPerMember || 1));
                if (p.currentMemberHp  === undefined) p.currentMemberHp  = p.hp.current % (p.hpPerMember || 1) || p.hpPerMember;
            }
        });
        Object.assign(combatState, saved);
        showCombatResumePrompt();
    } catch (e) { clearSavedCombat(); }
}

function showCombatResumePrompt() {
    const names = combatState.participants.map(p => p.name.split(' ')[0]).join(', ');
    const overlay = document.createElement('div');
    overlay.id = 'combatResumeOverlay';
    overlay.className = 'combat-resume-overlay';
    overlay.innerHTML = `
        <div class="combat-resume-modal">
            <div class="combat-resume-title">⚔️ Combate guardado</div>
            <div class="combat-resume-info">
                Ronda ${combatState.round} · ${combatState.participants.length} participantes
                <br><small>${names}</small>
            </div>
            <div class="combat-resume-btns">
                <button class="btn-combat-primary" onclick="resumeSavedCombat()">▶ Reanudar</button>
                <button class="btn-combat-secondary" onclick="discardSavedCombat()">🗑 Descartar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

export function resumeSavedCombat() {
    document.getElementById('combatResumeOverlay')?.remove();
    appFlags.combatModeActive = true;
    // renderCombatManager called from main via window exposure
    window.setView('combatManager');
    window.renderCombatManager();
}

export function discardSavedCombat() {
    document.getElementById('combatResumeOverlay')?.remove();
    Object.assign(combatState, {
        isActive: false, participants: [], selectedIds: [],
        log: [], round: 1, currentIndex: 0, nextLogId: 0, segundaAccionTurn: false,
    });
    clearSavedCombat();
}
