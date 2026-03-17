/**
 * main.js — Application entry point.
 *
 * Imports all modules, exposes public functions to window (for HTML onclick
 * compatibility), and bootstraps the application.
 */

// ── Core ──────────────────────────────────────────────────────────────────────
import { CLIENT_ID } from './config.js';
import { mapState, appFlags, roleState } from './state.js';

// ── UI ────────────────────────────────────────────────────────────────────────
import { setView, currentView } from './ui/router.js';
import { showNotification, updateTaskMd } from './ui/notifications.js';

// ── Auth ──────────────────────────────────────────────────────────────────────
import {
    isMaster, initRole, showRoleSelectionOverlay,
    showPlayerPicker, selectRole, updateRoleIndicator,
} from './auth/role.js';

// ── Sync ──────────────────────────────────────────────────────────────────────
import {
    saveCombatState, clearSavedCombat,
    loadSavedCombatIfAny, resumeSavedCombat, discardSavedCombat,
} from './sync/api.js';
import { connectToSSE } from './sync/sse.js';

// ── Maps ──────────────────────────────────────────────────────────────────────
import {
    renderMap, navigateBack, adjustZoom, resetView,
    toggleEditMode, showAddMapModal, saveNewMap, exportData,
    savePin, editPin, deletePin, navigateToMap,
    handleMapMouseDown, handleMapMouseMove, handleMapMouseUp,
    handleMapWheel, handleRightClick,
    handleMapTouchStart, handleMapTouchMove, handleMapTouchEnd,
} from './maps/maps.js';

// ── Characters ────────────────────────────────────────────────────────────────
import {
    loadStateFromStorage, setupDiceRoller, setupCombatOptionsMenu, rollDie,
    setHp, toggleInspiration, toggleDeathSave, toggleCondition,
    toggleSpellSlot, resetSpellSlots, toggleDemonicForm, advanceDemonicTurn,
} from './characters/stats.js';
import {
    renderCharacterSheet, renderCharacterSelectionMenu,
    toggleCharacterEditMode, saveCharacterChanges, setupCharacterSheetListeners,
    updateFeature, deleteFeature, addFeature,
    updateSpell, deleteSpell, addSpell,
    updateInventoryItem, deleteInventoryItem, addInventoryItem,
    exportCharacters, renderSpellsWithFilters,
    inferActionType, extractDiceFromDesc,
} from './characters/sheet.js';

// ── Combat — rendering ────────────────────────────────────────────────────────
import {
    renderCombatManager, renderTurnQueue, renderActivePanel,
    createCurrentTurnEntry, getCurrentLogEntry, getLogEntry,
    toggleCombatAction, toggleSlotManual,
    addPermanentCustomAction, removePermanentCustomAction,
    removeCombatAction, addCustomCombatAction, setCombatTurnNote,
    selectPlannerAction, removePlannerSlot,
    rollActionDice, showActionDetail,
    setParticipantHp, toggleParticipantCondition,
    applyGroupDamage, applyAttackDamage,
    toggleDemonicFormInCombat,
    renderCombatLog, toggleLogEdit, renderLogEditArea,
    toggleLogAction, removeLogAction, addLogCustomAction,
    openCombatLogView, openCombatLogModal, closeCombatLogModal, closeCombatLogView,
    renderCombatLogView,
    computeKillScoreboard, renderKillScoreboard,
} from './combat/rendering.js';

// ── Combat — engine ───────────────────────────────────────────────────────────
import {
    nextCombatTurn, showNextTurnWarning, confirmNextTurn, dismissNextTurnWarning,
    _doNextTurn, skipSegundaAccion, skipExtraAttack,
    previousCombatTurn, confirmEndCombat, _doClearCombat,
    buildHistoryText, copyHistoryToClipboard, showCombatSummary,
} from './combat/engine.js';

// ── Combat — setup ────────────────────────────────────────────────────────────
import {
    showCombatSetup, showPlayerCombat, showCombatMode,
    goToCombatInitiative, beginCombat, parseSetupActions, beginCombatFromSetup,
    renderCombatSetupCard, renderCombatSelectCard, renderCombatSetup,
    toggleCombatParticipant, renderSpecialSummonsSection, addSpecialSummonToSetup,
    setSetupJugadorInitiative, switchCombatSetupTab, _updateSetupCount,
    renderCombatInitiative, setParticipantInitiative,
    addSetupNpc, renderSetupNpcList, removeSetupNpc,
} from './combat/setup.js';

