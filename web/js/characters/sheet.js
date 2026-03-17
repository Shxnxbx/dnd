/**
 * characters/sheet.js — Character sheet rendering, editing, and export.
 */

import { appFlags, spellSlotState, notesState, demonicFormState } from '../state.js';
import { skillMapping } from '../config.js';
import { showNotification } from '../ui/notifications.js';
import {
    renderHpSection, initSpellSlotsForChar, renderDemonicSection, updateDemonicFormDisplay,
} from './stats.js';

// ── Utilities ─────────────────────────────────────────────────────────────────
export function getModifier(value) { return Math.floor((value - 10) / 2); }

// ── Combat tab (turn planner in character sheet) ──────────────────────────────
export function extractDiceFromDesc(desc) {
    if (!desc) return null;
    const plain   = desc.replace(/<[^>]+>/g, ' ');
    const matches = plain.match(/\d+d\d+(?:[+-]\d+)?/gi);
    return matches?.length ? matches.join(' + ') : null;
}

export function getDiceBadges(action) {
    let parts = [];
    if (action.atk) parts.push(`<span class="dice-atk">ATK ${action.atk}</span>`);
    if (action.dado && action.dado !== '—') {
        parts.push(`<span class="dice-dmg">DMG ${action.dado}</span>`);
    } else if (!action.atk) {
        const extracted = extractDiceFromDesc(action.desc);
        if (extracted) parts.push(`<span class="dice-dmg">${extracted}</span>`);
    }
    return parts.join('');
}

export function inferActionType(item) {
    if (item.tipo) return item.tipo;
    const nivel  = String(item.nivel ?? '');
    const nombre = item.nombre || '';
    const desc   = item.desc || '';
    if (nivel === 'Reac' || /\(Reacci[oó]n\)/i.test(nombre) || /\(Reacci[oó]n\)/i.test(desc)) return 'reaccion';
    if (/\(Bonus\)/i.test(nombre) || /\bBonus\b/.test(desc)) return 'adicional';
    return 'accion';
}

export function renderCombatInline(data) {
    const html = renderCombatTab(data);
    const inline = document.getElementById('combatInline');
    if (inline) inline.innerHTML = html;
    const tab = document.getElementById('tabCombat');
    if (tab) tab.innerHTML = html;
}

