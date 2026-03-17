/**
 * state.js — All shared mutable runtime state.
 *
 * Every object exported here is mutated in-place by other modules.
 * Primitive flags that need to change across modules are wrapped in objects
 * (appFlags, onlineFlags, etc.) so importers can mutate the property and all
 * other importers see the change.
 */

// ── Map / navigation state ────────────────────────────────────────────────────
export const mapState = {
    data:             null,   // Full data.json object
    currentMap:       null,   // Current map ID
    history:          [],     // Navigation history
    zoom:             1,
    pan:              { x: 0, y: 0 },
    isEditing:        false,
    isDragging:       false,
    dragStart:        { x: 0, y: 0 },
    tempPin:          null,
    editingPinIndex:  null,
    currentView:      'landing',
};

// ── Character sheet state ─────────────────────────────────────────────────────
export const hpState           = {};
export const spellSlotState    = {};
export const inspirationState  = {};
export const conditionsState   = {};
export const deathSaveState    = {};
export const notesState        = {};
export const diceHistory       = [];
export const demonicFormState  = {};
export const turnPlannerState  = {};

// ── Combat state ──────────────────────────────────────────────────────────────
export const combatState = {
    selectedIds:        [],
    participants:       [],
    currentIndex:       0,
    round:              1,
    isActive:           false,
    log:                [],
    nextLogId:          0,
    segundaAccionTurn:  false,
    extraAttackTurn:    false,
};

// ── Setup state (pre-combat) ──────────────────────────────────────────────────
export const setupState = {
    npcs:        [],   // mirrors setupNpcs
    initiatives: {},   // mirrors setupInitiatives
};

// ── Application flags ─────────────────────────────────────────────────────────
export const appFlags = {
    combatModeActive:    false,
    currentCharacterId:  null,
    isCharacterEditing:  false,
};

// ── Online / real-time sync flags ─────────────────────────────────────────────
export const onlineState = {
    activeCombatId: null,
    activeJoinCode: null,
    sseSource:      null,
    saveTimer:      null,
    isOnlineCombat: false,
};

// ── Role state ────────────────────────────────────────────────────────────────
export const roleState = {
    gameRole: { type: 'master', characterId: null },
};
