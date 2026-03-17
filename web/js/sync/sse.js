/**
 * sync/sse.js — Server-Sent Events connection and remote state application.
 */

import { API_BASE } from '../config.js';
import { combatState, onlineState, appFlags } from '../state.js';
import { buildSirvienteCharData } from '../combat/summons.js';
import { setView, currentView } from '../ui/router.js';

// ── Re-attach charData after receiving remote state ───────────────────────────
export function _hydrateParticipants(participants) {
    (participants || []).forEach(p => {
        if (p._isSirvienteInvisible) {
            p.charData = buildSirvienteCharData(p.ac);
        } else {
            p.charData = window.characterData?.[p.id] || null;
        }
        if (!p.customActions) p.customActions = [];
    });
}

// ── Apply state received from SSE ─────────────────────────────────────────────
export function applyRemoteState(data) {
    if (data._clientId === (window.__CLIENT_ID || '')) return; // own echo

    if (data.status === 'RUNNING' && currentView() === 'onlineWaiting') {
        _hydrateParticipants(data.participants);
        Object.assign(combatState, {
            participants:      data.participants      || [],
            currentIndex:      data.currentIndex      ?? 0,
            round:             data.round             ?? 1,
            isActive:          true,
            segundaAccionTurn: data.segundaAccionTurn ?? false,
            extraAttackTurn:   data.extraAttackTurn   ?? false,
            nextLogId:         data.nextLogId         ?? 0,
            log:               data.log               || [],
        });
        appFlags.combatModeActive = true;
        setView('combatManager');
        window.renderCombatManager();
        window.renderCombatShareLink();
        return;
    }

    if (currentView() === 'onlineWaiting') {
        window.updateWaitingRoom(data.connectedDevices?.length ?? 1, data.joinCode || onlineState.activeJoinCode);
        return;
    }

    _hydrateParticipants(data.participants);
    Object.assign(combatState, {
        participants:      data.participants      || [],
        currentIndex:      data.currentIndex      ?? combatState.currentIndex,
        round:             data.round             ?? combatState.round,
        isActive:          data.isActive          ?? combatState.isActive,
        segundaAccionTurn: data.segundaAccionTurn ?? false,
        extraAttackTurn:   data.extraAttackTurn   ?? false,
        nextLogId:         data.nextLogId         ?? combatState.nextLogId,
        log:               data.log               || combatState.log,
    });
    if (appFlags.combatModeActive) window.renderCombatManager();
}

// ── Open SSE connection ───────────────────────────────────────────────────────
export function connectToSSE(id) {
    if (onlineState.sseSource) { onlineState.sseSource.close(); onlineState.sseSource = null; }
    onlineState.sseSource = new EventSource(`${API_BASE}/api/combats/${id}/stream`);
    onlineState.sseSource.onmessage = e => {
        try { applyRemoteState(JSON.parse(e.data)); } catch (_) {}
    };
}