export function renderCombatTab(data) {
    const charId = data.id;
    if (!window.__turnPlannerState) window.__turnPlannerState = {};
    if (!window.__turnPlannerState[charId]) window.__turnPlannerState[charId] = { accion: null, adicional: null, reaccion: null };
    const planner = window.__turnPlannerState[charId];

    const allItems = [...(data.combateExtra || []), ...(data.conjuros || [])];
    const groups   = { accion: [], adicional: [], reaccion: [] };
    allItems.forEach(item => groups[inferActionType(item)].push(item));

    let slotsHTML = '';
    if (data.ranuras?.length > 0) {
        initSpellSlotsForChar(charId);
        slotsHTML = `<div class="slot-tracker combat-slots">
            <div class="slot-tracker-header">
                <span class="slot-tracker-title">✨ Ranuras</span>
                <button class="slot-reset-btn" onclick="resetSpellSlots('${charId}')" title="Descanso largo">🌙</button>
            </div>
            ${data.ranuras.map(slot => {
                const remaining = spellSlotState[charId]?.[slot.nombre] ?? slot.total;
                const pips = Array.from({ length: slot.total }, (_, i) =>
                    `<button class="slot-pip${i >= remaining ? ' used' : ''}"
                        onclick="toggleSpellSlot('${charId}','${slot.nombre}',${i})"></button>`
                ).join('');
                return `<div class="slot-row">
                    <span class="slot-name">${slot.nombre}</span>
                    <div class="slot-track" data-slot="${slot.nombre}">${pips}</div>
                    <span class="slot-count" data-slot="${slot.nombre}">${remaining}/${slot.total}</span>
                </div>`;
            }).join('')}
        </div>`;
    }

    const plannerSlots = [
        { key: 'accion', icon: '🎯', label: 'Acción' },
        { key: 'adicional', icon: '⚡', label: 'Adicional' },
        { key: 'reaccion', icon: '↩️', label: 'Reacción' },
    ];
    const plannerSlotsHTML = plannerSlots.map(s => {
        const sel = planner[s.key];
        return sel
            ? `<div class="planner-slot filled">
                <span class="planner-slot-icon">${s.icon}</span>
                <span class="planner-slot-label">${s.label}:</span>
                <span class="planner-slot-value">${sel.nombre}</span>
                <button class="planner-slot-clear" onclick="clearPlannerSlot('${charId}','${s.key}')">×</button>
               </div>`
            : `<div class="planner-slot empty">
                <span class="planner-slot-icon">${s.icon}</span>
                <span class="planner-slot-label">${s.label}:</span>
                <span class="planner-slot-empty">— selecciona abajo</span>
               </div>`;
    }).join('');

    const selectedActions = [planner.accion, planner.adicional, planner.reaccion].filter(Boolean);
    let diceHTML = '';
    if (selectedActions.length > 0) {
        const rows = selectedActions.map(action => {
            const badges = getDiceBadges(action);
            return `<div class="dice-row">
                <span class="dice-name">${action.nombre}</span>
                <div class="dice-values">${badges || '<span class="dice-utility">Sin tirada</span>'}</div>
            </div>`;
        }).join('');
        diceHTML = `<div class="dice-panel-combat"><div class="dice-panel-title">🎲 Dados del Turno</div>${rows}</div>`;
    }

    const sections = [
        { key: 'accion', icon: '🎯', label: 'Acciones' },
        { key: 'adicional', icon: '⚡', label: 'Adicionales' },
        { key: 'reaccion', icon: '↩️', label: 'Reacciones' },
    ];
    const actionListHTML = sections.map(section => {
        const items = groups[section.key];
        if (!items.length) return '';
        const cardsHTML = items.map(item => {
            const sel        = planner[section.key];
            const isSelected = sel && sel.nombre === item.nombre;
            const diceStr    = item.atk
                ? `ATK ${item.atk}${item.dado && item.dado !== '—' ? ` | DMG ${item.dado}` : ''}`
                : (item.dado && item.dado !== '—' ? `DMG ${item.dado}` : (extractDiceFromDesc(item.desc) || ''));
            const safeName = item.nombre.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            return `<div class="combat-action-card${isSelected ? ' selected' : ''}"
                         onclick="selectCombatAction('${charId}','${section.key}','${safeName}')">
                <div class="combat-action-header">
                    <span class="combat-action-name">${item.nombre}</span>
                    ${diceStr ? `<span class="combat-action-dice">${diceStr}</span>` : ''}
                </div>
                <div class="combat-action-desc">${item.desc}</div>
            </div>`;
        }).join('');
        return `<div class="combat-section">
            <div class="combat-section-title">${section.icon} ${section.label}</div>
            <div class="combat-action-list">${cardsHTML}</div>
        </div>`;
    }).join('');

    return `<div class="turn-planner">
        <div class="turn-planner-title">⚡ Planificador de Turno</div>
        <div class="planner-slots">${plannerSlotsHTML}</div>
        ${diceHTML}
    </div>
    ${slotsHTML}
    ${actionListHTML}`;
}

export function selectCombatAction(charId, tipo, nombre) {
    const data = window.characterData[charId];
    if (!data) return;
    const allItems = [...(data.combateExtra || []), ...(data.conjuros || [])];
    const item = allItems.find(i => i.nombre === nombre);
    if (!item) return;
    if (!window.__turnPlannerState) window.__turnPlannerState = {};
    if (!window.__turnPlannerState[charId]) window.__turnPlannerState[charId] = { accion: null, adicional: null, reaccion: null };
    const planner = window.__turnPlannerState[charId];
    planner[tipo] = (planner[tipo]?.nombre === nombre) ? null : item;
    refreshCombatSections(data);
}

export function clearPlannerSlot(charId, tipo) {
    if (!window.__turnPlannerState?.[charId]) return;
    window.__turnPlannerState[charId][tipo] = null;
    const data = window.characterData[charId];
    if (data) refreshCombatSections(data);
}

export function refreshCombatSections(data) {
    const html = renderCombatTab(data);
    const inline = document.getElementById('combatInline');
    if (inline) inline.innerHTML = html;
    const tab = document.getElementById('tabCombat');
    if (tab) tab.innerHTML = html;
}

