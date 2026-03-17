/**
 * combat/engine.js — Turn navigation: advance, revert, skip mini-turns, end combat.
 */

import { combatState, onlineState, appFlags } from '../state.js';
import { showNotification } from '../ui/notifications.js';
import { setView } from '../ui/router.js';
import { saveCombatState, clearSavedCombat } from '../sync/api.js';
import { isMaster } from '../auth/role.js';
import {
    getCurrentLogEntry,
    createCurrentTurnEntry,
    renderCombatManager,
} from './rendering.js';

// ── Turn advance ──────────────────────────────────────────────────────────────

export function nextCombatTurn() {
    if (!isMaster()) {
        // Jugador personal turn manager — always advance freely, no warnings
        _doNextTurn();
        return;
    }

    const p = combatState.participants[combatState.currentIndex];
    if (p?.tipo === 'jugador') { _doNextTurn(); return; }

    const current = getCurrentLogEntry();
    // Extra attack / segunda acción mini-turns: no warning needed, can always pass
    if (combatState.extraAttackTurn) { _doNextTurn(); return; }
    if (combatState.segundaAccionTurn) { _doNextTurn(); return; }
    if (!current?.actions.length && !current?.note?.trim()) {
        showNextTurnWarning();
        return;
    }
    _doNextTurn();
}

export function showNextTurnWarning() {
    if (document.getElementById('nextTurnWarning')) return;
    const panel = document.getElementById('combatActivePanel');
    if (!panel) return;
    const div = document.createElement('div');
    div.id = 'nextTurnWarning';
    div.className = 'next-turn-warning';
    div.innerHTML = `⚠️ Sin acciones registradas. ¿Seguro que quieres continuar?
        <div style="margin-top:8px;display:flex;gap:8px;justify-content:center">
            <button class="btn-combat-secondary" onclick="confirmNextTurn()" style="padding:6px 16px">Continuar</button>
            <button class="btn-combat-secondary" onclick="dismissNextTurnWarning()" style="padding:6px 16px">Cancelar</button>
        </div>`;
    panel.prepend(div);
}

export function confirmNextTurn() {
    dismissNextTurnWarning();
    _doNextTurn();
}

export function dismissNextTurnWarning() {
    document.getElementById('nextTurnWarning')?.remove();
}

export function _doNextTurn() {
    const current = getCurrentLogEntry();
    if (current) current.isCurrent = false;

    if (combatState.extraAttackTurn) {
        combatState.extraAttackTurn = false;
        combatState.currentIndex++;
        if (combatState.currentIndex >= combatState.participants.length) {
            combatState.currentIndex = 0;
            combatState.round++;
        }
    } else if (combatState.segundaAccionTurn) {
        combatState.segundaAccionTurn = false;
        combatState.currentIndex++;
        if (combatState.currentIndex >= combatState.participants.length) {
            combatState.currentIndex = 0;
            combatState.round++;
        }
    } else {
        const currP = combatState.participants[combatState.currentIndex];
        if (currP?.charData?.extraAttack) {
            combatState.extraAttackTurn = true;
        } else if (currP?.charData?.segundaAccion) {
            combatState.segundaAccionTurn = true;
        } else {
            combatState.currentIndex++;
            if (combatState.currentIndex >= combatState.participants.length) {
                combatState.currentIndex = 0;
                combatState.round++;
            }
        }
    }

    // Skip invocations/summons waiting for their debut round
    let skipGuard = 0;
    while (skipGuard++ < combatState.participants.length) {
        const next = combatState.participants[combatState.currentIndex];
        if (next?._debutRound && next._debutRound > combatState.round) {
            combatState.currentIndex++;
            if (combatState.currentIndex >= combatState.participants.length) {
                combatState.currentIndex = 0;
                combatState.round++;
            }
        } else {
            if (next?._debutRound) delete next._debutRound;
            break;
        }
    }

    createCurrentTurnEntry();
    saveCombatState();
    renderCombatManager();
}

export function skipSegundaAccion() {
    combatState.segundaAccionTurn = false;
    const current = getCurrentLogEntry();
    if (current) current.isCurrent = false;
    combatState.currentIndex++;
    if (combatState.currentIndex >= combatState.participants.length) {
        combatState.currentIndex = 0;
        combatState.round++;
    }
    createCurrentTurnEntry();
    saveCombatState();
    renderCombatManager();
}

export function skipExtraAttack() {
    combatState.extraAttackTurn = false;
    const current = getCurrentLogEntry();
    if (current) current.isCurrent = false;
    combatState.currentIndex++;
    if (combatState.currentIndex >= combatState.participants.length) {
        combatState.currentIndex = 0;
        combatState.round++;
    }
    createCurrentTurnEntry();
    saveCombatState();
    renderCombatManager();
}

