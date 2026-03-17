/**
 * combat/rendering.js — All combat UI rendering: manager, queue, active panel,
 *                        log, dice rolling, action recording, HP updates.
 */

import { combatState, onlineState, appFlags } from '../state.js';
import { CONDITIONS } from '../config.js';
import { showNotification } from '../ui/notifications.js';
import { setView, currentView } from '../ui/router.js';
import { isMaster } from '../auth/role.js';
import { roleState } from '../state.js';
import { saveCombatState, clearSavedCombat } from '../sync/api.js';
import { extractDiceFromDesc, inferActionType } from '../characters/sheet.js';
import { renderCombatShareLink } from '../online/session.js';

// ── Combat Manager ────────────────────────────────────────────────────────────
export function renderCombatManager() {
    const masterLayout = document.getElementById('combatMasterLayout');
    const playerView   = document.getElementById('playerCombatView');

    if (!isMaster()) {
        if (masterLayout) masterLayout.style.display = 'none';
        _renderPlayerCombatLayout(playerView);
        return;
    }

    if (masterLayout) masterLayout.style.display = 'flex';
    if (playerView)   playerView.style.display   = 'none';

    const roundEl = document.getElementById('combatRoundBadge');
    if (roundEl) roundEl.textContent = `Ronda ${combatState.round}`;

    const actor = combatState.participants[combatState.currentIndex];
    const actorNameEl = document.getElementById('combatActorName');
    if (actorNameEl) actorNameEl.textContent = actor ? `Turno de ${actor.name.split(' ')[0]}` : '';

    const sessionCodeBtn = document.getElementById('showSessionCodeBtn');
    if (sessionCodeBtn) sessionCodeBtn.style.display = onlineState.isOnlineCombat ? '' : 'none';

    renderCombatShareLink();
    renderTurnQueue();
    renderActivePanel();
    renderCombatLog();
    renderKillScoreboard();
}

// ── Player combat layout ──────────────────────────────────────────────────────
export function _renderPlayerCombatLayout(view) {
    if (!view) view = document.getElementById('playerCombatView');
    if (!view) return;
    const masterLayout = document.getElementById('combatMasterLayout');
    if (masterLayout) masterLayout.style.display = 'none';
    view.style.display = 'flex';

    const p = combatState.participants[0];
    if (!p) return;

    const isSegundaAccion = combatState.segundaAccionTurn;
    const roundLabel = isSegundaAccion ? `Ronda ${combatState.round} · Segunda Acción` : `Ronda ${combatState.round}`;

    view.innerHTML = `
        <div class="player-active-header">
            <div class="combat-round-badge">${roundLabel}</div>
            <button class="btn-end-combat" onclick="confirmEndCombat()">✕ Fin</button>
        </div>
        <div class="player-active-body">
            <div id="playerCombatPanel" class="combat-active-panel"></div>
        </div>
        <div class="player-active-footer">
            <button class="btn-combat-primary" onclick="nextCombatTurn()">Siguiente Turno →</button>
        </div>`;
    renderActivePanel(document.getElementById('playerCombatPanel'), 0);
}