// ── Spell and Inventory rendering ─────────────────────────────────────────────
export function renderTraitItem(trait, index) {
    return `
        <div class="feature-item" data-index="${index}">
            <div class="feature-header" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
                <h3 style="margin:0;flex:1">${trait.nombre}</h3>
                ${appFlags.isCharacterEditing
                    ? `<button class="btn-delete-item" onclick="deleteFeature(${index})">×</button>`
                    : '<span class="feature-chevron">▼</span>'}
            </div>
            <div class="item-desc collapsible">${trait.desc}</div>
        </div>`;
}

export function renderCategorizedInventory(data, filter = '') {
    const resultsContainer = document.getElementById('inventoryResults');
    if (!resultsContainer) return;

    const categories = { 'Equipado': [], 'Objetos Mágicos': [], 'Consumibles': [], 'Mochila': [] };
    if (data.inventario) {
        data.inventario.forEach((item, index) => {
            if (filter && !item.nombre.toLowerCase().includes(filter) && !item.desc.toLowerCase().includes(filter)) return;
            const desc = item.desc.toLowerCase();
            if (desc.includes('arma') || desc.includes('armadura') || desc.includes('escudo'))       categories['Equipado'].push({ item, index });
            else if (desc.includes('mágico') || desc.includes('anillo') || desc.includes('capa'))    categories['Objetos Mágicos'].push({ item, index });
            else if (desc.includes('poción') || desc.includes('pergamino') || desc.includes('comida')) categories['Consumibles'].push({ item, index });
            else categories['Mochila'].push({ item, index });
        });
    }

    let html = '';
    for (const [catName, items] of Object.entries(categories)) {
        if (!items.length && filter) continue;
        html += `<h3 class="feature-section-title">${catName}</h3><div class="feature-grid">`;
        if (!items.length) {
            html += `<div style="color:var(--text-secondary);font-size:12px;padding:10px;">Nada en esta categoría.</div>`;
        } else {
            items.forEach(({ item, index }) => {
                html += `<div class="feature-item">
                    <div class="feature-header" style="display:flex;justify-content:space-between;cursor:pointer;">
                        <h3 style="margin:0">${item.nombre}</h3>
                        ${appFlags.isCharacterEditing ? `<button class="btn-delete-item" onclick="deleteInventoryItem(${index})">×</button>` : ''}
                    </div>
                    <div class="item-desc collapsible expanded">${item.desc}</div>
                </div>`;
            });
        }
        html += '</div>';
    }
    if (appFlags.isCharacterEditing) html += `<button class="btn-add-item" onclick="addInventoryItem()">+ Añadir Objeto</button>`;
    resultsContainer.innerHTML = html;
}