export function previousCombatTurn() {
    if (!isMaster()) return;
    const log = combatState.log;
    const currentIdx = log.findIndex(e => e.isCurrent);
    if (currentIdx <= 0) { showNotification('⬅️ Ya estás en el primer turno', 2000); return; }

    log.splice(currentIdx, 1);

    const prevEntry = log[log.length - 1];
    if (!prevEntry) return;
    prevEntry.isCurrent = true;

    const snap = prevEntry.snapshot;
    if (snap) {
        combatState.currentIndex = snap.currentIndex;
        combatState.round = snap.round;
        combatState.segundaAccionTurn = snap.segundaAccionTurn || false;
        combatState.extraAttackTurn = snap.extraAttackTurn || false;
        snap.participants.forEach(snapP => {
            const p = combatState.participants.find(x => x.id === snapP.id);
            if (p) {
                p.hp = { ...snapP.hp };
                p.conditions = [...snapP.conditions];
                p.demonicForm = snapP.demonicForm;
                p.ac = snapP.ac;
                p.speed = snapP.speed;
            }
        });
    }
    saveCombatState({ immediate: onlineState.isOnlineCombat });
    renderCombatManager();
    showNotification('⬅️ Turno anterior restaurado', 2000);
}

// ── End combat ────────────────────────────────────────────────────────────────

export function confirmEndCombat() {
    showCombatSummary();
}

export function _doClearCombat() {
    document.getElementById('combatSummaryOverlay')?.remove();
    combatState.isActive = false;
    combatState.participants = [];
    combatState.selectedIds = [];
    combatState.log = [];
    combatState.round = 1;
    combatState.currentIndex = 0;
    combatState.nextLogId = 0;
    clearSavedCombat();
    appFlags.combatModeActive = false;
    setView('landing');
}

export function buildHistoryText() {
    const rounds = {};
    combatState.log.forEach(entry => {
        if (!rounds[entry.round]) rounds[entry.round] = [];
        rounds[entry.round].push(entry);
    });
    let text = `=== COMBATE — ${combatState.round} Ronda(s) · ${combatState.participants.length} participantes ===\n\n`;
    Object.keys(rounds).sort((a, b) => a - b).forEach(round => {
        text += `RONDA ${round}\n${'─'.repeat(30)}\n`;
        rounds[round].forEach(entry => {
            text += `\n${entry.participantName}:\n`;
            entry.actions.forEach(a => {
                text += `  ⚔️ ${a.nombre}`;
                if (a.rollText) text += `\n     ${a.rollText.replace(/\*\*/g, '')}`;
                if (a.narratorText) text += `\n     📖 ${a.narratorText}`;
                text += '\n';
            });
            if (entry.note) text += `  📝 ${entry.note}\n`;
        });
        text += '\n';
    });
    return text;
}

export function copyHistoryToClipboard() {
    const text = buildHistoryText();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showNotification('📋 Historial copiado al portapapeles', 2000));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showNotification('📋 Historial copiado', 2000);
    }
}

export function showCombatSummary() {
    document.getElementById('combatSummaryOverlay')?.remove();
    const rounds = {};
    combatState.log.filter(e => !e.isCurrent || e.actions.length || e.note).forEach(entry => {
        if (!rounds[entry.round]) rounds[entry.round] = [];
        rounds[entry.round].push(entry);
    });
    const roundKeys = Object.keys(rounds).sort((a, b) => a - b);
    const bodyHTML = roundKeys.map(round => {
        const entries = rounds[round];
        const entriesHTML = entries.map(entry => `
            <div style="margin-bottom:10px">
                <strong style="color:var(--text-primary)">${entry.participantName}</strong>
                ${entry.actions.map(a => `
                    <div style="margin-left:12px;margin-top:4px">
                        <div>⚔️ ${a.nombre}${a.dice && !a.rollText ? ` (${a.dice})` : ''}</div>
                        ${a.rollText ? `<div class="combat-roll-result">${a.rollText.replace(/\*\*/g, '')}</div>` : ''}
                        ${a.narratorText ? `<div class="combat-narrator-text">${a.narratorText}</div>` : ''}
                    </div>`).join('')}
                ${entry.note ? `<div style="margin-left:12px;font-style:italic;color:var(--text-muted);font-size:12px">📝 ${entry.note}</div>` : ''}
            </div>`).join('');
        return `<div style="margin-bottom:16px">
            <div style="font-weight:700;color:var(--accent-gold);margin-bottom:8px;border-bottom:1px solid var(--border-color);padding-bottom:4px">Ronda ${round}</div>
            ${entriesHTML || '<div style="color:var(--text-muted);font-style:italic;font-size:12px">Sin acciones registradas</div>'}
        </div>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = 'combatSummaryOverlay';
    overlay.className = 'combat-resume-overlay';
    overlay.innerHTML = `
        <div class="combat-summary-modal">
            <div class="combat-summary-title">⚔️ Resumen del Combate</div>
            <div style="text-align:center;color:var(--text-muted);font-size:13px;margin-bottom:8px">
                ${combatState.round} ronda(s) · ${combatState.participants.length} participantes
            </div>
            <div class="combat-summary-body">${bodyHTML || '<div style="color:var(--text-muted);font-style:italic">Sin historial registrado</div>'}</div>
            <div class="combat-summary-btns">
                <button class="btn-combat-secondary" onclick="copyHistoryToClipboard()">📋 Copiar</button>
                <button class="btn-combat-primary" onclick="_doClearCombat()">✕ Finalizar</button>
                <button class="btn-combat-secondary" onclick="document.getElementById('combatSummaryOverlay')?.remove()">Volver</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}
