/**
 * maps/maps.js — Interactive map rendering, pin management, zoom/pan.
 */

import { mapState } from '../state.js';
import { showNotification } from '../ui/notifications.js';

// ── Touch state ───────────────────────────────────────────────────────────────
let lastTouchX = 0;
let lastTouchY = 0;

// ── Rendering ─────────────────────────────────────────────────────────────────
export function renderMap() {
    const mapData = mapState.data.mapas[mapState.currentMap];
    if (!mapData) { console.error('Map not found:', mapState.currentMap); return; }

    const mapImage = document.getElementById('mapImage');
    mapImage.src = mapData.imagen;
    mapImage.onerror = () => {
        mapImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect width="800" height="600" fill="%23151b2b"/%3E%3Ctext x="400" y="300" text-anchor="middle" fill="%23d4af37" font-size="20"%3EImagen no encontrada%3C/text%3E%3C/svg%3E';
    };
    updateBreadcrumbs();
    renderPins();
    resetView();
}

export function renderPins() {
    const pinsLayer = document.getElementById('pinsLayer');
    pinsLayer.innerHTML = '';
    const mapData = mapState.data.mapas[mapState.currentMap];
    if (!mapData.pines) return;
    mapData.pines.forEach((pin, index) => pinsLayer.appendChild(createPinElement(pin, index)));
}

export function createPinElement(pin, index) {
    const pinEl = document.createElement('div');
    pinEl.className = 'pin';
    pinEl.textContent = pin.nombre;
    pinEl.style.left = `${pin.x * 100}%`;
    pinEl.style.top  = `${pin.y * 100}%`;

    const size = pin.tamano || 1;
    pinEl.style.transform = `translate(-50%, -50%) scale(${size})`;
    pinEl.dataset.scale   = size;

    if (mapState.isEditing) {
        pinEl.classList.add('editing');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'pin-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Eliminar pin';
        deleteBtn.addEventListener('click', e => { e.stopPropagation(); deletePin(index); });
        pinEl.appendChild(deleteBtn);
        pinEl.addEventListener('dblclick', e => { e.stopPropagation(); editPin(index); });
        makePinDraggable(pinEl, index);
    } else {
        const handlePinClick = e => { e.stopPropagation(); navigateToMap(pin.destino); };
        pinEl.addEventListener('click', handlePinClick);
        pinEl.addEventListener('touchstart', handlePinClick, { passive: true });
    }
    return pinEl;
}

export function makePinDraggable(pinEl, pinIndex) {
    let isDragging = false;

    pinEl.addEventListener('mousedown', e => {
        if (!mapState.isEditing) return;
        e.stopPropagation();
        isDragging = true;
        pinEl.style.cursor = 'grabbing';
    });

    pinEl.addEventListener('touchstart', e => {
        if (!mapState.isEditing) return;
        e.stopPropagation();
        isDragging = true;
    }, { passive: false });

    document.addEventListener('mousemove', e => { if (isDragging) movePin(e.clientX, e.clientY); });
    document.addEventListener('touchmove', e => {
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        movePin(touch.clientX, touch.clientY);
    }, { passive: false });

    function movePin(clientX, clientY) {
        const rect = document.getElementById('mapImage').getBoundingClientRect();
        pinEl.style.left = `${((clientX - rect.left) / rect.width) * 100}%`;
        pinEl.style.top  = `${((clientY - rect.top)  / rect.height) * 100}%`;
    }

    const stopDragging = () => {
        if (!isDragging) return;
        isDragging = false;
        pinEl.style.cursor = 'move';
        const rect    = document.getElementById('mapImage').getBoundingClientRect();
        const pinRect = pinEl.getBoundingClientRect();
        mapState.data.mapas[mapState.currentMap].pines[pinIndex].x = (pinRect.left + pinRect.width  / 2 - rect.left) / rect.width;
        mapState.data.mapas[mapState.currentMap].pines[pinIndex].y = (pinRect.top  + pinRect.height / 2 - rect.top)  / rect.height;
    };
    document.addEventListener('mouseup',  stopDragging);
    document.addEventListener('touchend', stopDragging);
}