export function renderSpellsWithFilters(data) {
    const container = document.getElementById('tabSpells');
    if (!data.conjuros?.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:40px;">Este personaje no posee conjuros.</div>';
        return;
    }
    const levels = ['Todos'];
    data.conjuros.forEach(s => {
        const lv = s.nivel === 'Truco' ? 'Truco' : (s.nivel === 'Esp' || s.nivel === 'Especial') ? 'Esp' : `Nv${s.nivel}`;
        if (!levels.includes(lv)) levels.push(lv);
    });
    const filterBtns = levels.map((lv, i) =>
        `<button class="spell-filter-btn${i === 0 ? ' active' : ''}" data-level="${lv}">${lv}</button>`
    ).join('');

    const charId = appFlags.currentCharacterId;
    let slotHTML = '';
    if (charId && data.ranuras?.length > 0) {
        initSpellSlotsForChar(charId);
        slotHTML = `<div class="slot-tracker">
            <div class="slot-tracker-header">
                <span class="slot-tracker-title">✨ Ranuras de Conjuro</span>
                <button class="slot-reset-btn" onclick="resetSpellSlots('${charId}')" title="Descanso largo">🌙 Descanso</button>
            </div>
            ${data.ranuras.map(slot => {
                const remaining = spellSlotState[charId]?.[slot.nombre] ?? slot.total;
                const pips = Array.from({ length: slot.total }, (_, i) =>
                    `<button class="slot-pip${i >= remaining ? ' used' : ''}"
                        onclick="toggleSpellSlot('${charId}','${slot.nombre}',${i})"></button>`
                ).join('');
                return `<div class="slot-row">
                    <span class="slot-name">${slot.nombre}</span>
                    <div class="slot-track" data-slot="${slot.nombre}">${pips}</div>
                    <span class="slot-count" data-slot="${slot.nombre}">${remaining}/${slot.total}</span>
                </div>`;
            }).join('')}
        </div>`;
    }

    let html = `${slotHTML}
        <div class="spell-level-filters" id="spellFilters">${filterBtns}</div>
        <div class="spell-filters" style="margin-bottom:14px;display:flex;gap:10px;">
            <input type="text" id="spellSearch" placeholder="Buscar conjuro..." class="sheet-input" style="flex:1">
        </div>
        <div class="feature-grid" id="spellsGrid">`;

    data.conjuros.forEach((spell, index) => {
        const levelKey = spell.nivel === 'Truco' ? 'Truco' : (spell.nivel === 'Esp' || spell.nivel === 'Especial') ? 'Esp' : `Nv${spell.nivel}`;
        const type = spell.desc.toLowerCase().includes('daño') ? 'DAÑO'
            : spell.desc.toLowerCase().includes('cur') ? 'CURACIÓN'
            : spell.desc.toLowerCase().includes('control') ? 'CONTROL' : 'UTILIDAD';
        html += `<div class="spell-item" data-name="${spell.nombre.toLowerCase()}" data-level="${levelKey}">
            <div class="feature-header" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
                <h3 style="margin:0;flex:1">${spell.nombre}</h3>
                ${appFlags.isCharacterEditing ? `<button class="btn-delete-item" onclick="deleteSpell(${index})">×</button>` : '<span class="feature-chevron">▼</span>'}
            </div>
            <div class="item-meta">${spell.nivel === 'Truco' ? 'Truco' : 'Nivel ' + spell.nivel} • ${type}</div>
            <div class="item-desc collapsible">${spell.desc}</div>
        </div>`;
    });
    html += '</div>';
    if (appFlags.isCharacterEditing) html += `<button class="btn-add-item" onclick="addSpell()">+ Añadir Conjuro</button>`;
    container.innerHTML = html;

    let activeLevel = 'Todos', activeSearch = '';
    const applySpellFilters = () => {
        document.querySelectorAll('#spellsGrid .spell-item').forEach(item => {
            item.style.display = (
                (activeLevel === 'Todos' || item.dataset.level === activeLevel) &&
                (!activeSearch || item.dataset.name.includes(activeSearch))
            ) ? '' : 'none';
        });
    };
    document.querySelectorAll('#spellFilters .spell-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#spellFilters .spell-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeLevel = btn.dataset.level;
            applySpellFilters();
        });
    });
    const search = document.getElementById('spellSearch');
    if (search) search.addEventListener('input', e => { activeSearch = e.target.value.toLowerCase(); applySpellFilters(); });
}

export function setupCollapsibleEvents() {
    const sheet = document.getElementById('characterSheetContainer');
    if (!sheet || sheet._collapsibleSetup) return;
    sheet._collapsibleSetup = true;
    sheet.addEventListener('click', e => {
        const header = e.target.closest('.feature-header');
        if (!header || e.target.closest('button')) return;
        const desc = header.nextElementSibling;
        if (desc?.classList.contains('collapsible')) {
            const expanding = !desc.classList.contains('expanded');
            desc.classList.toggle('expanded', expanding);
            const chevron = header.querySelector('.feature-chevron');
            if (chevron) chevron.textContent = expanding ? '▲' : '▼';
        }
    });
}

