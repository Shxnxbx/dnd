/**
 * ui/router.js — View management: shows/hides top-level page sections.
 */

import { mapState } from '../state.js';

export function currentView() { return mapState.currentView; }

export function setView(viewName) {
    mapState.currentView = viewName;

    // Body class for map-specific styles
    document.body.classList.remove('view-map');
    if (viewName === 'map') document.body.classList.add('view-map');

    // Hide all sections
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('mapContainer').style.display = 'none';
    document.getElementById('characterSection').style.display = 'none';
    document.getElementById('combatSetupSection').style.display = 'none';
    document.getElementById('combatInitSection').style.display = 'none';
    document.getElementById('combatManagerSection').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'none';

    const onlineLobby   = document.getElementById('onlineLobbyView');
    const onlineWaiting = document.getElementById('onlineWaitingView');
    const combatLogViewEl = document.getElementById('combatLogView');
    if (onlineLobby)     onlineLobby.style.display   = 'none';
    if (onlineWaiting)   onlineWaiting.style.display = 'none';
    if (combatLogViewEl) combatLogViewEl.style.display = 'none';

    const sheetContainer = document.getElementById('characterSheetContainer');
    if (sheetContainer) sheetContainer.style.display = 'none';

    const editorToolbar = document.getElementById('editorToolbar');
    const hud           = document.getElementById('hud');
    const diceWidget    = document.getElementById('diceRollerWidget');

    window.scrollTo(0, 0);

    switch (viewName) {
        case 'landing':
            document.getElementById('landingPage').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud)           hud.style.display           = 'none';
            if (diceWidget)    diceWidget.style.display    = 'none';
            break;
        case 'map':
            document.getElementById('mapContainer').style.display = 'block';
            if (editorToolbar) editorToolbar.style.display = 'flex';
            if (hud)           hud.style.display           = 'flex';
            if (diceWidget)    diceWidget.style.display    = 'flex';
            break;
        case 'characters':
            document.getElementById('characterSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud)           hud.style.display           = 'flex';
            if (diceWidget)    diceWidget.style.display    = 'flex';
            break;
        case 'combatSetup':
            document.getElementById('combatSetupSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud)           hud.style.display           = 'flex';
            if (diceWidget)    diceWidget.style.display    = 'none';
            document.getElementById('breadcrumbs').textContent = '⚔️ Combate › Configuración';
            document.getElementById('btnBack').style.display   = 'flex';
            break;
        case 'combatInit':
            document.getElementById('combatInitSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud)           hud.style.display           = 'flex';
            if (diceWidget)    diceWidget.style.display    = 'none';
            document.getElementById('breadcrumbs').textContent = '⚔️ Combate › Iniciativa';
            document.getElementById('btnBack').style.display   = 'flex';
            break;
        case 'combatManager':
            document.getElementById('combatManagerSection').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud)           hud.style.display           = 'none';
            if (diceWidget)    diceWidget.style.display    = 'none';
            break;
        case 'onlineLobby':
            document.getElementById('onlineLobbyView').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud)           hud.style.display           = 'flex';
            if (diceWidget)    diceWidget.style.display    = 'none';
            document.getElementById('breadcrumbs').textContent = '🌐 Combate en Línea';
            document.getElementById('btnBack').style.display   = 'flex';
            break;
        case 'onlineWaiting':
            document.getElementById('onlineWaitingView').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud)           hud.style.display           = 'flex';
            if (diceWidget)    diceWidget.style.display    = 'none';
            document.getElementById('breadcrumbs').textContent = '🌐 Sala de espera';
            document.getElementById('btnBack').style.display   = 'flex';
            break;
        case 'combatLogView':
            document.getElementById('combatLogView').style.display = 'flex';
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (hud)           hud.style.display           = 'none';
            if (diceWidget)    diceWidget.style.display    = 'none';
            break;
    }
}
