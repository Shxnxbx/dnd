/**
 * auth/role.js — Master / Player role selection and persistence.
 */

import { ROLE_KEY } from '../config.js';
import { roleState } from '../state.js';

export function isMaster() { return roleState.gameRole.type === 'master'; }

export function initRole() {
    const saved = localStorage.getItem(ROLE_KEY);
    if (saved) {
        try { roleState.gameRole = JSON.parse(saved); } catch (e) {}
        updateRoleIndicator();
        return;
    }
    showRoleSelectionOverlay();
}

export function showRoleSelectionOverlay() {
    document.getElementById('roleSelectOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'roleSelectOverlay';
    overlay.className = 'role-select-overlay';
    overlay.innerHTML = `
        <div class="role-select-modal">
            <div class="role-select-title">⚔️ Crónicas de D&D</div>
            <div class="role-select-subtitle">Elige tu rol para esta sesión</div>
            <div class="role-cards">
                <button class="role-card master-card" onclick="selectRole('master', null)">
                    🎲 Master
                    <small>Control total del combate</small>
                </button>
                <button class="role-card player-card" onclick="showPlayerPicker()">
                    🗡️ Jugador
                    <small>Gestiona tu propio turno</small>
                </button>
            </div>
            <div id="playerPickerSection" style="display:none">
                <div class="role-picker-label">¿Qué personaje eres?</div>
                <div id="playerPickerCards" class="player-picker-cards"></div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

export function showPlayerPicker() {
    const section = document.getElementById('playerPickerSection');
    const cardsEl = document.getElementById('playerPickerCards');
    if (!section || !cardsEl) return;
    section.style.display = 'block';
    const jugadores = Object.entries(window.characterData || {})
        .filter(([, ch]) => ch.tipo === 'jugador');
    cardsEl.innerHTML = jugadores.map(([id, ch]) =>
        `<button class="player-picker-card" onclick="selectRole('jugador','${id}')">
            ${ch.nombre || id}
        </button>`
    ).join('') || '<span style="color:var(--text-muted)">No hay jugadores disponibles</span>';
}

export function selectRole(type, characterId) {
    roleState.gameRole = { type, characterId };
    localStorage.setItem(ROLE_KEY, JSON.stringify(roleState.gameRole));
    document.getElementById('roleSelectOverlay')?.remove();
    updateRoleIndicator();
}

export function updateRoleIndicator() {
    if (isMaster()) {
        document.body.classList.remove('role-jugador');
    } else {
        document.body.classList.add('role-jugador');
    }
    const indicator = document.getElementById('roleIndicator');
    if (!indicator) return;
    if (isMaster()) {
        indicator.className = 'role-indicator master';
        indicator.textContent = '🎲 Master';
    } else {
        const ch = window.characterData?.[roleState.gameRole.characterId];
        const name = ch ? (ch.nombre || roleState.gameRole.characterId) : roleState.gameRole.characterId;
        indicator.className = 'role-indicator jugador';
        indicator.textContent = `🗡️ ${name}`;
    }
}
