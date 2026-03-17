/**
 * combat/summons.js — Sirviente Invisible and invocation helpers.
 */

import { combatState, setupState } from '../state.js';
import { saveCombatState } from '../sync/api.js';
import { showNotification } from '../ui/notifications.js';

// ── Sirviente Invisible charData builder ──────────────────────────────────────
export function buildSirvienteCharData(ac) {
    return {
        nombre: 'Sirviente Invisible',
        clase: 'Familiar',
        nivel: 1,
        tipo: 'aliado',
        imagen: null,
        combateExtra: [
            { nombre: 'Hacha de mano',         tipo: 'accion',    atk: '+7', dado: '1d8+5', desc: 'Daño divino. Siempre ataca con ventaja (invisible).' },
            { nombre: 'Hacha de mano',         tipo: 'adicional', atk: '+5', dado: '1d8+5', desc: 'Acción adicional. Daño divino.' },
            { nombre: 'Daga',                  tipo: 'accion',    atk: '+7', dado: '1d4',   desc: 'El próximo aliado ataca con ventaja contra ese objetivo.' },
            { nombre: 'Ventaja / Desventaja',  tipo: 'accion',    atk: '',   dado: '',      desc: 'Genera ventaja o desventaja en un objetivo (sin tirada).' },
        ],
        conjuros: [],
    };
}

// ── Toggle Sirviente in active combat ─────────────────────────────────────────
export function toggleSirvienteInvisible(velParticipantId) {
    const velP = combatState.participants.find(x => x.id === velParticipantId);
    if (!velP) return;

    const sirvienteId  = 'sirviente_invisible_vel';
    const sirvienteIdx = combatState.participants.findIndex(x => x.id === sirvienteId);

    if (sirvienteIdx !== -1) {
        if (combatState.currentIndex > sirvienteIdx) {
            combatState.currentIndex--;
        } else if (combatState.currentIndex === sirvienteIdx) {
            combatState.currentIndex = combatState.participants.findIndex(x => x.id === velParticipantId);
        }
        combatState.participants.splice(sirvienteIdx, 1);
        velP.sirvienteActive = false;
        showNotification('👻 Sirviente Invisible retirado del combate', 2000);
    } else {
        const velIdx   = combatState.participants.findIndex(x => x.id === velParticipantId);
        const charData = buildSirvienteCharData(velP.ac);
        const sirviente = {
            id: sirvienteId, name: 'Sirviente Invisible',
            initiative: velP.initiative,
            hp: { current: 1, max: 1 },
            ac: velP.ac, baseAc: velP.ac,
            speed: '30ft', baseSpeed: '30ft',
            conditions: [], note: '', charData,
            demonicForm: false, tipo: 'aliado', customActions: [],
            _isSirvienteInvisible: true,
            ownerCharId: velParticipantId,
        };
        combatState.participants.splice(velIdx + 1, 0, sirviente);
        if (combatState.currentIndex > velIdx) combatState.currentIndex++;
        velP.sirvienteActive = true;
        showNotification('👻 Sirviente Invisible invocado — CA ' + velP.ac, 2500);
    }
    saveCombatState();
    window.renderCombatManager();
}

// ── Build invocation charData actions from data.json entry ────────────────────
export function _buildInvocacionActions(inv) {
    const atkStr    = inv.ataque || '';
    const atkMatch  = atkStr.match(/([+-]\d+)/);
    const dadoMatch = atkStr.match(/\(([^)]+)\)/);
    return [{
        nombre: inv.nombre,
        tipo:   'accion',
        atk:    atkMatch  ? atkMatch[1]  : '',
        dado:   dadoMatch ? dadoMatch[1] : atkStr,
        desc:   (inv.habilidades || []).join(' / '),
    }];
}