// ── Navigation ────────────────────────────────────────────────────────────────
export function navigateToMap(mapId) {
    if (!mapState.data.mapas[mapId]) { console.error('Map not found:', mapId); return; }
    mapState.history.push(mapState.currentMap);
    mapState.currentMap = mapId;
    renderMap();
}

export function navigateBack() {
    const { combatModeActive, appFlags } = window.__dndState || {};
    const view = mapState.currentView;

    if (window.combatModeActive) {
        if (view === 'combatManager') return;
        else if (view === 'combatInit')  window.showCombatSetup();
        else if (view === 'combatSetup') { window.combatModeActive = false; window.setView('landing'); }
        return;
    }
    if (mapState.history.length === 0) return;
    mapState.currentMap = mapState.history.pop();
    renderMap();
}

export function updateBreadcrumbs() {
    const breadcrumbs = document.getElementById('breadcrumbs');
    const btnBack     = document.getElementById('btnBack');
    const path = [...mapState.history, mapState.currentMap];
    breadcrumbs.textContent = path.join(' → ');
    if (btnBack) btnBack.style.display = mapState.history.length > 0 ? 'flex' : 'none';
}

// ── Zoom & Pan ────────────────────────────────────────────────────────────────
export function adjustZoom(delta) {
    mapState.zoom = Math.max(0.5, Math.min(3, mapState.zoom + delta));
    applyTransform();
}

export function resetView() {
    mapState.zoom = 1;
    mapState.pan  = { x: 0, y: 0 };
    applyTransform();
}

export function applyTransform() {
    const canvas = document.getElementById('mapCanvas');
    canvas.style.transform = `translate(${mapState.pan.x}px, ${mapState.pan.y}px) scale(${mapState.zoom})`;
}

// ── Mouse / Touch event handlers ──────────────────────────────────────────────
export function handleMapWheel(e) {
    e.preventDefault();
    adjustZoom(e.deltaY > 0 ? -0.1 : 0.1);
}

export function handleMapMouseDown(e) {
    if (e.button !== 0 || mapState.isEditing) return;
    mapState.isDragging = true;
    mapState.dragStart  = { x: e.clientX - mapState.pan.x, y: e.clientY - mapState.pan.y };
    document.getElementById('mapContainer').classList.add('grabbing');
}

export function handleMapMouseMove(e) {
    if (!mapState.isDragging) return;
    mapState.pan.x = e.clientX - mapState.dragStart.x;
    mapState.pan.y = e.clientY - mapState.dragStart.y;
    applyTransform();
}

export function handleMapMouseUp() {
    mapState.isDragging = false;
    document.getElementById('mapContainer').classList.remove('grabbing');
}

export function handleMapTouchStart(e) {
    if (mapState.isEditing) return;
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        mapState.isDragging = true;
    }
}

export function handleMapTouchMove(e) {
    if (!mapState.isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    mapState.pan.x += touch.clientX - lastTouchX;
    mapState.pan.y += touch.clientY - lastTouchY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
    applyTransform();
}

export function handleMapTouchEnd() {
    mapState.isDragging = false;
    document.getElementById('mapContainer').classList.remove('grabbing');
}

// ── Edit mode ─────────────────────────────────────────────────────────────────
export function toggleEditMode() {
    mapState.isEditing = !mapState.isEditing;
    const toggleBtn = document.getElementById('toggleEdit');
    const addMapBtn = document.getElementById('addMapBtn');
    const exportBtn = document.getElementById('exportBtn');
    const mapContainer = document.getElementById('mapContainer');

    if (mapState.isEditing) {
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = '<span class="icon">✓</span> Modo Vista';
        addMapBtn.style.display = 'flex';
        exportBtn.style.display = 'flex';
        mapContainer.classList.add('edit-mode');
        showNotification('Clic derecho para crear pin • Doble clic en un pin para editarlo', 4000);
    } else {
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = '<span class="icon">✎</span> Modo Edición';
        addMapBtn.style.display = 'none';
        exportBtn.style.display = 'none';
        mapContainer.classList.remove('edit-mode');
    }
    renderPins();
}

export function handleRightClick(e) {
    if (!mapState.isEditing) return;
    e.preventDefault();
    const rect = document.getElementById('mapImage').getBoundingClientRect();
    mapState.tempPin = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top)  / rect.height,
    };
    showAddPinModal();
}

