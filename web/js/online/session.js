/**
 * online/session.js — Online lobby: create session, join, waiting room.
 */

import { API_BASE, CLIENT_ID, COMBAT_ID_KEY } from '../config.js';
import { combatState, onlineState } from '../state.js';
import { roleState } from '../state.js';
import { ROLE_KEY } from '../config.js';
import { isMaster, updateRoleIndicator } from '../auth/role.js';
import { connectToSSE } from '../sync/sse.js';
import { _hydrateParticipants } from '../sync/sse.js';
import { setView } from '../ui/router.js';
import { showNotification } from '../ui/notifications.js';

export function showOnlineLobby() {
    setView('onlineLobby');
    document.getElementById('onlineJoinError')?.remove();
}

export function startOnlineCombatSetup() {
    onlineState.isOnlineCombat = true;
    roleState.gameRole = { type: 'master', characterId: null };
    localStorage.setItem(ROLE_KEY, JSON.stringify(roleState.gameRole));
    updateRoleIndicator();
    window.showCombatSetup();
}

export async function startCombatSession() {
    showNotification('⏳ Creando sesión online…', 2000);
    try {
        const body = {
            participants:      combatState.participants.map(p => ({ ...p, charData: null })),
            currentIndex:      combatState.currentIndex,
            round:             combatState.round,
            isActive:          false,
            segundaAccionTurn: false,
            extraAttackTurn:   false,
            nextLogId:         combatState.nextLogId,
            log:               combatState.log,
            deviceId:          CLIENT_ID,
        };
        const res = await fetch(`${API_BASE}/api/combats`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showNotification(`❌ Error al crear sesión: ${err.error || res.status}`, 4000);
            return;
        }
        const data = await res.json();
        onlineState.activeCombatId = String(data.combatId);
        onlineState.activeJoinCode = data.joinCode;
        localStorage.setItem(COMBAT_ID_KEY, onlineState.activeCombatId);
        connectToSSE(onlineState.activeCombatId);
        setView('onlineWaiting');
        updateWaitingRoom(data.deviceCount ?? 1, onlineState.activeJoinCode, true);
    } catch (e) {
        console.error('[online] startCombatSession error:', e);
        showNotification(`❌ Sin conexión con el servidor (${e.message})`, 5000);
    }
}

export function updateWaitingRoom(deviceCount, joinCode, isMasterDevice) {
    const el = document.getElementById('onlineWaitingView');
    if (!el) return;
    const code   = joinCode || onlineState.activeJoinCode || '------';
    const enough = deviceCount >= 2;
    const isMstr = isMasterDevice !== undefined ? isMasterDevice : isMaster();

    el.querySelector('#waitingJoinCode').textContent = code;
    el.querySelector('#waitingDeviceCount').textContent = deviceCount;
    el.querySelector('#waitingDeviceMsg').textContent =
        enough ? '✅ ¡Listo para empezar!' : `Esperando más jugadores… (mínimo 2)`;

    const btn = el.querySelector('#btnStartCombat');
    if (btn) {
        btn.style.display = isMstr ? 'block' : 'none';
        btn.disabled      = !enough;
        btn.textContent   = enough ? '⚔️ Iniciar combate' : `⏳ Esperando jugadores (${deviceCount}/2)`;
    }
}

export async function startOnlineCombat() {
    if (!onlineState.activeCombatId) return;
    try {
        const res  = await fetch(`${API_BASE}/api/combats/${onlineState.activeCombatId}/start`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _clientId: CLIENT_ID }),
        });
        const data = await res.json();
        if (!res.ok) { showNotification(`❌ ${data.error}`, 4000); return; }
        combatState.isActive = true;
        window.combatModeActive = true; // legacy compat — appFlags updated in main
        setView('combatManager');
        window.renderCombatManager();
        renderCombatShareLink();
    } catch (e) {
        showNotification(`❌ Error al iniciar: ${e.message}`, 4000);
    }
}

