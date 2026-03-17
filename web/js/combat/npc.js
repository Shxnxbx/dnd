/**
 * combat/npc.js — Quick-add NPC/enemy modal and invocation management.
 */

import { combatState, setupState, onlineState } from '../state.js';
import { API_BASE } from '../config.js';
import { showNotification } from '../ui/notifications.js';
import { saveCombatState } from '../sync/api.js';

let _quickNpcTipo = 'enemigo';

// ── Quick-add modals ──────────────────────────────────────────────────────────

export function showQuickEnemyModal(context) { showQuickNpcModal(context, 'enemigo'); }
export function showQuickAllyModal(context)  { showQuickNpcModal(context, 'aliado');  }

export function showQuickNpcModal(context, tipo) {
    _quickNpcTipo = tipo;
    const isEnemy = tipo === 'enemigo';
    const icon  = isEnemy ? '💀' : '💙';
    const label = isEnemy ? 'Enemigo' : 'Aliado';
    const placeholder = isEnemy ? 'Nombre (ej: Goblin)' : 'Nombre (ej: Guardia)';
    document.getElementById('quickEnemyOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'quickEnemyOverlay';
    overlay.className = 'combat-resume-overlay';

    const extraToggle = isEnemy ? `
        <div class="qe-group-row">
            <input id="qeGroupSize" class="quick-enemy-input" type="number" placeholder="Nº miembros (grupo)" min="1"
                   title="Pon 2 o más para crear un grupo. PG = HP por miembro.">
            <small class="npc-group-hint">Nº miembros ≥ 2 → grupo (PG = HP/miembro)</small>
        </div>` : `
        <div class="qe-toggle-row">
            <label class="qe-toggle-label">
                <input type="checkbox" id="qeIsSummon" onchange="toggleQeSummonFields()">
                <span>Es una invocación</span>
            </label>
            <div id="qeSummonFields" style="display:none;">
                <select id="qeSummoner" class="quick-enemy-input" style="margin-top:6px;">
                    <option value="ASTHOR">Asthor (Sirviente)</option>
                    <option value="ZERO">Zero</option>
                </select>
            </div>
        </div>`;

    overlay.innerHTML = `
        <div class="quick-enemy-modal">
            <div class="quick-enemy-title">${icon} ${label} Rápido</div>
            <input id="qeName" class="quick-enemy-input" placeholder="${placeholder}" autocomplete="off">
            <input id="qeHp" class="quick-enemy-input" type="number" placeholder="${isEnemy ? 'PG máximos (por miembro si es grupo)' : 'PG máximos'}" min="1">
            <input id="qeAc" class="quick-enemy-input" type="number" placeholder="Clase de Armadura" min="1">
            ${context === 'combat' ? `<input id="qeInit" class="quick-enemy-input" type="number" placeholder="Iniciativa (opcional, 0 = al final)">` : ''}
            ${extraToggle}

            <div class="qe-actions-section">
                <div class="qe-actions-title">⚔️ Acciones (opcional)</div>
                <div id="qeActionsList" class="qe-actions-list"></div>
                <button class="qe-add-action-btn" onclick="addQeAction()">+ Añadir acción</button>
            </div>

            <div class="quick-enemy-btns">
                <button class="btn-combat-primary" onclick="submitQuickNpc('${context}')">Añadir</button>
                <button class="btn-combat-secondary" onclick="document.getElementById('quickEnemyOverlay')?.remove()">Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('qeName')?.focus();
}

// ── Entity template save ──────────────────────────────────────────────────────

export function _saveEntityTemplate({ name, type, stats, actions, isGroup, groupSize, isSummon, summoner }) {
    fetch(`${API_BASE}/api/entity-templates`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, stats, actions, isGroup, groupSize, isSummon, summoner }),
    }).catch(e => console.warn('[entity-templates] save failed:', e.message));
}

// ── Form toggle helpers ───────────────────────────────────────────────────────

export function toggleQeGroupFields() {
    const checked = document.getElementById('qeIsGroup')?.checked;
    const fields  = document.getElementById('qeGroupFields');
    if (fields) fields.style.display = checked ? 'block' : 'none';
}

export function toggleQeSummonFields() {
    const checked = document.getElementById('qeIsSummon')?.checked;
    const fields  = document.getElementById('qeSummonFields');
    if (fields) fields.style.display = checked ? 'block' : 'none';
}

export function toggleSetupGroupFields(tipo) {
    const checked = document.getElementById(`${tipo}EsGrupo`)?.checked;
    const fields  = document.getElementById(`${tipo}GroupFields`);
    if (fields) fields.style.display = checked ? 'flex' : 'none';
}

export function toggleSetupSummonFields(tipo) {
    const checked = document.getElementById(`${tipo}EsInvocacion`)?.checked;
    const fields  = document.getElementById(`${tipo}SummonFields`);
    if (fields) fields.style.display = checked ? 'block' : 'none';
}

// ── Action row helpers ────────────────────────────────────────────────────────

export function addQeAction() {
    const list = document.getElementById('qeActionsList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'qe-action-row';
    row.innerHTML = `
        <input class="quick-enemy-input qe-action-name" placeholder="Nombre">
        <select class="qe-action-select qe-action-type">
            <option value="ACTION">Acción</option>
            <option value="BONUS_ACTION">Ac. adicional</option>
            <option value="REACTION">Reacción</option>
            <option value="EXTRA_ATTACK">Ataque extra</option>
        </select>
        <input class="quick-enemy-input qe-action-desc" placeholder="Descripción corta">
        <button class="qe-action-remove-btn" onclick="this.closest('.qe-action-row').remove()">✕</button>
    `;
    list.appendChild(row);
}

export function getQeActions() {
    return Array.from(document.querySelectorAll('#qeActionsList .qe-action-row'))
        .map(row => ({
            name:        row.querySelector('.qe-action-name')?.value?.trim() || '',
            type:        row.querySelector('.qe-action-type')?.value        || 'ACTION',
            description: row.querySelector('.qe-action-desc')?.value?.trim() || '',
        }))
        .filter(a => a.name);
}

export function _actionTypeToTipo(type) {
    return { ACTION: 'accion', BONUS_ACTION: 'adicional', REACTION: 'reaccion', EXTRA_ATTACK: 'accion' }[type] || 'accion';
}

export function submitQuickEnemy(context) { submitQuickNpc(context); }

export async function submitQuickNpc(context) {
    const tipo = _quickNpcTipo || 'enemigo';
    const isEnemy = tipo === 'enemigo';
    const icon = isEnemy ? '💀' : '💙';
    const name = document.getElementById('qeName')?.value?.trim();
    const hp   = parseInt(document.getElementById('qeHp')?.value) || 10;
    const ac   = parseInt(document.getElementById('qeAc')?.value) || 10;
    const initEl = document.getElementById('qeInit');
    const initiative = initEl ? (parseInt(initEl.value) || 0) : 0;
    if (!name) { showNotification('⚠️ Introduce un nombre', 2000); return; }

    const rawQeGroupSize = parseInt(document.getElementById('qeGroupSize')?.value) || 1;
    const isGroup   = isEnemy && rawQeGroupSize >= 2;
    const groupSize = isGroup ? rawQeGroupSize : 1;
    const isSummon  = !!(document.getElementById('qeIsSummon')?.checked);
    const summoner  = isSummon ? (document.getElementById('qeSummoner')?.value || '') : '';

    // Zero one-summon check (frontend fast-path)
    if (isSummon && summoner === 'ZERO') {
        const existingInCombat = combatState.participants.find(p =>
            p.isSummon && p.summoner === 'ZERO' && (p.hp?.current > 0 || (p.totalHp ?? 0) > 0)
        );
        const existingInSetup = setupState.npcs.find(n => n.isSummon && n.summoner === 'ZERO');
        if (existingInCombat || existingInSetup) {
            showNotification('⚠️ Zero ya tiene una invocación activa', 3000);
            return;
        }
    }

    const actions = getQeActions();
    const combateExtra = actions.map(a => ({
        nombre: a.name,
        tipo:   _actionTypeToTipo(a.type),
        atk: '', dado: '', desc: a.description,
    }));

    const totalHp   = hp * groupSize;
    const displayHp = isGroup ? totalHp : hp;

    const uid = `qe_${Date.now()}`;
    const charData = {
        id: uid, tipo, nombre: name,
        clase: isEnemy ? 'Enemigo' : 'Aliado NPC', nivel: '—', imagen: '',
        resumen: { HP: String(displayHp), CA: String(ac), Velocidad: '30ft' },
        combateExtra, conjuros: [],
    };
    window.characterData[uid] = charData;
    document.getElementById('quickEnemyOverlay')?.remove();

    _saveEntityTemplate({
        name,
        type:      isEnemy ? 'ENEMY' : 'ALLY',
        stats:     { hp, ac },
        actions,
        isGroup, groupSize,
        isSummon, summoner,
    });

    if (onlineState.isOnlineCombat && onlineState.activeCombatId) {
        try {
            const resp = await fetch(`${API_BASE}/api/combat-entities`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    type:      isEnemy ? 'ENEMY' : 'ALLY',
                    stats:     { hp, ac, initiative },
                    actions,
                    combatId:  onlineState.activeCombatId,
                    sessionId: onlineState.activeJoinCode || '',
                    isGroup, groupSize,
                    membersRemaining: groupSize,
                    hpPerMember:      hp,
                    totalHp,
                    currentMemberHp:  hp,
                    isSummon, summoner,
                    summonedBeforeCombat: false,
                }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                if (err.code === 'ZERO_SUMMON_LIMIT') {
                    showNotification('⚠️ Zero ya tiene una invocación activa', 3000);
                    return;
                }
            }
        } catch (e) {
            console.warn('[combat-entities] save failed:', e.message);
        }
    }

    const participant = {
        id: uid, name,
        initiative,
        hp: { current: displayHp, max: displayHp },
        ac: String(ac), baseAc: String(ac),
        speed: '30ft', baseSpeed: '30ft',
        conditions: [], note: '', charData,
        demonicForm: false, tipo,
        customActions: [],
        isGroup, groupSize,
        membersRemaining: groupSize,
        hpPerMember: hp,
        totalHp,
        currentMemberHp: hp,
        isSummon, summoner,
        summonedBeforeCombat: false,
    };

    if (context === 'setup') {
        setupState.npcs.push({
            tipo, nombre: name, pg: hp, ca: ac, initiative,
            acciones: '', adicionales: '', reacciones: '',
            isGroup, groupSize,
            isSummon, summoner, summonedBeforeCombat: false,
            _uid: uid,
        });
        window.renderSetupNpcList?.(tipo);
        window._updateSetupCount?.();
        showNotification(`${icon} ${name} añadido a la selección`, 2000);
    } else {
        combatState.participants.push(participant);
        combatState.participants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
        saveCombatState();
        window.renderCombatManager?.();
        showNotification(`${icon} ${name} añadido al combate`, 2000);
    }
}

// ── Invocation detail modal ───────────────────────────────────────────────────

export function showInvocationDetail(charId, invId) {
    const char = window.characterData[charId];
    const inv = char?.invocaciones?.find(x => x.id === invId);
    if (!inv) return;
    document.getElementById('invocationDetailOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'invocationDetailOverlay';
    overlay.className = 'combat-resume-overlay';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    const habilidadesHTML = inv.habilidades?.map(h => `<div class="invocation-ability">• ${h}</div>`).join('') || '';
    overlay.innerHTML = `
        <div class="invocation-detail-modal">
            <div class="combat-resume-title">${inv.emoji} ${inv.nombre}</div>
            <div style="display:flex;gap:16px;justify-content:center;margin:12px 0">
                <div class="combat-vital-block" style="min-width:80px;text-align:center">
                    <div class="combat-vital-label">❤️ HP</div>
                    <div class="combat-vital-value">${inv.hp}</div>
                </div>
                <div class="combat-vital-block" style="min-width:80px;text-align:center">
                    <div class="combat-vital-label">🛡️ CA</div>
                    <div class="combat-vital-value">${inv.ca}</div>
                </div>
                <div class="combat-vital-block" style="min-width:80px;text-align:center">
                    <div class="combat-vital-label">💨 Vel.</div>
                    <div class="combat-vital-value" style="font-size:14px">${inv.velocidad}</div>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;margin:8px 0">
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">⚔️ Ataque</div>
                <div style="font-size:13px;color:var(--text-primary)">${inv.ataque}</div>
            </div>
            ${habilidadesHTML ? `<div style="margin-top:10px">
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">Habilidades</div>
                ${habilidadesHTML}
            </div>` : ''}
            <div style="display:flex;gap:10px;margin-top:16px">
                <button class="btn-combat-primary" style="flex:1" onclick="addInvocationToCombat('${charId}','${invId}');document.getElementById('invocationDetailOverlay')?.remove()">+ Al combate</button>
                <button class="btn-combat-secondary" style="flex:1" onclick="document.getElementById('invocationDetailOverlay')?.remove()">Cerrar</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

export function addInvocationToCombat(charId, invId) {
    const char = window.characterData[charId];
    const inv = char?.invocaciones?.find(x => x.id === invId);
    if (!inv) return;
    const uid = `inv_${invId}_${Date.now()}`;
    const participant = {
        id: uid,
        name: inv.nombre,
        initiative: 0,
        hp: { current: inv.hp, max: inv.hp },
        ac: String(inv.ca),
        baseAc: String(inv.ca),
        speed: inv.velocidad,
        baseSpeed: inv.velocidad,
        conditions: [],
        note: '',
        charData: null,
        demonicForm: false,
        tipo: 'aliado',
        ownerCharId: charId,
        _debutRound: combatState.round + 1,
    };
    const initVal = prompt(`Iniciativa para ${inv.nombre}:`, '0');
    participant.initiative = parseInt(initVal) || 0;

    const currentPId = combatState.participants[combatState.currentIndex]?.id;

    combatState.participants.push(participant);
    combatState.participants.sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

    if (currentPId) {
        const newIdx = combatState.participants.findIndex(x => x.id === currentPId);
        if (newIdx !== -1) combatState.currentIndex = newIdx;
    }

    saveCombatState();
    window.renderCombatManager?.();
    showNotification(`🔮 ${inv.nombre} añadido — actúa desde ronda ${combatState.round + 1}`, 2500);
}