// ── Main character sheet renderer ─────────────────────────────────────────────
export function renderCharacterSheet(charId) {
    if (!window.characterData?.[charId]) {
        console.error('Data not found for character:', charId);
        showNotification('Datos de personaje no encontrados', 3000);
        return;
    }
    appFlags.currentCharacterId = charId;
    const data = window.characterData[charId];

    const statsContainer = document.getElementById('sheetStats');
    statsContainer.innerHTML = '';

    const imgUrl   = data.imagen || 'assets/imagenes/placeholder.jpg';
    const imgScale = data.imagenScale || 1;
    statsContainer.innerHTML += `
        <div class="sheet-portrait-container">
            <img id="portraitImg" src="${imgUrl}" class="sheet-portrait-img" style="transform: scale(${imgScale})"
                 onerror="this.src='https://placehold.co/400x500/1e2536/d4af37?text=Sin+Imagen'">
            ${appFlags.isCharacterEditing ? `
                <div class="portrait-edit-overlay">
                    <input class="sheet-input" id="editImage" value="${data.imagen || ''}" placeholder="URL Imagen...">
                    <input type="range" id="editImageScale" min="1.0" max="3.0" step="0.1" value="${imgScale}">
                </div>` : ''}
        </div>`;

    const statsGrid = document.createElement('div');
    statsGrid.className = 'stat-grid';
    for (const [stat, value] of Object.entries(data.stats)) {
        const mod = getModifier(value);
        const signedMod = mod >= 0 ? `+${mod}` : mod;
        statsGrid.innerHTML += `
            <div class="stat-box">
                <div class="stat-details">
                    <span class="stat-label">${stat}</span>
                    ${appFlags.isCharacterEditing
                        ? `<input type="number" class="sheet-input" value="${value}" data-stat="${stat}">`
                        : `<span class="stat-value">${value}</span>`}
                </div>
                <div class="stat-mod">${signedMod}</div>
                <div class="stat-sublist">
                    <div class="sub-item ${data.competencias_salvacion?.includes(stat) ? 'proficient' : ''}">
                        <span>Salvación</span>
                        <span>${data.competencias_salvacion?.includes(stat) ? `+${mod + (data.resumen.Competencia || 2)}` : signedMod}</span>
                    </div>
                    ${(skillMapping[stat] || []).map(skill => {
                        const isProf = data.habilidades?.includes(skill);
                        const bonus  = isProf ? mod + parseInt(data.resumen.Competencia || 2) : mod;
                        return `<div class="sub-item ${isProf ? 'proficient' : ''}">
                            <span>${skill}</span>
                            <span>${bonus >= 0 ? '+' : ''}${bonus}</span>
                            ${isProf ? '<div class="prof-dot"></div>' : ''}
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
    }
    statsContainer.appendChild(statsGrid);

    if (appFlags.isCharacterEditing) {
        document.getElementById('sheetName').innerHTML  = `<input class="sheet-input" value="${data.nombre}" id="editName">`;
        document.getElementById('sheetRace').innerHTML  = `<input class="sheet-input" value="${data.raza}" id="editRace" style="width:120px">`;
        document.getElementById('sheetClass').innerHTML = `<input class="sheet-input" value="${data.clase}" id="editClass" style="width:140px">`;
        document.getElementById('sheetLevel').innerHTML = `<input type="number" class="sheet-input" value="${data.nivel}" id="editLevel" style="width:60px">`;
    } else {
        document.getElementById('sheetName').textContent  = data.nombre;
        document.getElementById('sheetRace').textContent  = data.raza;
        document.getElementById('sheetClass').textContent = data.clase;
        document.getElementById('sheetLevel').textContent = data.nivel;
    }

    const combatVitals = document.getElementById('sheetCombatVitals');
    combatVitals.innerHTML = renderHpSection(charId) + `
        <div class="combat-pill" id="pillCA" style="border-left-color: #4488ff">
            <span class="pill-icon">🛡️</span>
            <div><div class="pill-label">CA</div><div class="pill-value">${data.resumen.CA}</div></div>
        </div>
        <div class="combat-pill" style="border-left-color: #44ff88">
            <span class="pill-icon">⚡</span>
            <div><div class="pill-label">Iniciativa</div><div class="pill-value">${data.resumen.Iniciativa}</div></div>
        </div>
        <div class="combat-pill" id="pillSpeed" style="border-left-color: #ffcc44">
            <span class="pill-icon">🏃</span>
            <div><div class="pill-label">Velocidad</div><div class="pill-value">${data.resumen.Velocidad}</div></div>
        </div>
        <div class="combat-pill" style="border-left-color: #aa88ff">
            <span class="pill-icon">⚔️</span>
            <div><div class="pill-label">Competencia</div><div class="pill-value">${data.resumen.Competencia || '+2'}</div></div>
        </div>`;

    renderCombatInline(data);
    document.getElementById('sheetResources').style.display = 'flex';
    renderDemonicSection(charId);
    if (charId === 'Vel' && demonicFormState[charId]?.active) updateDemonicFormDisplay(charId);

    _updateSheetTabs(data, charId);

    document.getElementById('characterSheetContainer').style.display = 'flex';
    const diceWidget = document.getElementById('diceRollerWidget');
    if (diceWidget) diceWidget.style.display = 'flex';
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'flex';
    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.style.display = 'flex';
    const breadcrumbs = document.getElementById('breadcrumbs');
    if (breadcrumbs) {
        const shortName = data.nombre.split(' ')[0];
        breadcrumbs.textContent = window.combatModeActive ? `⚔️ Combate › Jugador › ${shortName}` : shortName;
    }
}