export function showOnlineCodeModal(joinCode) {
    if (!joinCode) return;
    document.getElementById('onlineCodeModal')?.remove();
    navigator.clipboard?.writeText(joinCode).catch(() => {});
    const modal = document.createElement('div');
    modal.id = 'onlineCodeModal';
    modal.className = 'online-code-modal-overlay';
    modal.innerHTML = `
        <div class="online-code-modal">
            <div class="online-code-modal-title">🌐 Código de sala</div>
            <div class="online-code-modal-subtitle">Comparte este código con los demás jugadores</div>
            <div class="online-code-big">${joinCode}</div>
            <div class="online-code-modal-btns">
                <button class="online-code-copy-btn"
                        onclick="navigator.clipboard.writeText('${joinCode}').then(()=>showNotification('✅ Código copiado',1500))">
                    🔢 Copiar código
                </button>
            </div>
            <div class="online-code-hint">El código ya se ha copiado automáticamente al portapapeles</div>
            <button class="online-code-close-btn" onclick="document.getElementById('onlineCodeModal').remove()">Cerrar</button>
        </div>`;
    document.body.appendChild(modal);
}

export function showCurrentSessionCode() {
    if (onlineState.activeJoinCode) {
        showOnlineCodeModal(onlineState.activeJoinCode);
    } else {
        showNotification('No hay código de sesión activo', 2000);
    }
}

export function renderCombatShareLink() {
    const el = document.getElementById('combatShareLink');
    if (!el || !onlineState.activeJoinCode) return;
    el.innerHTML = `
        <span class="share-link-label">🌐</span>
        <span class="share-link-code" title="Código de sala">${onlineState.activeJoinCode}</span>
        <button class="share-link-copy"
                onclick="navigator.clipboard.writeText('${onlineState.activeJoinCode}').then(()=>showNotification('✅ Código copiado',1500));showOnlineCodeModal('${onlineState.activeJoinCode}')"
                title="Ver código">📋</button>`;
    el.style.display = 'flex';
}

export async function joinOnlineSession() {
    const input = (document.getElementById('onlineJoinInput')?.value || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(input)) {
        showOnlineError('Introduce el código de 6 caracteres (ej: AB12CD)');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/api/combats/join`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ joinCode: input, deviceId: CLIENT_ID }),
        });
        const data = await res.json();
        if (!res.ok) { showOnlineError(data.error || 'Partida no encontrada'); return; }

        onlineState.isOnlineCombat = true;
        onlineState.activeJoinCode = data.joinCode;
        onlineState.activeCombatId = String(data.combatId);
        roleState.gameRole = { type: 'master', characterId: null };
        localStorage.setItem(ROLE_KEY, JSON.stringify(roleState.gameRole));
        localStorage.setItem(COMBAT_ID_KEY, onlineState.activeCombatId);
        updateRoleIndicator();
        connectToSSE(onlineState.activeCombatId);

        if (data.status === 'RUNNING' || data.combat?.status === 'RUNNING') {
            _hydrateParticipants(data.combat?.participants || []);
            Object.assign(combatState, {
                participants:      data.combat?.participants || [],
                currentIndex:      data.combat?.currentIndex ?? 0,
                round:             data.combat?.round ?? 1,
                isActive:          true,
                segundaAccionTurn: data.combat?.segundaAccionTurn ?? false,
                extraAttackTurn:   data.combat?.extraAttackTurn ?? false,
                nextLogId:         data.combat?.nextLogId ?? 0,
                log:               data.combat?.log || [],
            });
            window.combatModeActive = true;
            setView('combatManager');
            window.renderCombatManager();
            renderCombatShareLink();
        } else {
            setView('onlineWaiting');
            updateWaitingRoom(data.deviceCount ?? 1, onlineState.activeJoinCode, false);
        }
    } catch (e) {
        showOnlineError('Error de conexión — comprueba que el servidor está activo');
        console.error('[online] join error:', e);
    }
}

export function showOnlineError(msg) {
    const el = document.getElementById('onlineLobbyView');
    if (!el) return;
    let err = document.getElementById('onlineJoinError');
    if (!err) {
        err = document.createElement('div');
        err.id = 'onlineJoinError';
        err.className = 'online-error';
        el.appendChild(err);
    }
    err.textContent = '⚠️ ' + msg;
}

export function clearOnlineSession() {
    onlineState.isOnlineCombat = false;
    onlineState.activeCombatId = null;
    onlineState.activeJoinCode = null;
    localStorage.removeItem(COMBAT_ID_KEY);
    if (onlineState.sseSource) { onlineState.sseSource.close(); onlineState.sseSource = null; }
    const el = document.getElementById('combatShareLink');
    if (el) el.style.display = 'none';
}
