/**
 * config.js — Compile-time constants and lookup tables.
 * No mutable state, no side effects, no imports.
 */

// ── API ───────────────────────────────────────────────────────────────────────
export const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : window.location.origin;

// ── Storage keys ──────────────────────────────────────────────────────────────
export const COMBAT_ID_KEY   = 'dnd_combat_id';
export const ROLE_KEY        = 'dnd_game_role';
export const COMBAT_SAVE_KEY = 'dnd_combat_session';

// ── Per-tab unique identifier (random on each page load) ─────────────────────
export const CLIENT_ID = Math.random().toString(36).slice(2, 10);

// ── Conditions registry ───────────────────────────────────────────────────────
export const CONDITIONS = [
    { id: 'envenenado',    label: '🤢', title: 'Envenenado'   },
    { id: 'paralizado',   label: '⛓️', title: 'Paralizado'   },
    { id: 'asustado',     label: '😱', title: 'Asustado'     },
    { id: 'cegado',       label: '🚫', title: 'Cegado'       },
    { id: 'aturdido',     label: '💫', title: 'Aturdido'     },
    { id: 'concentracion',label: '🧠', title: 'Concentración'},
];

// ── Skill → ability mapping ───────────────────────────────────────────────────
export const skillMapping = {
    'Fuerza':       ['Atletismo'],
    'Destreza':     ['Acrobacias', 'Juego de Manos', 'Sigilo'],
    'Constitución': [],
    'Inteligencia': ['Arcanos', 'Historia', 'Investigación', 'Naturaleza', 'Religión'],
    'Sabiduría':    ['Manejo de Animales', 'Perspicacia', 'Medicina', 'Percepción', 'Supervivencia'],
    'Carisma':      ['Engaño', 'Intimidación', 'Persuación', 'Interpretación'],
};