function _updateSheetTabs(data, charId) {
    const tabCombat    = document.getElementById('tabCombat');
    const tabFeatures  = document.getElementById('tabFeatures');
    const tabInventory = document.getElementById('tabInventory');

    if (tabCombat) tabCombat.innerHTML = renderCombatTab(data);

    let narrativeHTML = '<div class="feature-grid">';
    data.rasgos.forEach((trait, i) => {
        if (!trait.nombre.includes('🗡️') && !trait.nombre.includes('⚔️') && !trait.nombre.includes('Combate')) {
            narrativeHTML += renderTraitItem(trait, i);
        }
    });
    narrativeHTML += '</div>';
    if (tabFeatures) tabFeatures.innerHTML = narrativeHTML;

    document.getElementById('tabInventory').innerHTML = `
        <div class="inventory-filters" style="margin-bottom:20px;">
            <input type="text" id="inventorySearch" placeholder="Buscar en equipo..." class="sheet-input" style="width:100%">
        </div>
        <div id="inventoryResults"></div>`;
    renderCategorizedInventory(data, '');
    const invSearch = document.getElementById('inventorySearch');
    if (invSearch) invSearch.addEventListener('input', e => renderCategorizedInventory(data, e.target.value.toLowerCase()));

    renderSpellsWithFilters(data);
    setupCollapsibleEvents();

    // Features tab (full)
    let featuresHTML = '<h3 class="feature-section-title">Rasgos de Clase y Raza</h3><div class="feature-grid">';
    if (appFlags.isCharacterEditing) {
        featuresHTML += `<div class="feature-item" style="grid-column:1/-1">
            <h3>Competencias (Habilidades)</h3>
            <input class="sheet-input" value="${data.habilidades.join(', ')}" id="editSkills">
            <small style="color:var(--text-secondary)">Separar por comas</small>
        </div>`;
        data.rasgos.forEach((feat, i) => {
            featuresHTML += `<div class="feature-item">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                    <input class="sheet-input" value="${feat.nombre}" onchange="updateFeature(${i},'nombre',this.value)" style="font-weight:bold;color:var(--accent-gold)">
                    <button class="btn-delete-item" onclick="deleteFeature(${i})">×</button>
                </div>
                <textarea class="sheet-textarea" onchange="updateFeature(${i},'desc',this.value)">${feat.desc}</textarea>
            </div>`;
        });
        featuresHTML += `<button class="btn-add-item" onclick="addFeature()">+ Añadir Rasgo</button>`;
    } else {
        featuresHTML += `<div class="feature-item">
            <h3>Competencias</h3>
            <div class="item-desc"><strong>Habilidades:</strong> ${data.habilidades.join(', ')}</div>
        </div>`;
        data.rasgos.forEach((feat) => {
            featuresHTML += `<div class="feature-item">
                <h3>${feat.nombre}</h3>
                <div class="item-desc">${feat.desc}</div>
            </div>`;
        });
    }
    featuresHTML += '</div>';
    if (tabFeatures) tabFeatures.innerHTML = featuresHTML;

    if (appFlags.isCharacterEditing) {
        let spellsHTML = '<div class="feature-grid">';
        (data.conjuros || []).forEach((spell, i) => {
            spellsHTML += `<div class="spell-item">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                    <input class="sheet-input" value="${spell.nombre}" onchange="updateSpell(${i},'nombre',this.value)" style="font-weight:bold;color:var(--accent-gold)">
                    <button class="btn-delete-item" onclick="deleteSpell(${i})">×</button>
                </div>
                <input class="sheet-input" value="${spell.nivel}" onchange="updateSpell(${i},'nivel',this.value)" style="margin-bottom:5px;width:100px" placeholder="Nivel">
                <textarea class="sheet-textarea" onchange="updateSpell(${i},'desc',this.value)">${spell.desc}</textarea>
            </div>`;
        });
        spellsHTML += `<button class="btn-add-item" onclick="addSpell()">+ Añadir Conjuro</button></div>`;
        document.getElementById('tabSpells').innerHTML = spellsHTML;
    } else {
        renderSpellsWithFilters(data);
    }

    if (appFlags.isCharacterEditing) {
        let inventoryHTML = '<div class="feature-grid">';
        (data.inventario || []).forEach((item, i) => {
            inventoryHTML += `<div class="feature-item">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                    <input class="sheet-input" value="${item.nombre}" onchange="updateInventoryItem(${i},'nombre',this.value)" style="font-weight:bold;color:var(--accent-gold)">
                    <button class="btn-delete-item" onclick="deleteInventoryItem(${i})">×</button>
                </div>
                <textarea class="sheet-textarea" onchange="updateInventoryItem(${i},'desc',this.value)">${item.desc}</textarea>
            </div>`;
        });
        inventoryHTML += `<button class="btn-add-item" onclick="addInventoryItem()">+ Añadir Objeto</button></div>`;
        document.getElementById('tabInventory').innerHTML = inventoryHTML;
    } else {
        renderCategorizedInventory(data, '');
    }

    const tabNotes = document.getElementById('tabNotes');
    if (tabNotes) {
        tabNotes.innerHTML = `<div class="notes-container">
            <h3 class="section-label">📝 Notas de Sesión</h3>
            <textarea class="notes-textarea" id="sessionNotesArea"
                placeholder="Apuntes de la sesión, objetivos, cosas importantes..."
                oninput="saveNote('${charId}', this.value)">${notesState[charId] || ''}</textarea>
            <div class="notes-hint">Guardado automáticamente</div>
        </div>`;
    }

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const isMobile = window.innerWidth <= 768;
    const defaultTabKey = isMobile ? 'combat' : 'features';
    const defaultBtn = document.querySelector(`.tab-btn[data-tab="${defaultTabKey}"]`);
    const defaultId  = 'tab' + defaultTabKey.charAt(0).toUpperCase() + defaultTabKey.slice(1);
    if (defaultBtn) defaultBtn.classList.add('active');
    const defaultContent = document.getElementById(defaultId);
    if (defaultContent) defaultContent.classList.add('active');
}