// ── Combat — NPCs ─────────────────────────────────────────────────────────────
import {
    showQuickEnemyModal, showQuickAllyModal, showQuickNpcModal,
    _saveEntityTemplate, toggleQeGroupFields, toggleQeSummonFields,
    toggleSetupGroupFields, toggleSetupSummonFields,
    addQeAction, getQeActions, submitQuickEnemy, submitQuickNpc,
    showInvocationDetail, addInvocationToCombat,
} from './combat/npc.js';

// ── Combat — summons ──────────────────────────────────────────────────────────
import { toggleSirvienteInvisible } from './combat/summons.js';

// ── Online ────────────────────────────────────────────────────────────────────
import {
    showOnlineLobby, startOnlineCombatSetup, startCombatSession,
    updateWaitingRoom, startOnlineCombat, showOnlineCodeModal,
    showCurrentSessionCode, renderCombatShareLink,
    joinOnlineSession, showOnlineError, clearOnlineSession,
} from './online/session.js';

// ── CLIENT_ID bootstrap ───────────────────────────────────────────────────────
window.__CLIENT_ID = CLIENT_ID;

// ── Expose all public functions to window (for HTML onclick compatibility) ────

// UI
window.setView      = setView;
window.currentView  = currentView;
window.showNotification = showNotification;

// Auth
window.isMaster               = isMaster;
window.selectRole             = selectRole;
window.showPlayerPicker       = showPlayerPicker;
window.showRoleSelectionOverlay = showRoleSelectionOverlay;
window.updateRoleIndicator    = updateRoleIndicator;

// Sync
window.resumeSavedCombat  = resumeSavedCombat;
window.discardSavedCombat = discardSavedCombat;

// Maps
window.navigateBack   = navigateBack;
window.adjustZoom     = adjustZoom;
window.resetView      = resetView;
window.toggleEditMode = toggleEditMode;
window.showAddMapModal = showAddMapModal;
window.saveNewMap     = saveNewMap;
window.exportData     = exportData;
window.savePin        = savePin;
window.editPin        = editPin;
window.deletePin      = deletePin;
window.navigateToMap  = navigateToMap;

// Characters
window.renderCharacterSheet       = renderCharacterSheet;
window.renderCharacterSelectionMenu = renderCharacterSelectionMenu;
window.toggleCharacterEditMode    = toggleCharacterEditMode;
window.saveCharacterChanges       = saveCharacterChanges;
window.updateFeature              = updateFeature;
window.deleteFeature              = deleteFeature;
window.addFeature                 = addFeature;
window.updateSpell                = updateSpell;
window.deleteSpell                = deleteSpell;
window.addSpell                   = addSpell;
window.updateInventoryItem        = updateInventoryItem;
window.deleteInventoryItem        = deleteInventoryItem;
window.addInventoryItem           = addInventoryItem;
window.exportCharacters           = exportCharacters;
window.renderSpellsWithFilters    = renderSpellsWithFilters;
window.setHp                      = setHp;
window.toggleInspiration          = toggleInspiration;
window.toggleDeathSave            = toggleDeathSave;
window.toggleCondition            = toggleCondition;
window.toggleSpellSlot            = toggleSpellSlot;
window.resetSpellSlots            = resetSpellSlots;
window.rollDie                    = rollDie;
window.toggleDemonicForm          = toggleDemonicForm;
window.advanceDemonicTurn         = advanceDemonicTurn;

// Combat rendering
window.renderCombatManager      = renderCombatManager;
window.renderTurnQueue          = renderTurnQueue;
window.renderActivePanel        = renderActivePanel;
window.createCurrentTurnEntry   = createCurrentTurnEntry;
window.getCurrentLogEntry       = getCurrentLogEntry;
window.getLogEntry              = getLogEntry;
window.toggleCombatAction       = toggleCombatAction;
window.toggleSlotManual         = toggleSlotManual;
window.addPermanentCustomAction  = addPermanentCustomAction;
window.removePermanentCustomAction = removePermanentCustomAction;
window.removeCombatAction       = removeCombatAction;
window.addCustomCombatAction    = addCustomCombatAction;
window.setCombatTurnNote        = setCombatTurnNote;
window.selectPlannerAction      = selectPlannerAction;
window.removePlannerSlot        = removePlannerSlot;
window.rollActionDice           = rollActionDice;
window.showActionDetail         = showActionDetail;
window.setParticipantHp         = setParticipantHp;
window.toggleParticipantCondition = toggleParticipantCondition;
window.applyGroupDamage         = applyGroupDamage;
window.applyAttackDamage        = applyAttackDamage;
window.toggleDemonicFormInCombat = toggleDemonicFormInCombat;
window.renderCombatLog          = renderCombatLog;
window.toggleLogEdit            = toggleLogEdit;
window.toggleLogAction          = toggleLogAction;
window.removeLogAction          = removeLogAction;
window.addLogCustomAction       = addLogCustomAction;
window.openCombatLogView        = openCombatLogView;
window.openCombatLogModal       = openCombatLogModal;
window.closeCombatLogModal      = closeCombatLogModal;
window.closeCombatLogView       = closeCombatLogView;
window.renderCombatLogView      = renderCombatLogView;
window.renderKillScoreboard     = renderKillScoreboard;