// ── Pin CRUD ──────────────────────────────────────────────────────────────────
export function showAddPinModal() {
    const modal      = document.getElementById('pinModal');
    const modalTitle = document.getElementById('pinModalTitle');
    const select     = document.getElementById('pinDestination');

    if (mapState.editingPinIndex !== null) {
        modalTitle.textContent = 'Editar Pin';
        const pin = mapState.data.mapas[mapState.currentMap].pines[mapState.editingPinIndex];
        document.getElementById('pinName').value = pin.nombre;
        document.getElementById('pinSize').value = pin.tamano || 1.0;
        document.getElementById('pinSizeValue').textContent = pin.tamano || 1.0;
        select.innerHTML = '<option value="">-- Seleccionar mapa --</option>';
        for (const mapId in mapState.data.mapas) {
            const option = document.createElement('option');
            option.value = mapId; option.textContent = mapId;
            if (mapId === pin.destino) option.selected = true;
            select.appendChild(option);
        }
    } else {
        modalTitle.textContent = 'Nuevo Pin';
        document.getElementById('pinName').value = '';
        document.getElementById('pinSize').value = 1.0;
        document.getElementById('pinSizeValue').textContent = '1.0';
        select.innerHTML = '<option value="">-- Seleccionar mapa --</option>';
        for (const mapId in mapState.data.mapas) {
            const option = document.createElement('option');
            option.value = mapId; option.textContent = mapId;
            select.appendChild(option);
        }
    }
    modal.style.display = 'flex';
    document.getElementById('pinName').focus();
}

export function savePin() {
    const nombre = document.getElementById('pinName').value.trim();
    const destino = document.getElementById('pinDestination').value;
    const tamano  = parseFloat(document.getElementById('pinSize').value);
    if (!nombre || !destino) { alert('Por favor completa todos los campos'); return; }

    if (mapState.editingPinIndex !== null) {
        Object.assign(mapState.data.mapas[mapState.currentMap].pines[mapState.editingPinIndex], { nombre, destino, tamano });
        mapState.editingPinIndex = null;
        showNotification('Pin actualizado correctamente', 2000);
    } else {
        if (!mapState.data.mapas[mapState.currentMap].pines) mapState.data.mapas[mapState.currentMap].pines = [];
        mapState.data.mapas[mapState.currentMap].pines.push({ x: mapState.tempPin.x, y: mapState.tempPin.y, nombre, destino, tamano });
        mapState.tempPin = null;
        showNotification('Pin creado correctamente', 2000);
    }
    document.getElementById('pinModal').style.display = 'none';
    renderPins();
}

export function deletePin(pinIndex) {
    const pinName = mapState.data.mapas[mapState.currentMap].pines[pinIndex].nombre;
    if (confirm(`¿Eliminar el pin "${pinName}"?`)) {
        mapState.data.mapas[mapState.currentMap].pines.splice(pinIndex, 1);
        renderPins();
    }
}

export function editPin(pinIndex) {
    mapState.editingPinIndex = pinIndex;
    showAddPinModal();
}

export function showAddMapModal() {
    document.getElementById('mapModal').style.display = 'flex';
    document.getElementById('mapId').value = '';
    document.getElementById('mapImagePath').value = '';
    document.getElementById('mapId').focus();
}

export function saveNewMap() {
    const mapId     = document.getElementById('mapId').value.trim();
    const imageName = document.getElementById('mapImagePath').value.trim();
    if (!mapId || !imageName) { alert('Por favor completa todos los campos'); return; }
    if (mapState.data.mapas[mapId]) { alert('Ya existe un mapa con ese ID'); return; }
    mapState.data.mapas[mapId] = { imagen: `assets/imagenes/${imageName}`, pines: [] };
    document.getElementById('mapModal').style.display = 'none';
    showNotification(`Mapa "${mapId}" creado correctamente`, 2000);
}

export function exportData() {
    const dataStr = 'window.initialGameData = ' + JSON.stringify(mapState.data, null, 4) + ';';
    const url = URL.createObjectURL(new Blob([dataStr], { type: 'text/javascript' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'data.js';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Datos exportados como data.js. Reemplaza el archivo existente en la carpeta del proyecto.');
}