// ── Character selection menu ──────────────────────────────────────────────────
export function renderCharacterSelectionMenu() {
    const container = document.getElementById('characterListContainer');
    if (!container || !window.characterData) return;
    container.innerHTML = '';
    Object.values(window.characterData).filter(char => char.tipo === 'jugador').forEach(char => {
        const card = document.createElement('div');
        card.className = 'card character-card';
        card.onclick = () => { appFlags.isCharacterEditing = false; renderCharacterSheet(char.id); };
        const imgUrl = char.imagen || 'assets/imagenes/placeholder.jpg';
        card.innerHTML = `
            <div class="card-img-wrapper" style="width:72px;height:72px;border-radius:50%;overflow:hidden;border:2px solid var(--accent-gold);margin-bottom:8px;box-shadow:0 0 10px rgba(0,0,0,0.5);flex-shrink:0;">
                <img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;object-position:top center;" onerror="this.src='https://placehold.co/100x100/1e2536/d4af37?text=?'">
            </div>
            <div class="card-title">${char.nombre}</div>
            <div class="char-card-meta">${char.raza} · ${char.clase}</div>`;
        container.appendChild(card);
    });
}

// ── Edit actions ──────────────────────────────────────────────────────────────
export function toggleCharacterEditMode() {
    appFlags.isCharacterEditing = !appFlags.isCharacterEditing;
    renderCharacterSheet(appFlags.currentCharacterId);
}

export function saveCharacterChanges() {
    const char = window.characterData[appFlags.currentCharacterId];
    const imageInput = document.getElementById('editImage'); if (imageInput) char.imagen = imageInput.value;
    const scaleInput = document.getElementById('editImageScale'); if (scaleInput) char.imagenScale = parseFloat(scaleInput.value);
    const nameInput  = document.getElementById('editName');  if (nameInput)  char.nombre = nameInput.value;
    const raceInput  = document.getElementById('editRace');  if (raceInput)  char.raza   = raceInput.value;
    const classInput = document.getElementById('editClass'); if (classInput) char.clase  = classInput.value;
    const levelInput = document.getElementById('editLevel'); if (levelInput) char.nivel  = parseInt(levelInput.value) || 1;
    document.querySelectorAll('[data-stat]').forEach(input => { char.stats[input.dataset.stat] = parseInt(input.value) || 10; });
    const skillsInput = document.getElementById('editSkills');
    if (skillsInput) char.habilidades = skillsInput.value.split(',').map(s => s.trim()).filter(s => s);
    appFlags.isCharacterEditing = false;
    renderCharacterSheet(appFlags.currentCharacterId);
    showNotification('Cambios guardados. ¡Recuerda EXPORTAR para no perderlos!', 4000);
    renderCharacterSelectionMenu();
}