// Combat engine
window.nextCombatTurn          = nextCombatTurn;
window.showNextTurnWarning     = showNextTurnWarning;
window.confirmNextTurn         = confirmNextTurn;
window.dismissNextTurnWarning  = dismissNextTurnWarning;
window.skipSegundaAccion       = skipSegundaAccion;
window.skipExtraAttack         = skipExtraAttack;
window.previousCombatTurn      = previousCombatTurn;
window.confirmEndCombat        = confirmEndCombat;
window._doClearCombat          = _doClearCombat;
window.copyHistoryToClipboard  = copyHistoryToClipboard;
window.showCombatSummary       = showCombatSummary;

// Combat setup
window.showCombatSetup          = showCombatSetup;
window.showCombatMode           = showCombatMode;
window.goToCombatInitiative     = goToCombatInitiative;
window.beginCombat              = beginCombat;
window.beginCombatFromSetup     = beginCombatFromSetup;
window.toggleCombatParticipant  = toggleCombatParticipant;
window.renderSpecialSummonsSection = renderSpecialSummonsSection;
window.addSpecialSummonToSetup  = addSpecialSummonToSetup;
window.setSetupJugadorInitiative = setSetupJugadorInitiative;
window.switchCombatSetupTab     = switchCombatSetupTab;
window.addSetupNpc              = addSetupNpc;
window.renderSetupNpcList       = renderSetupNpcList;
window.removeSetupNpc           = removeSetupNpc;
window.setParticipantInitiative = setParticipantInitiative;
window._updateSetupCount        = _updateSetupCount;

// Combat NPCs
window.showQuickEnemyModal    = showQuickEnemyModal;
window.showQuickAllyModal     = showQuickAllyModal;
window.showQuickNpcModal      = showQuickNpcModal;
window._saveEntityTemplate    = _saveEntityTemplate;
window.toggleQeGroupFields    = toggleQeGroupFields;
window.toggleQeSummonFields   = toggleQeSummonFields;
window.toggleSetupGroupFields = toggleSetupGroupFields;
window.toggleSetupSummonFields = toggleSetupSummonFields;
window.addQeAction            = addQeAction;
window.submitQuickEnemy       = submitQuickEnemy;
window.submitQuickNpc         = submitQuickNpc;
window.showInvocationDetail   = showInvocationDetail;
window.addInvocationToCombat  = addInvocationToCombat;

// Summons
window.toggleSirvienteInvisible = toggleSirvienteInvisible;

// Online
window.showOnlineLobby          = showOnlineLobby;
window.startOnlineCombatSetup   = startOnlineCombatSetup;
window.startCombatSession       = startCombatSession;
window.updateWaitingRoom        = updateWaitingRoom;
window.startOnlineCombat        = startOnlineCombat;
window.showCurrentSessionCode   = showCurrentSessionCode;
window.renderCombatShareLink    = renderCombatShareLink;
window.joinOnlineSession        = joinOnlineSession;
window.clearOnlineSession       = clearOnlineSession;

// Expose roleState for modules that reference window.roleState
window.roleState = roleState;

// Proxy combatModeActive onto window for legacy references in sheet.js
Object.defineProperty(window, 'combatModeActive', {
    get: () => appFlags.combatModeActive,
    set: v  => { appFlags.combatModeActive = v; },
});

// ── Small landing-page UI helpers ─────────────────────────────────────────────

function toggleLandingMenu() {
    const dd = document.getElementById('landingDropdown');
    if (!dd) return;
    const isOpen = dd.style.display !== 'none';
    dd.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        setTimeout(() => document.addEventListener('click', closeLandingMenu, { once: true }), 10);
    }
}
window.toggleLandingMenu = toggleLandingMenu;

function closeLandingMenu() {
    const dd = document.getElementById('landingDropdown');
    if (dd) dd.style.display = 'none';
}
window.closeLandingMenu = closeLandingMenu;

function toggleMobileLog() {
    const logPanel = document.querySelector('.combat-log-panel');
    if (logPanel) logPanel.classList.toggle('mobile-visible');
}
window.toggleMobileLog = toggleMobileLog;