// ── Turn Queue ────────────────────────────────────────────────────────────────
export function renderTurnQueue() {
    const queue = document.getElementById('combatTurnQueue');
    if (!queue) return;
    queue.innerHTML = combatState.participants.map((p, i) => {
        const isCurrent = i === combatState.currentIndex;
        let isDead, hpPct, hpDisplay;
        if (p.isGroup) {
            isDead = (p.membersRemaining ?? 0) <= 0;
            const maxTotalHp = (p.groupSize || 1) * (p.hpPerMember || 1);
            hpPct = maxTotalHp > 0 ? Math.max(0, ((p.totalHp ?? 0) / maxTotalHp) * 100) : 0;
            hpDisplay = (!isMaster() && p.tipo === 'enemigo') ? '? / ?' : `${p.membersRemaining ?? 0}/${p.groupSize ?? 1}`;
        } else {
            isDead    = p.hp.current <= 0;
            hpPct     = p.hp.max > 0 ? Math.max(0, (p.hp.current / p.hp.max) * 100) : 0;
            hpDisplay = (!isMaster() && p.tipo === 'enemigo') ? '? / ?' : `${p.hp.current}/${p.hp.max}`;
        }
        const hpColor  = hpPct <= 0 ? '#555' : hpPct <= 25 ? '#ff4444' : hpPct <= 50 ? '#ffaa00' : '#4caf50';
        const tipoClass = p.tipo || 'jugador';
        const cls = ['turn-queue-item', isCurrent ? 'active' : '', isDead ? 'dead' : '', p.demonicForm ? 'demonic' : '', tipoClass].filter(Boolean).join(' ');
        const condIcons = p.conditions.length
            ? `<div class="tqi-conditions">${p.conditions.map(cId => {
                  const c = CONDITIONS.find(x => x.id === cId);
                  return c ? `<span title="${c.title}">${c.label}</span>` : '';
              }).join('')}</div>` : '';
        const groupBadge  = p.isGroup  ? `<div class="tqi-group-badge"  title="Grupo: ${p.membersRemaining}/${p.groupSize} miembros">👥</div>` : '';
        const summonBadge = p.isSummon ? `<div class="tqi-summon-badge" title="Invocación de ${p.summoner}">✨</div>` : '';

        return `<div class="${cls}">
            <div class="tqi-init">${p.initiative}</div>
            <div class="tqi-name">${p.name.split(' ')[0]}</div>
            ${groupBadge}${summonBadge}
            <div class="tqi-hp-bar"><div class="tqi-hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
            <div class="tqi-hp-text">${hpDisplay}</div>
            ${condIcons}
            ${isCurrent && combatState.extraAttackTurn   ? '<div class="tqi-extra-badge">+ATQ</div>' : ''}
            ${isCurrent && combatState.segundaAccionTurn ? '<div class="tqi-extra-badge">+2ª</div>'  : ''}
        </div>`;
    }).join('');
    setTimeout(() => {
        const active = queue.querySelector('.turn-queue-item.active');
        if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 50);
}

// ── Active Panel ──────────────────────────────────────────────────────────────
export function renderActivePanel(targetEl, forcePIdx) {
    const idx   = (forcePIdx !== undefined) ? forcePIdx : combatState.currentIndex;
    const p     = combatState.participants[idx];
    const panel = targetEl || document.getElementById('combatActivePanel') || document.getElementById('playerCombatPanel');
    if (!p || !panel) return;

    const isSegundaAccion = combatState.segundaAccionTurn && (idx === combatState.currentIndex);
    const isExtraAttack   = combatState.extraAttackTurn   && (idx === combatState.currentIndex);

    const isMyCharTurn = !isMaster() && roleState.gameRole.characterId && p.id === roleState.gameRole.characterId;
    const isMyAllyTurn = !isMaster() && (
        p.ownerCharId === roleState.gameRole.characterId ||
        (p._isSirvienteInvisible && roleState.gameRole.characterId === 'Vel')
    );
    const canControl = isMaster() || isMyCharTurn || isMyAllyTurn;

    if (forcePIdx === undefined && !canControl) {
        let icon = '⏳', label = `Turno de ${p.name.split(' ')[0]}...`, note = 'El Master gestiona este turno';
        if (p.tipo === 'enemigo')     { icon = '💀'; label = 'Turno del enemigo'; }
        else if (p.tipo === 'aliado') { icon = '🤝'; label = `Turno de ${p.name.split(' ')[0]}`; }
        else if (p.tipo === 'jugador'){ icon = '🎮'; label = `Turno de ${p.name.split(' ')[0]}`; note = 'Ese jugador gestiona su propio turno'; }
        panel.className = 'combat-active-panel';
        panel.innerHTML = `<div class="waiting-panel">
            <span>${icon} ${label}</span>
            <small>${note}</small>
            <button class="btn-combat-secondary waiting-pass-btn" onclick="nextCombatTurn()">⏭ Pasar turno</button>
        </div>`;
        return;
    }

    const currentEntry = getCurrentLogEntry();
    const hpPct  = p.hp.max > 0 ? Math.max(0, (p.hp.current / p.hp.max) * 100) : 0;
    const hpClass = hpPct <= 0 ? 'hp-dead' : hpPct <= 25 ? 'hp-critical' : hpPct <= 50 ? 'hp-low' : '';
    const playerMode = forcePIdx !== undefined;

    const condHTML = CONDITIONS.map(c => {
        const isActive = p.conditions.includes(c.id);
        return `<button class="combat-cond-btn${isActive ? ' active' : ''}"
                        onclick="toggleParticipantCondition('${p.id}','${c.id}')"
                        title="${c.title}">${c.label} ${c.title}</button>`;
    }).join('');

    const concentrationBanner = p.conditions.includes('concentracion')
        ? `<div class="concentration-banner">🧠 Concentración activa — al recibir daño, tira Constitución</div>` : '';

    const baseItems   = [...(p.charData?.combateExtra || []), ...(p.charData?.conjuros || [])];
    const customItems = (p.customActions || []).map(a => ({ ...a, _custom: true }));
    const allItems    = [...baseItems, ...customItems];

    const renderChips = items => items.map(a => {
        const atk     = a.atk || '';
        const dado    = a.dado && a.dado !== '—' ? a.dado : (a._custom ? '' : (extractDiceFromDesc(a.desc) || ''));
        const diceDisplay = atk ? `${atk}${dado ? ' / ' + dado : ''}` : dado;
        const safeName    = a.nombre.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const safeDice    = diceDisplay.replace(/'/g,"\\'");
        const safeAtk     = atk.replace(/'/g,"\\'");
        const safeDado    = dado.replace(/'/g,"\\'");
        const safeDesc    = (a.desc || '').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/\n/g,' ');
        const safeTipoDano = (a.tipo_dano || '').replace(/'/g,"\\'");
        const demonicBonus = (p.demonicForm && p.id === 'Vel' && atk) ? '<small class="demonic-bonus">+1d8 Necr.</small>' : '';
        const removeBtn = a._custom ? `<button class="chip-remove-btn" onclick="removePermanentCustomAction('${p.id}','${safeName}')" title="Eliminar acción">✕</button>` : '';
        const isUsed = playerMode
            ? ['accion_plan','adicional_plan','reaccion_plan'].some(k => currentEntry?.slots?.[k]?.nombre === a.nombre)
            : (currentEntry?.actions.some(x => x.nombre === a.nombre) || false);
        const chipOnclick = playerMode
            ? `selectPlannerAction('${p.id}','${safeName}','${safeAtk}','${safeDado}','${safeTipoDano}')`
            : `toggleCombatAction('${p.id}','${safeName}','${safeDice}')`;
        return `<div class="combat-chip-wrapper">
            <button class="combat-chip${isUsed ? ' used' : ''}${a._custom ? ' custom-action' : ''}"
                    onclick="${chipOnclick}">
                ${a.nombre}${diceDisplay ? `<small>${diceDisplay}</small>` : ''}${demonicBonus}
            </button>
            ${a.desc && !a._custom ? `<button class="chip-info-btn" onclick="showActionDetail('${safeName}','${safeAtk}','${safeDado}','${safeDesc}')" title="Ver descripción">ℹ️</button>` : ''}
            ${removeBtn}
        </div>`;
    }).join('');

    const SLOTS = [
        { key: 'accion',    icon: '⚔️', label: 'Acción',          tipo: 'accion'    },
        { key: 'adicional', icon: '⚡', label: 'Acción Adicional', tipo: 'adicional' },
        { key: 'reaccion',  icon: '↩️', label: 'Reacción',         tipo: 'reaccion'  },
    ];

    let slotSections;
    if (isExtraAttack) {
        const weaponItems = allItems.filter(a => inferActionType(a) === 'accion' && a.atk && a.atk !== '—' && a.atk !== '');
        slotSections = `<div class="combat-slot-section">
            <div class="combat-slot-header"><span>⚔️ Ataque Extra (solo armas)</span></div>
            ${weaponItems.length ? `<div class="combat-chips">${renderChips(weaponItems)}</div>` : `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin ataques disponibles</div>`}
        </div>`;
    } else if (isSegundaAccion) {
        const accionItems = allItems.filter(a => inferActionType(a) === 'accion');
        slotSections = `<div class="combat-slot-section">
            <div class="combat-slot-header"><span>⚔️ Acción (Segunda Acción)</span></div>
            ${accionItems.length ? `<div class="combat-chips">${renderChips(accionItems)}</div>` : `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin acciones disponibles</div>`}
        </div>`;
    } else if (playerMode) {
        const PSLOTS = [
            { key: 'accion', icon: '⚔️', label: 'ACCIÓN' },
            { key: 'adicional', icon: '⚡', label: 'ADICIONAL' },
            { key: 'reaccion',  icon: '🛡️', label: 'REACCIÓN' },
        ];
        const plannerSlotsHTML = PSLOTS.map(s => {
            const plan = currentEntry?.slots?.[s.key + '_plan'];
            return `<div class="planner-slot${plan ? ' filled' : ''}">
                <span class="planner-slot-label">${s.icon} ${s.label}:</span>
                ${plan
                    ? `<span class="planner-slot-action">${plan.nombre}</span>
                       <button class="planner-slot-remove" onclick="removePlannerSlot('${p.id}','${s.key}')">✕</button>`
                    : `<span class="planner-slot-empty">— selecciona abajo</span>`}
            </div>`;
        }).join('');
        const diceRows = PSLOTS.map(s => {
            const plan = currentEntry?.slots?.[s.key + '_plan'];
            if (!plan) return '';
            const atkBadge  = plan.atk ? `<span class="planner-dice-badge atk">ATK ${plan.atk}</span>` : '';
            const dmgBadge  = plan.dado ? `<span class="planner-dice-badge dmg">DMG ${plan.dado}</span>` : '';
            const tipoDanoKey = plan.tipo_dano ? plan.tipo_dano.split('/')[0].trim().toLowerCase() : '';
            const tipoBadge = plan.tipo_dano ? `<span class="planner-dice-badge tipo tipo-${tipoDanoKey}">${plan.tipo_dano}</span>` : '';
            return `<div class="planner-dice-row">
                <span class="planner-dice-name">${plan.nombre}</span>
                <div class="planner-dice-badges">${atkBadge}${dmgBadge}${tipoBadge}</div>
            </div>`;
        }).filter(Boolean).join('');
        const hasDice = PSLOTS.some(s => currentEntry?.slots?.[s.key + '_plan']);
        const chipSections = SLOTS.map(slot => {
            const items = allItems.filter(a => inferActionType(a) === slot.tipo);
            if (!items.length) return '';
            return `<div class="combat-slot-section">
                <div class="combat-slot-header"><span>${slot.icon} ${slot.label}</span></div>
                <div class="combat-chips">${renderChips(items)}</div>
            </div>`;
        }).join('');
        slotSections = `
        <div class="turn-planner">
            <div class="turn-planner-slots">${plannerSlotsHTML}</div>
            <div class="turn-planner-dice">
                <div class="planner-dice-title">🎲 DADOS DEL TURNO</div>
                ${hasDice ? diceRows : '<div class="planner-dice-empty">Selecciona acciones abajo</div>'}
            </div>
        </div>
        <div class="combat-actions-chips-section">${chipSections}</div>`;
    } else {
        slotSections = SLOTS.map(slot => {
            const isSlotUsed = (currentEntry?.slots?.[slot.key]) || currentEntry?.actions.some(a => inferActionType(a) === slot.tipo) || false;
            const items      = allItems.filter(a => inferActionType(a) === slot.tipo);
            const chips      = renderChips(items);
            const slotUsedClass = isSlotUsed ? ' used' : '';
            const btnClass   = isSlotUsed ? 'used' : 'libre';
            const btnLabel   = isSlotUsed ? '✅ Usada' : '☐ Libre';
            return `<div class="combat-slot-section${slotUsedClass}">
                <div class="combat-slot-header">
                    <span>${slot.icon} ${slot.label}</span>
                    <button class="slot-toggle-btn ${btnClass}" onclick="toggleSlotManual('${p.id}','${slot.key}')">${btnLabel}</button>
                </div>
                ${items.length ? `<div class="combat-chips">${chips}</div>` : `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin acciones disponibles</div>`}
            </div>`;
        }).join('');
    }

    const addCustomActionForm = (isSegundaAccion || isExtraAttack) ? '' : `
        <details class="add-custom-action-details">
            <summary>✏️ Añadir acción personalizada…</summary>
            <div class="add-custom-action-form">
                <input type="text" id="newCustomActionName" class="combat-custom-input" placeholder="Nombre de la acción" autocomplete="off">
                <select id="newCustomActionTipo" class="combat-custom-input" style="flex:0 0 auto;width:auto">
                    <option value="accion">Acción</option>
                    <option value="adicional">Adicional</option>
                    <option value="reaccion">Reacción</option>
                </select>
                <input type="text" id="newCustomActionDado" class="combat-custom-input" placeholder="Dado (ej: 1d6+3)" style="flex:0 0 auto;width:110px">
                <button onclick="addPermanentCustomAction('${p.id}')">+ Guardar</button>
            </div>
        </details>`;

    let invocacionesHTML = '';
    if (!isSegundaAccion && !isExtraAttack && p.id === 'Zero' && p.charData?.invocaciones) {
        const invCards = p.charData.invocaciones.map(inv => `
            <div class="invocation-card">
                <div>
                    <div class="invocation-name">${inv.emoji} ${inv.nombre}</div>
                    <div class="invocation-stats">HP ${inv.hp} · CA ${inv.ca} · ${inv.velocidad}</div>
                </div>
                <div class="invocation-btns">
                    <button onclick="showInvocationDetail('Zero','${inv.id}')">Ver stats</button>
                    <button onclick="addInvocationToCombat('Zero','${inv.id}')">+ Al combate</button>
                </div>
            </div>`).join('');
        invocacionesHTML = `<div class="combat-invocations-section">
            <div class="combat-actions-title">🔮 Invocaciones de Zero</div>
            ${invCards}
        </div>`;
    }

    const actionChipsHTML = `<div class="combat-actions-section">
        <div class="combat-actions-title">⚡ Acciones del turno</div>
        ${slotSections}
        ${addCustomActionForm}
    </div>${invocacionesHTML}`;

    const recordedItems = currentEntry?.actions || [];
    const recordedHTML  = recordedItems.length
        ? recordedItems.map(a => {
            const safeName = a.nombre.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            return `<div class="combat-recorded-item">
                <div style="flex:1">
                    <span>✓ ${a.nombre}${a.dice && !a.rollText ? ` — ${a.dice}` : ''}</span>
                    ${a.rollText ? `<div class="combat-roll-result" style="font-size:10px">${renderRollText(a.rollText)}</div>` : ''}
                    ${a.narratorText ? `<div class="combat-narrator-text" style="font-size:10px">${a.narratorText}</div>` : ''}
                </div>
                <button onclick="removeCombatAction('${p.id}','${safeName}')">×</button>
            </div>`;
        }).join('')
        : `<div class="combat-recorded-empty">Sin acciones registradas</div>`;

    const demonicToggleHTML = p.id === 'Vel' ? `
        <button class="combat-demonic-toggle${p.demonicForm ? ' active' : ''}" onclick="toggleDemonicFormInCombat('Vel')">
            😈 Forma Demoníaca
            ${p.demonicForm
                ? '<span class="demonic-badge">ACTIVA · CA 19 · Vel. 50ft · +1d8 Necr.</span>'
                : '<span style="color:var(--text-muted);font-size:12px">Inactiva</span>'}
        </button>` : '';

    const sirvienteToggleHTML = (p.id === 'Vel' && !isSegundaAccion) ? `
        <button class="combat-demonic-toggle${p.sirvienteActive ? ' active' : ''}" onclick="toggleSirvienteInvisible('Vel')">
            👻 Sirviente Invisible
            ${p.sirvienteActive
                ? `<span class="demonic-badge">ACTIVO · CA ${p.ac}</span>`
                : '<span style="color:var(--text-muted);font-size:12px">Inactivo</span>'}
        </button>` : '';

    let attackTargetPanelHTML = '';
    if (canControl && forcePIdx === undefined) {
        const attackerIsAlly = (p.tipo === 'jugador' || p.tipo === 'aliado');
        const targets = combatState.participants.filter((t, i) => {
            if (i === idx) return false;
            const targetIsAlly = (t.tipo === 'jugador' || t.tipo === 'aliado');
            return attackerIsAlly !== targetIsAlly;
        });
        if (targets.length > 0) {
            const targetRows = targets.map(t => {
                const hpPctT   = t.hp.max > 0 ? Math.round(t.hp.current / t.hp.max * 100) : 0;
                const hpColorT = hpPctT <= 0 ? '#555' : hpPctT <= 25 ? '#ff4444' : hpPctT <= 50 ? '#ffaa00' : '#4caf50';
                const tipoIcon = t.tipo === 'enemigo' ? '💀' : t.tipo === 'aliado' ? '💙' : '🎮';
                return `<div class="attack-target-row">
                    <div class="attack-target-info">
                        <span class="attack-target-icon">${tipoIcon}</span>
                        <span class="attack-target-name">${t.name.split(' ')[0]}</span>
                        <span class="attack-target-hp" style="color:${hpColorT}">${t.hp.current}/${t.hp.max} ❤️</span>
                    </div>
                    <input type="number" class="attack-dmg-input" id="dmg_${t.id}" placeholder="0 dmg" min="0" inputmode="numeric">
                </div>`;
            }).join('');
            attackTargetPanelHTML = `<div class="attack-target-panel">
                <div class="attack-target-title">⚔️ Aplicar daño</div>
                <div class="attack-target-list">${targetRows}</div>
                <button class="btn-apply-damage" onclick="applyAttackDamage('${p.id}')">💥 Aplicar Daño</button>
            </div>`;
        }
    }

    const sliderFillPct = p.hp.max > 0 ? Math.max(0, (p.hp.current / p.hp.max) * 100) : 0;
    const panelClass = `combat-active-panel${p.demonicForm ? ' demonic-active' : ''}${isSegundaAccion ? ' segunda-accion-active' : ''}${isExtraAttack ? ' extra-attack-active' : ''}`;
    panel.className  = panelClass;

    const extraAttackHeaderHTML  = isExtraAttack   ? `<div class="extra-attack-header">🗡️ ATAQUE EXTRA — ${p.name.split(' ')[0]}</div>` : '';
    const segundaAccionHeaderHTML = isSegundaAccion ? `<div class="segunda-accion-header">⚔️ SEGUNDA ACCIÓN — ${p.name.split(' ')[0]}</div>` : '';
    const displayName = isExtraAttack ? `${p.name} — Ataque Extra` : isSegundaAccion ? `${p.name} — Segunda Acción` : p.name;

    panel.innerHTML = `
        ${extraAttackHeaderHTML}
        ${segundaAccionHeaderHTML}
        <div class="combat-active-header">
            <div class="combat-active-portrait">
                ${p.charData?.imagen ? `<img src="${p.charData.imagen}" onerror="this.style.display='none'">` : '<div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.05);border:2px solid var(--border-color);"></div>'}
            </div>
            <div class="combat-active-meta">
                <div class="combat-active-name">${displayName}</div>
                ${p.charData ? `<div class="combat-active-class">${p.charData.clase} · Nv ${p.charData.nivel}</div>` : ''}
            </div>
        </div>
        <div class="combat-active-vitals">
            <div class="combat-vital-block ${hpClass}" id="activeHpBlock">
                <div class="combat-vital-label">❤️ Puntos de Golpe</div>
                <div class="combat-vital-value">
                    <span id="activeHpDisplay">${p.hp.current}</span>
                    <span style="font-size:16px;color:var(--text-muted)"> / ${p.hp.max}</span>
                </div>
                <input type="range" class="combat-hp-slider"
                       min="0" max="${p.hp.max}" value="${p.hp.current}"
                       style="--fill-pct:${sliderFillPct}%"
                       oninput="setParticipantHp('${p.id}', parseInt(this.value))">
            </div>
            <div class="combat-vital-block">
                <div class="combat-vital-label">🛡️ Clase de Armadura</div>
                <div class="combat-vital-value">${p.ac}</div>
                ${p.speed ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">💨 ${p.speed}</div>` : ''}
            </div>
        </div>
        ${(isSegundaAccion || isExtraAttack) ? '' : concentrationBanner}
        ${(isSegundaAccion || isExtraAttack) ? '' : demonicToggleHTML}
        ${(isSegundaAccion || isExtraAttack) ? '' : sirvienteToggleHTML}
        ${(isSegundaAccion || isExtraAttack) ? '' : `<div class="combat-conds-bar">${condHTML}</div>`}
        ${actionChipsHTML}
        ${attackTargetPanelHTML}
        ${isExtraAttack   ? `<button class="skip-extra-btn" onclick="skipExtraAttack()">⏭ Saltar Ataque Extra</button>` : ''}
        ${isSegundaAccion ? `<button class="skip-extra-btn" onclick="skipSegundaAccion()">⏭ Saltar Segunda Acción</button>` : ''}
        <div class="combat-recorded-section">
            <div class="combat-recorded-title">Registrado este turno:</div>
            <div id="combatRecordedList">${recordedHTML}</div>
        </div>
        ${(isSegundaAccion || isExtraAttack) ? '' : `<div class="combat-notes-section">
            <textarea class="combat-notes-input" placeholder="Notas del turno..."
                      oninput="setCombatTurnNote('${p.id}',this.value)">${currentEntry?.note || ''}</textarea>
        </div>`}`;
}

// ── Log Functions ─────────────────────────────────────────────────────────────
export function createCurrentTurnEntry() {
    const p = combatState.participants[combatState.currentIndex];
    if (!p) return;
    combatState.log.push({
        id:               combatState.nextLogId++,
        round:            combatState.round,
        participantId:    p.id,
        participantName:  p.name,
        actions:          [],
        slots:            { accion: false, extraAtaque: false, adicional: false, reaccion: false },
        note:             '',
        isCurrent:        true,
        isSegundaAccion:  combatState.segundaAccionTurn || false,
        isExtraAttack:    combatState.extraAttackTurn   || false,
        snapshot: {
            currentIndex:      combatState.currentIndex,
            round:             combatState.round,
            segundaAccionTurn: combatState.segundaAccionTurn || false,
            extraAttackTurn:   combatState.extraAttackTurn   || false,
            participants: combatState.participants.map(part => ({
                id:         part.id,
                hp:         { ...part.hp },
                conditions: [...part.conditions],
                demonicForm: part.demonicForm,
                ac:          part.ac,
                speed:       part.speed,
            })),
        },
    });
}

export function getCurrentLogEntry() { return combatState.log.find(e => e.isCurrent); }
export function getLogEntry(logId)   { return combatState.log.find(e => e.id === logId); }

// ── Action recording ──────────────────────────────────────────────────────────
export function toggleCombatAction(participantId, nombre, dice) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    if (!entry.slots) entry.slots = { accion: false, extraAtaque: false, adicional: false, reaccion: false };
    const idx = entry.actions.findIndex(a => a.nombre === nombre);
    if (idx >= 0) {
        entry.actions.splice(idx, 1);
    } else {
        entry.actions.push({ nombre, dice: dice || '' });
        const p = combatState.participants.find(x => x.id === participantId);
        if (p?.charData) {
            const allItems  = [...(p.charData.combateExtra || []), ...(p.charData.conjuros || [])];
            const actionObj = allItems.find(a => a.nombre === nombre);
            if (actionObj) {
                const tipo = inferActionType(actionObj);
                if (tipo === 'adicional') entry.slots.adicional = true;
                else if (tipo === 'reaccion') entry.slots.reaccion = true;
                else entry.slots.accion = true;
            }
        }
    }
    saveCombatState();
    renderActivePanel();
    renderCombatLog();
}

export function toggleSlotManual(participantId, slotKey) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    if (!entry.slots) entry.slots = { accion: false, extraAtaque: false, adicional: false, reaccion: false };
    entry.slots[slotKey] = !entry.slots[slotKey];
    saveCombatState();
    renderActivePanel();
}

export function addPermanentCustomAction(participantId) {
    const p = combatState.participants.find(x => x.id === participantId);
    if (!p) return;
    const nombre = document.getElementById('newCustomActionName')?.value?.trim();
    if (!nombre) { showNotification('⚠️ Introduce un nombre para la acción', 2000); return; }
    const tipo = document.getElementById('newCustomActionTipo')?.value || 'accion';
    const dado = document.getElementById('newCustomActionDado')?.value?.trim() || '';
    if (!p.customActions) p.customActions = [];
    if (p.customActions.find(a => a.nombre === nombre)) { showNotification('⚠️ Ya existe una acción con ese nombre', 2000); return; }
    p.customActions.push({ nombre, tipo, dado, atk: '', desc: '' });
    saveCombatState();
    renderActivePanel();
    showNotification(`✅ Acción "${nombre}" añadida`, 2000);
}

export function removePermanentCustomAction(participantId, nombre) {
    const p = combatState.participants.find(x => x.id === participantId);
    if (!p?.customActions) return;
    p.customActions = p.customActions.filter(a => a.nombre !== nombre);
    const entry = getCurrentLogEntry();
    if (entry) entry.actions = entry.actions.filter(a => a.nombre !== nombre);
    saveCombatState();
    renderActivePanel();
}

export function removeCombatAction(participantId, nombre) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    entry.actions = entry.actions.filter(a => a.nombre !== nombre);
    saveCombatState();
    renderActivePanel();
    renderCombatLog();
}

export function addCustomCombatAction(participantId) {
    const input = document.getElementById('customActionInput');
    const text  = input?.value?.trim();
    if (!text) return;
    const entry = getCurrentLogEntry();
    if (!entry) return;
    entry.actions.push({ nombre: text, dice: '' });
    if (input) input.value = '';
    saveCombatState();
    renderActivePanel();
    renderCombatLog();
}

export function setCombatTurnNote(participantId, value) {
    const entry = getCurrentLogEntry();
    if (entry) { entry.note = value; saveCombatState(); }
}

export function selectPlannerAction(participantId, nombre, atk, dado, tipoDano) {
    const p = combatState.participants.find(x => x.id === participantId);
    if (!p) return;
    const entry = getCurrentLogEntry();
    if (!entry) return;
    const allItems  = [...(p.charData?.combateExtra || []), ...(p.charData?.conjuros || []), ...(p.customActions || [])];
    const actionObj = allItems.find(a => a.nombre === nombre);
    const tipo      = actionObj ? inferActionType(actionObj) : 'accion';
    const planKey   = tipo + '_plan';
    if (!entry.slots) entry.slots = {};
    if (entry.slots[planKey]?.nombre === nombre) {
        entry.slots[planKey] = null;
        entry.actions = entry.actions.filter(a => a.nombre !== nombre);
    } else {
        entry.slots[planKey] = { nombre, atk: atk || '', dado: dado || '', tipo_dano: tipoDano || '' };
        if (!entry.actions.some(a => a.nombre === nombre))
            entry.actions.push({ nombre, dice: atk ? `${atk}${dado ? '/' + dado : ''}` : dado });
    }
    saveCombatState();
    renderActivePanel(document.getElementById('playerCombatPanel'), 0);
    renderCombatLog();
}

export function removePlannerSlot(participantId, slotKey) {
    const entry = getCurrentLogEntry();
    if (!entry) return;
    const plan = entry.slots?.[slotKey + '_plan'];
    if (plan) {
        entry.actions = entry.actions.filter(a => a.nombre !== plan.nombre);
        entry.slots[slotKey + '_plan'] = null;
    }
    saveCombatState();
    renderActivePanel(document.getElementById('playerCombatPanel'), 0);
    renderCombatLog();
}

// ── Dice rolling ──────────────────────────────────────────────────────────────
export function rollDiceString(diceStr) {
    if (!diceStr || diceStr === '—') return { breakdown: '—', total: 0 };
    const parts = diceStr.replace(/\s/g, '').split('+');
    let total = 0;
    const segments = [];
    for (const part of parts) {
        const diceMatch = part.match(/^(\d+)d(\d+)$/i);
        if (diceMatch) {
            const count = parseInt(diceMatch[1]), sides = parseInt(diceMatch[2]);
            const rolls = [];
            for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
            total += rolls.reduce((a, b) => a + b, 0);
            segments.push(`${count}d${sides}:${rolls.join(',')}`);
        } else {
            const num = parseInt(part);
            if (!isNaN(num)) { total += num; segments.push(String(num)); }
        }
    }
    return { breakdown: segments.join(' + '), total };
}

export function rollActionDice(participantId, nombre, atk, dado) {
    const p     = combatState.participants.find(x => x.id === participantId);
    const entry = getCurrentLogEntry();
    if (!p || !entry) return;

    let parts = [], attackTotal = null;
    if (atk && atk !== '—' && atk !== '') {
        const d20    = Math.floor(Math.random() * 20) + 1;
        const bonusMatch = atk.replace(/1d20/i, '').match(/[+-]?\d+/);
        const bonus  = bonusMatch ? parseInt(bonusMatch[0]) : 0;
        attackTotal  = d20 + bonus;
        const isCrit = d20 === 20, isFumble = d20 === 1;
        parts.push(`d20:${d20} ${bonus >= 0 ? '+' : ''}${bonus} = **${attackTotal}** para impactar${isCrit ? ' ⚡CRÍTICO!' : isFumble ? ' 💀Pifia!' : ''}`);
    }
    let damageTotal = 0;
    if (dado && dado !== '—' && dado !== '') {
        const dmg = rollDiceString(dado);
        damageTotal = dmg.total;
        parts.push(`Daño: ${dmg.breakdown} = **${dmg.total}**`);
    }
    const rollText     = `🎲 ${nombre}: ${parts.join(' / ')}`;
    const narratorText = generateNarratorText(p.name, nombre, attackTotal, damageTotal, !!atk);

    const existingIdx = entry.actions.findIndex(a => a.nombre === nombre);
    if (existingIdx >= 0) {
        entry.actions[existingIdx].rollText     = rollText;
        entry.actions[existingIdx].narratorText = narratorText;
    } else {
        entry.actions.push({ nombre, dice: dado || '', rollText, narratorText });
        const slotKey = inferActionType({ nombre, tipo: '', desc: '' }) === 'adicional' ? 'adicional'
            : inferActionType({ nombre, tipo: '', desc: '' }) === 'reaccion' ? 'reaccion' : 'accion';
        if (entry.slots) entry.slots[slotKey] = true;
    }
    saveCombatState();
    renderActivePanel();
    renderCombatLog();
}

export function generateNarratorText(name, actionName, attackTotal, damageTotal, hasAtk) {
    const firstName = name.split(' ')[0];
    const verbs     = ['desenvaina', 'empuña', 'lanza', 'canaliza', 'desata'];
    const verb      = verbs[Math.floor(Math.random() * verbs.length)];
    if (hasAtk && attackTotal !== null) {
        if (attackTotal >= 12) {
            return damageTotal > 0
                ? `${firstName} ${verb} ${actionName} y alcanza con un ${attackTotal} para impactar, infligiendo ${damageTotal} puntos de daño.`
                : `${firstName} utiliza ${actionName} con un resultado de ${attackTotal}.`;
        } else {
            return `${firstName} intenta usar ${actionName}, pero falla el ataque (resultado: ${attackTotal}).`;
        }
    } else if (damageTotal > 0) {
        return `${firstName} activa ${actionName}, causando ${damageTotal} puntos de daño.`;
    }
    return `${firstName} utiliza ${actionName}.`;
}

export function showActionDetail(nombre, atk, dado, desc) {
    document.getElementById('actionDetailOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'actionDetailOverlay';
    overlay.className = 'combat-resume-overlay';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="action-detail-modal">
            <div class="action-detail-name">${nombre}</div>
            ${atk && atk !== '—' ? `<div class="action-detail-stat">⚔️ Ataque: <strong>${atk}</strong></div>` : ''}
            ${dado && dado !== '—' ? `<div class="action-detail-stat">💥 Daño: <strong>${dado}</strong></div>` : ''}
            ${desc ? `<div class="action-detail-desc">${desc}</div>` : ''}
            <button class="btn-combat-secondary" onclick="document.getElementById('actionDetailOverlay')?.remove()" style="margin-top:16px;width:100%">Cerrar</button>
        </div>`;
    document.body.appendChild(overlay);
}

// ── HP & Conditions ───────────────────────────────────────────────────────────
export function setParticipantHp(id, value) {
    const p = combatState.participants.find(x => x.id === id);
    if (!p) return;
    const prevHp = p.hp.current;
    p.hp.current = Math.max(0, Math.min(p.hp.max, isNaN(value) ? p.hp.current : value));
    if (prevHp > p.hp.current && p.conditions.includes('concentracion')) {
        const cd = Math.max(10, Math.floor((prevHp - p.hp.current) / 2));
        showNotification(`🧠 Concentración: ¡Tirada de CON CD ${cd}!`, 4000);
    }
    saveCombatState();
    const hpDisplay = document.getElementById('activeHpDisplay');
    if (hpDisplay) hpDisplay.textContent = p.hp.current;
    const hpBlock = document.getElementById('activeHpBlock');
    if (hpBlock) {
        const pct = p.hp.max > 0 ? (p.hp.current / p.hp.max) * 100 : 0;
        hpBlock.className = 'combat-vital-block ' + (pct <= 0 ? 'hp-dead' : pct <= 25 ? 'hp-critical' : pct <= 50 ? 'hp-low' : '');
        const slider = hpBlock.querySelector('.combat-hp-slider');
        if (slider) slider.style.setProperty('--fill-pct', pct + '%');
    }
    renderTurnQueue();
}

export function toggleParticipantCondition(id, condId) {
    const p = combatState.participants.find(x => x.id === id);
    if (!p) return;
    const idx = p.conditions.indexOf(condId);
    if (idx >= 0) p.conditions.splice(idx, 1);
    else           p.conditions.push(condId);
    saveCombatState();
    renderActivePanel();
}

// ── Group damage ──────────────────────────────────────────────────────────────
export function applyGroupDamage(p, damage) {
    const prevMembers = p.membersRemaining ?? p.groupSize ?? 1;
    p.totalHp = Math.max(0, (p.totalHp ?? 0) - damage);
    if (p.totalHp <= 0) {
        p.membersRemaining = 0; p.currentMemberHp = 0; p.hp.current = 0;
    } else {
        const hpPer = p.hpPerMember || 1;
        p.membersRemaining = Math.ceil(p.totalHp / hpPer);
        const remainder    = p.totalHp % hpPer;
        p.currentMemberHp  = remainder === 0 ? hpPer : remainder;
        p.hp.current       = p.totalHp;
        p.hp.max           = (p.groupSize || 1) * hpPer;
    }
    return Math.max(0, prevMembers - (p.membersRemaining ?? 0));
}

export function applyAttackDamage(attackerId) {
    const inputs = document.querySelectorAll('.attack-dmg-input');
    let applied = 0;
    const log = [];
    inputs.forEach(input => {
        const targetId = input.id.replace('dmg_', '');
        const damage   = parseInt(input.value) || 0;
        if (damage > 0) {
            const target = combatState.participants.find(p => p.id === targetId);
            if (target) {
                const prevHp = target.hp.current;
                if (target.isGroup) {
                    const killed = applyGroupDamage(target, damage);
                    if (killed > 0 && target.tipo === 'enemigo') {
                        const currentEntry = getCurrentLogEntry();
                        if (currentEntry) { if (!currentEntry.kills) currentEntry.kills = []; for (let k = 0; k < killed; k++) currentEntry.kills.push(target.id); }
                    }
                    log.push(`${target.name.split(' ')[0]} −${damage} PG${killed > 0 ? ` (×${killed} caídos)` : ''}`);
                } else {
                    target.hp.current = Math.max(0, target.hp.current - damage);
                    if (prevHp > target.hp.current && target.conditions.includes('concentracion')) {
                        showNotification(`🧠 ${target.name.split(' ')[0]}: Concentración CD ${Math.max(10, Math.floor(damage / 2))}`, 3500);
                    }
                    if (prevHp > 0 && target.hp.current === 0 && target.tipo === 'enemigo') {
                        const currentEntry = getCurrentLogEntry();
                        if (currentEntry) { if (!currentEntry.kills) currentEntry.kills = []; currentEntry.kills.push(target.id); }
                    }
                    log.push(`${target.name.split(' ')[0]} −${damage} PG`);
                }
                applied++;
                input.value = '';
            }
        }
    });
    if (applied > 0) {
        saveCombatState();
        renderTurnQueue();
        renderActivePanel();
        renderCombatLog();
        renderKillScoreboard();
        showNotification(`💥 ${log.join(' · ')}`, 3000);
    } else {
        showNotification('Introduce al menos 1 de daño a un objetivo', 1800);
    }
}

// ── Demonic Form in combat ────────────────────────────────────────────────────
export function toggleDemonicFormInCombat(participantId) {
    const p = combatState.participants.find(x => x.id === participantId);
    if (!p) return;
    p.demonicForm = !p.demonicForm;
    if (p.demonicForm) { p.ac = String(parseInt(p.baseAc) + 2); p.speed = '50ft'; showNotification('😈 ¡Forma Demoníaca activa! CA+2, Velocidad 50ft, +1d8 Necrótico', 2500); }
    else               { p.ac = p.baseAc; p.speed = p.baseSpeed; showNotification('💔 Forma Demoníaca desactivada', 2000); }
    saveCombatState();
    renderCombatManager();
}

// ── Combat Log ────────────────────────────────────────────────────────────────
export function renderRollText(text) {
    if (!text) return '';
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

export function renderCombatLog() {
    const logEl = document.getElementById('combatLog');
    if (!logEl) return;
    const entries = [...combatState.log].reverse();
    logEl.innerHTML = entries.map(entry => {
        const p = combatState.participants.find(x => x.id === entry.participantId);
        const actionsHTML = entry.actions.length
            ? entry.actions.map(a => `<div class="log-action-item">
                <div>✓ ${a.nombre}${a.dice && !a.rollText ? ` (${a.dice})` : ''}${entry.isSegundaAccion ? ' <span class="log-extra-badge">+2ª</span>' : ''}</div>
                ${a.rollText ? `<div class="combat-roll-result">${renderRollText(a.rollText)}</div>` : ''}
                ${a.narratorText ? `<div class="combat-narrator-text">${a.narratorText}</div>` : ''}
            </div>`).join('')
            : '<span style="color:var(--text-muted)">—</span>';
        return `<div class="combat-log-entry${entry.isCurrent ? ' log-current' : ''}">
            <div class="log-entry-header">
                <span class="log-round-badge">R${entry.round}</span>
                <span class="log-participant-name">${entry.participantName.split(' ')[0]}</span>
                ${entry.isCurrent ? '<span class="log-current-badge">← ahora</span>' : ''}
                <button class="log-edit-toggle" onclick="toggleLogEdit(${entry.id})" title="Editar">✏️</button>
            </div>
            <div class="log-actions-display">${actionsHTML}</div>
            ${entry.note ? `<div class="log-note">📝 ${entry.note}</div>` : ''}
            <div class="log-edit-area" id="logEdit_${entry.id}" style="display:none;">
                ${renderLogEditArea(entry, p)}
            </div>
        </div>`;
    }).join('');
}

export function toggleLogEdit(logId) {
    const area = document.getElementById(`logEdit_${logId}`);
    if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
}

export function renderLogEditArea(entry, p) {
    let chips = '';
    if (p?.charData) {
        const allItems = [...(p.charData.combateExtra || []), ...(p.charData.conjuros || [])];
        chips = allItems.map(a => {
            const dice    = a.atk || (a.dado && a.dado !== '—' ? a.dado : '') || '';
            const isUsed  = entry.actions.some(x => x.nombre === a.nombre);
            const safeName = a.nombre.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            const safeDice = dice.replace(/'/g,"\\'");
            return `<button class="combat-chip${isUsed ? ' used' : ''}" onclick="toggleLogAction(${entry.id},'${safeName}','${safeDice}')">${a.nombre}</button>`;
        }).join('');
    }
    const actionsHtml = entry.actions.map(a => {
        const safeName = a.nombre.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        return `<div class="combat-recorded-item">
            ✓ ${a.nombre}${a.dice ? ` — ${a.dice}` : ''}
            <button onclick="removeLogAction(${entry.id},'${safeName}')">×</button>
        </div>`;
    }).join('');
    return `<div class="log-edit-chips">${chips}</div>
        <div class="log-edit-recorded">${actionsHtml}</div>
        <div class="log-custom-row">
            <input type="text" id="logCustomInput_${entry.id}" class="combat-custom-input"
                   placeholder="Acción personalizada..."
                   onkeydown="if(event.key==='Enter') addLogCustomAction(${entry.id})">
            <button onclick="addLogCustomAction(${entry.id})">+</button>
        </div>`;
}

export function toggleLogAction(logId, nombre, dice) {
    const entry = getLogEntry(logId);
    if (!entry) return;
    const idx = entry.actions.findIndex(a => a.nombre === nombre);
    if (idx >= 0) entry.actions.splice(idx, 1);
    else          entry.actions.push({ nombre, dice: dice || '' });
    renderCombatLog();
    if (entry.isCurrent) renderActivePanel();
}

export function removeLogAction(logId, nombre) {
    const entry = getLogEntry(logId);
    if (!entry) return;
    entry.actions = entry.actions.filter(a => a.nombre !== nombre);
    renderCombatLog();
    if (entry.isCurrent) renderActivePanel();
}

export function addLogCustomAction(logId) {
    const input = document.getElementById(`logCustomInput_${logId}`);
    const text  = input?.value?.trim();
    if (!text) return;
    const entry = getLogEntry(logId);
    if (!entry) return;
    entry.actions.push({ nombre: text, dice: '' });
    if (input) input.value = '';
    renderCombatLog();
    if (entry.isCurrent) renderActivePanel();
}

// ── Combat Log View (full screen) ─────────────────────────────────────────────
export function openCombatLogView()  { renderCombatLogView(); setView('combatLogView'); }
export function openCombatLogModal() { openCombatLogView(); }
export function closeCombatLogModal(){ closeCombatLogView(); }

export function closeCombatLogView() {
    if (!combatState.isActive) { setView('landing'); return; }
    setView('combatManager');
    try { renderCombatManager(); } catch (e) { console.warn('renderCombatManager error:', e); }
}

export function renderCombatLogView() {
    const sbEl = document.getElementById('clvScoreboard');
    if (sbEl) {
        const scores = computeKillScoreboard();
        if (scores.length) {
            sbEl.innerHTML = `<div class="clv-sb-title">🏆 Bajas por aliado</div>
                <div class="clv-sb-list">${scores.map(([name, kills]) =>
                    `<span class="clv-sb-entry">
                        <span class="clv-sb-name">${name}</span>
                        <span class="clv-sb-kills">${kills} kill${kills !== 1 ? 's' : ''}</span>
                    </span>`).join('')}</div>`;
            sbEl.style.display = '';
        } else { sbEl.style.display = 'none'; }
    }
    const logEl = document.getElementById('clvLog');
    if (!logEl) return;
    const entries = [...combatState.log].reverse();
    if (!entries.length) { logEl.innerHTML = '<div class="clv-empty">Sin entradas en el registro todavía.</div>'; return; }
    logEl.innerHTML = entries.map(entry => {
        const actionsHTML = entry.actions.length
            ? entry.actions.map(a => `<div class="log-action-item">
                <div>✓ ${a.nombre}${a.dice && !a.rollText ? ` (${a.dice})` : ''}</div>
                ${a.rollText ? `<div class="combat-roll-result">${renderRollText(a.rollText)}</div>` : ''}
                ${a.narratorText ? `<div class="combat-narrator-text">${a.narratorText}</div>` : ''}
            </div>`).join('')
            : '<span style="color:var(--text-muted)">—</span>';
        return `<div class="combat-log-entry${entry.isCurrent ? ' log-current' : ''}">
            <div class="log-entry-header">
                <span class="log-round-badge">R${entry.round}</span>
                <span class="log-participant-name">${entry.participantName.split(' ')[0]}</span>
                ${entry.isCurrent ? '<span class="log-current-badge">← ahora</span>' : ''}
            </div>
            <div class="log-actions-display">${actionsHTML}</div>
            ${entry.note ? `<div class="log-note">📝 ${entry.note}</div>` : ''}
        </div>`;
    }).join('');
}

// ── Kill Scoreboard ───────────────────────────────────────────────────────────
export function computeKillScoreboard() {
    const scores = {};
    combatState.log.forEach(entry => {
        if (!entry.kills?.length) return;
        const actor = combatState.participants.find(p => p.id === entry.participantId);
        if (!actor || actor.tipo === 'enemigo') return;
        const name = entry.participantName.split(' ')[0];
        scores[name] = (scores[name] || 0) + entry.kills.length;
    });
    return Object.entries(scores).sort((a, b) => b[1] - a[1]);
}

export function renderKillScoreboard() {
    const board = document.getElementById('combatScoreboard');
    const list  = document.getElementById('scoreboardList');
    if (!board || !list) return;
    const scores = computeKillScoreboard();
    if (!scores.length) { board.style.display = 'none'; return; }
    board.style.display = 'flex';
    list.innerHTML = scores.map(([name, kills]) =>
        `<span class="scoreboard-entry"><span class="sb-name">${name}</span><span class="sb-kills">${kills} kill${kills !== 1 ? 's' : ''}</span></span>`
    ).join('');
}