export function updateFeature(index, field, value) {
    if (window.characterData[appFlags.currentCharacterId].rasgos[index])
        window.characterData[appFlags.currentCharacterId].rasgos[index][field] = value;
}
export function deleteFeature(index) {
    if (confirm('¿Borrar rasgo?')) {
        window.characterData[appFlags.currentCharacterId].rasgos.splice(index, 1);
        renderCharacterSheet(appFlags.currentCharacterId);
    }
}
export function addFeature() {
    window.characterData[appFlags.currentCharacterId].rasgos.push({ nombre: 'Nuevo Rasgo', desc: 'Descripción' });
    renderCharacterSheet(appFlags.currentCharacterId);
}
export function updateSpell(index, field, value) {
    if (window.characterData[appFlags.currentCharacterId].conjuros[index])
        window.characterData[appFlags.currentCharacterId].conjuros[index][field] = value;
}
export function deleteSpell(index) {
    if (confirm('¿Borrar conjuro?')) {
        window.characterData[appFlags.currentCharacterId].conjuros.splice(index, 1);
        renderCharacterSheet(appFlags.currentCharacterId);
    }
}
export function addSpell() {
    if (!window.characterData[appFlags.currentCharacterId].conjuros)
        window.characterData[appFlags.currentCharacterId].conjuros = [];
    window.characterData[appFlags.currentCharacterId].conjuros.push({ nombre: 'Nuevo Conjuro', nivel: '1', desc: 'Descripción' });
    renderCharacterSheet(appFlags.currentCharacterId);
}
export function updateInventoryItem(index, field, value) {
    if (window.characterData[appFlags.currentCharacterId].inventario[index])
        window.characterData[appFlags.currentCharacterId].inventario[index][field] = value;
}
export function deleteInventoryItem(index) {
    if (confirm('¿Borrar objeto del inventario?')) {
        window.characterData[appFlags.currentCharacterId].inventario.splice(index, 1);
        renderCharacterSheet(appFlags.currentCharacterId);
    }
}
export function addInventoryItem() {
    if (!window.characterData[appFlags.currentCharacterId].inventario)
        window.characterData[appFlags.currentCharacterId].inventario = [];
    window.characterData[appFlags.currentCharacterId].inventario.push({ nombre: 'Nuevo Objeto', desc: 'Descripción' });
    renderCharacterSheet(appFlags.currentCharacterId);
}
export function exportCharacters() {
    const dataStr = 'window.characterData = ' + JSON.stringify(window.characterData, null, 4) + ';';
    const url = URL.createObjectURL(new Blob([dataStr], { type: 'text/javascript' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'characters.js';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Archivo characters.js descargado. Guárdalo en la carpeta del proyecto.', 5000);
}

export function setupCharacterSheetListeners() {
    const editBtn   = document.getElementById('editCharBtn');   if (editBtn)   editBtn.addEventListener('click', toggleCharacterEditMode);
    const saveBtn   = document.getElementById('saveCharBtn');   if (saveBtn)   saveBtn.addEventListener('click', saveCharacterChanges);
    const exportBtn = document.getElementById('exportCharBtn'); if (exportBtn) exportBtn.addEventListener('click', exportCharacters);

    document.getElementById('closeSheetBtn').addEventListener('click', () => {
        document.getElementById('characterSheetContainer').style.display = 'none';
        appFlags.isCharacterEditing = false;
        const diceWidget = document.getElementById('diceRollerWidget');
        if (window.mapState?.currentView === 'landing' && diceWidget) diceWidget.style.display = 'none';
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const targetTab = e.target.dataset.tab;
            const targetId  = `tab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(targetId);
            if (content) content.classList.add('active');
        });
    });

    Object.keys(window.characterData || {}).forEach(id => {
        const card = document.getElementById(`charCard${id}`);
        if (card) {
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);
            newCard.addEventListener('click', () => {
                appFlags.isCharacterEditing = false;
                renderCharacterSheet(id);
            });
        }
    });
}