// ── Event Listeners ───────────────────────────────────────────────────────────

function setupEventListeners() {
    const btnHome = document.getElementById('btnHome');
    if (btnHome) btnHome.addEventListener('click', () => {
        mapState.history = [];
        appFlags.combatModeActive = false;
        clearSavedCombat();
        const sheet = document.getElementById('characterSheetContainer');
        if (sheet) sheet.style.display = 'none';
        const manager = document.getElementById('combatManagerSection');
        if (manager) manager.style.display = 'none';
        appFlags.isCharacterEditing = false;
        setView('landing');
    });

    const btnBack = document.getElementById('btnBack');
    if (btnBack) btnBack.addEventListener('click', navigateBack);

    document.getElementById('cardWorld')?.addEventListener('click', () => {
        if (mapState.currentMap) {
            renderMap();
            setView('map');
        } else {
            showNotification('No hay mapa inicial configurado', 3000);
        }
    });

    document.getElementById('cardCharacters')?.addEventListener('click', () => {
        appFlags.combatModeActive = false;
        setView('characters');
    });

    document.getElementById('cardCombatMode')?.addEventListener('click', showCombatSetup);

    // Zoom controls
    document.getElementById('btnZoomIn')?.addEventListener('click', () => adjustZoom(0.2));
    document.getElementById('btnZoomOut')?.addEventListener('click', () => adjustZoom(-0.2));

    // Editor controls
    document.getElementById('toggleEdit')?.addEventListener('click', toggleEditMode);
    document.getElementById('addMapBtn')?.addEventListener('click', showAddMapModal);
    document.getElementById('exportBtn')?.addEventListener('click', exportData);

    // Map interaction (Mouse)
    const container = document.getElementById('mapContainer');
    if (container) {
        container.addEventListener('mousedown', handleMapMouseDown);
        container.addEventListener('mousemove', handleMapMouseMove);
        container.addEventListener('mouseup', handleMapMouseUp);
        container.addEventListener('wheel', handleMapWheel);
        container.addEventListener('contextmenu', handleRightClick);
        container.addEventListener('touchstart', handleMapTouchStart, { passive: false });
        container.addEventListener('touchmove', handleMapTouchMove, { passive: false });
        container.addEventListener('touchend', handleMapTouchEnd);
    }

    setupModalListeners();
    setupCharacterSheetListeners();
}

function setupModalListeners() {
    document.getElementById('savePinBtn')?.addEventListener('click', savePin);
    document.getElementById('cancelPinBtn')?.addEventListener('click', () => {
        document.getElementById('pinModal').style.display = 'none';
        mapState.tempPin = null;
        mapState.editingPinIndex = null;
    });

    const sizeSlider = document.getElementById('pinSize');
    const sizeValue  = document.getElementById('pinSizeValue');
    sizeSlider?.addEventListener('input', e => {
        if (sizeValue) sizeValue.textContent = e.target.value;
    });

    document.getElementById('saveMapBtn')?.addEventListener('click', saveNewMap);
    document.getElementById('cancelMapBtn')?.addEventListener('click', () => {
        document.getElementById('mapModal').style.display = 'none';
    });
}

// ── Welcome screen ────────────────────────────────────────────────────────────

function showWelcomeScreen() {
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('loadDataBtn')?.addEventListener('click', () => {
        document.getElementById('dataFileInput')?.click();
    });

    document.getElementById('dataFileInput')?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    mapState.data = JSON.parse(event.target.result);
                    mapState.currentMap = mapState.data.mapa_inicial;
                    document.getElementById('welcomeScreen').style.display = 'none';
                    setupEventListeners();
                    renderMap();
                } catch (err) {
                    alert('Error al cargar el archivo: ' + err.message);
                }
            };
            reader.readAsText(file);
        }
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    try {
        if (window.initialGameData) {
            mapState.data = window.initialGameData;
        } else {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error('No data.json found');
            mapState.data = await response.json();
        }

        if (!mapState.data.mapa_inicial || Object.keys(mapState.data.mapas).length === 0) {
            showWelcomeScreen();
            return;
        }

        mapState.currentMap = mapState.data.mapa_inicial;
        loadStateFromStorage();
        renderCharacterSelectionMenu();
        setupEventListeners();
        setupDiceRoller();
        setupCombatOptionsMenu();
        setView('landing');
        updateTaskMd('Initialize');
        initRole();
        loadSavedCombatIfAny();
    } catch (error) {
        console.error('Error loading data:', error);
        showWelcomeScreen();
    }
}

init();
