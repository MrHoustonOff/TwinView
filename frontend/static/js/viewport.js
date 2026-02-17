const viewportContainer = document.getElementById('viewport-container');
const placeholderText = document.getElementById('placeholder-text');

let isDragging = false;
let startMousePos = { x: 0, y: 0 };
let startCamPos = { x: 0, y: 0 };
let activeSlotId = null;

function initViewport() {
    if (!window.AppState) { setTimeout(initViewport, 50); return; }

    window.addEventListener('keydown', (e) => {
        // Проверяем, не находимся ли мы в поле ввода, чтобы не блокировать стрелки там
        if (e.target.tagName === 'INPUT') return; 

        if (e.code === 'Space') { e.preventDefault(); AppState.resetCamera(); }
        if (e.code === 'ArrowRight') AppState.nextImage();
        if (e.code === 'ArrowLeft') AppState.prevImage();
    });
    
    AppState.subscribe((event, state) => {
        const redrawEvents = ['images', 'subMode', 'gap', 'viewMode', 'index', 'sliders', 'highlight'];
        
        if (redrawEvents.includes(event)) {
            renderViewport(state);
        }
        
        if (event === 'camera') applyCamera(state);
    });
    renderViewport(AppState);
}

function applyCamera(state) {
    const slots = document.querySelectorAll('.viewport-slot');
    slots.forEach(slot => {
        const img = slot.querySelector('img');
        const imgId = slot.dataset.id;
        const cam = state.isSynchronized ? state.globalCamera : state.individualCameras[imgId];
        if (img && cam) {
            img.style.transform = `translate(calc(-50% + ${cam.x}px), calc(-50% + ${cam.y}px)) scale(${cam.zoom})`;
        }
    });
}

function renderViewport(state) {
    const vContainer = document.getElementById('viewport-container');
    const hints = document.getElementById('nav-hints-group');
    const fileBubble = document.getElementById('file-info-bubble');
    const nameLabel = document.getElementById('current-filename');

    if (!vContainer) return;

    const activeImages = state.images.filter(img => img.active);

    if (activeImages.length === 0) {
        vContainer.innerHTML = '';
        placeholderText?.classList.remove('hidden');
        fileBubble?.classList.add('hidden');
        hints?.classList.add('hidden');
        return;
    }

    placeholderText?.classList.add('hidden');
    vContainer.innerHTML = '';
    
    vContainer.style.display = 'block'; 
    vContainer.style.position = 'relative';
    vContainer.style.width = '100%';
    vContainer.style.height = '100%';

    let containerClasses = ['viewport-container'];
    containerClasses.push(state.viewMode === 'single' ? 'mode-single' : `mode-${state.subMode}`);
    if (state.showHighlight) containerClasses.push('highlight-enabled');
    
    vContainer.className = containerClasses.join(' ');

    if (state.viewMode === 'single') {
        // --- SINGLE MODE ---
        if (state.sliders.length > 0) {
            fileBubble?.classList.add('hidden');
            hints?.classList.add('hidden');
        } else {
            fileBubble?.classList.remove('hidden');
            hints?.classList.remove('hidden');
        }

        const layersCount = state.sliders.length > 0 ? Math.min(state.sliders.length + 1, activeImages.length) : 1;

        for (let i = 0; i < layersCount; i++) {
            // ФИКС ЦИКЛА: Используем вычитание (- i), чтобы брать ПРЕДЫДУЩИЕ картинки.
            // + activeImages.length нужно, чтобы не уйти в минус.
            const imgIndex = (state.currentIndex - i + activeImages.length * 100) % activeImages.length;
            const imgData = activeImages[imgIndex];
            
            if (!imgData) continue;

            const slot = document.createElement('div');
            slot.className = 'viewport-slot slice-layer';
            slot.dataset.id = imgData.id;
            
            slot.style.position = 'absolute';
            slot.style.top = '0'; slot.style.left = '0'; slot.style.right = '0'; slot.style.bottom = '0';
            slot.style.zIndex = 100 - i;

            const start = i === 0 ? 0 : state.sliders[i - 1].pos;
            const end = i >= state.sliders.length ? 100 : state.sliders[i].pos;
            
            if (state.slicingMode === 'vertical') {
                slot.style.clipPath = `inset(0 ${100 - end}% 0 ${start}%)`;
            } else {
                slot.style.clipPath = `inset(${start}% 0 ${100 - end}% 0)`;
            }

            slot.innerHTML = `<img src="/image/${imgData.id}" draggable="false">`;
            
            // Лейблы
            if (state.showSliceLabels === true) {
                const label = document.createElement('div');
                label.className = 'slice-label';
                label.innerText = imgData.filename;

                if (state.sliders.length === 0) {
                    label.classList.add('centered-label');
                } else if (i === 0) {
                    const firstSliderPos = state.sliders[0].pos;
                    if (state.slicingMode === 'vertical') {
                        label.style.right = `${100 - firstSliderPos + 2}%`;
                        label.style.left = 'auto';
                        label.style.top = '20px';
                    } else {
                        label.style.bottom = `${100 - firstSliderPos + 3}%`;
                        label.style.top = 'auto';
                        label.style.left = '20px';
                    }
                } else {
                    if (state.slicingMode === 'vertical') {
                        label.style.left = `${start + 0.5}%`;
                        label.style.top = '65px';
                    } else {
                        label.style.top = `${start + 0.5}%`;
                        label.style.left = '65px';
                    }
                }
                slot.appendChild(label);
            }
            vContainer.appendChild(slot);
        }

        if (state.sliders.length > 0) renderMarkers(state, vContainer);
        if (nameLabel) nameLabel.innerText = activeImages[state.currentIndex]?.filename || "";

    } else {
        // --- MULTI MODE ---
        vContainer.style.display = (state.subMode === 'grid') ? 'grid' : 'flex';
        vContainer.className = `viewport-container mode-${state.subMode}` + (state.showHighlight ? ' highlight-enabled' : '');
        vContainer.style.gap = `${state.gap}px`;
        
        if (state.subMode === 'grid') {
            const count = activeImages.length;
            const W = vContainer.clientWidth || window.innerWidth;
            const H = vContainer.clientHeight || window.innerHeight;
            const gap = state.gap;

            // Умный расчет сетки (Smart Grid)
            let bestCols = Math.ceil(Math.sqrt(count));
            let maxTileArea = 0;

            for (let cols = 1; cols <= count; cols++) {
                const rows = Math.ceil(count / cols);
                const availableW = (W - (cols - 1) * gap) / cols;
                const availableH = (H - (rows - 1) * gap) / rows;
                const size = Math.min(availableW, availableH);
                
                if (size > maxTileArea) {
                    maxTileArea = size;
                    bestCols = cols;
                }
            }

            vContainer.style.gridTemplateColumns = `repeat(${bestCols}, 1fr)`;
            const totalCells = Math.ceil(count / bestCols) * bestCols;

            for (let i = 0; i < totalCells; i++) {
                if (i < activeImages.length) {
                    renderSlot(activeImages[i], vContainer);
                } else {
                    renderSlot(null, vContainer);
                }
            }
        } else {
            vContainer.style.flexDirection = state.subMode === 'col' ? 'column' : 'row';
            activeImages.forEach(img => renderSlot(img, vContainer));
        }
    }
    applyCamera(state);
}

function renderMarkers(state, container) {
    state.sliders.forEach((s, index) => {
        const marker = document.createElement('div');
        marker.className = 'slice-marker';
        marker.style.background = `rgba(255, 255, 255, 0.25)`;
        marker.style.backdropFilter = 'blur(12px)';
        marker.style.borderColor = s.color;
        marker.style.color = s.color;
        marker.innerHTML = `<span>${index + 1}</span>`;
        
        if (state.slicingMode === 'vertical') {
            marker.style.left = `${s.pos}%`;
            marker.style.top = '20px';
            marker.style.cursor = 'ew-resize';
        } else {
            marker.style.top = `${s.pos}%`;
            marker.style.left = '20px';
            marker.style.cursor = 'ns-resize';
            marker.style.transform = 'translate(0, -50%)';
        }

        marker.onmousedown = (e) => {
            e.stopPropagation();
            const rect = container.getBoundingClientRect();
            const onMove = (me) => {
                let val = state.slicingMode === 'vertical' 
                    ? ((me.clientX - rect.left) / rect.width) * 100
                    : ((me.clientY - rect.top) / rect.height) * 100;
                AppState.updateSlider(index, val);
            };
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        };
        container.appendChild(marker);
    });
}

function renderSlot(imgData, container) {
    const slot = document.createElement('div');
    slot.className = 'viewport-slot';
    if (imgData) {
        slot.dataset.id = imgData.id;
        slot.innerHTML = `<img src="/image/${imgData.id}" draggable="false">`;
        // Важно: обновляем активный слот при наведении
        slot.onmouseenter = () => { activeSlotId = imgData.id; };
    } else {
        slot.classList.add('empty-logo');
        slot.innerHTML = `<span>TWINVIEW</span>`;
    }
    container.appendChild(slot);
}

// Мышь для PAN
viewportContainer.onmousedown = (e) => {
    if (e.target.classList.contains('slice-marker')) return;
    isDragging = true;
    startMousePos = { x: e.clientX, y: e.clientY };
    const cam = AppState.isSynchronized ? AppState.globalCamera : AppState.individualCameras[activeSlotId];
    if (cam) startCamPos = { x: cam.x, y: cam.y };
};

window.onmousemove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startMousePos.x;
    const dy = e.clientY - startMousePos.y;
    const useGlobal = AppState.isSynchronized || AppState.viewMode === 'single';
    
    const cam = useGlobal 
        ? AppState.globalCamera 
        : (AppState.individualCameras[activeSlotId] || AppState.globalCamera);

    if (cam) {
        AppState.updateCamera(
            startCamPos.x + dx, 
            startCamPos.y + dy, 
            cam.zoom, 
            useGlobal ? null : activeSlotId
        );
    }
};

window.onmouseup = () => { isDragging = false; };

// --- ФИКС ЗУМА В ПОЗИЦИЮ КУРСОРА ---
viewportContainer.onwheel = (e) => {
    e.preventDefault();

    // 1. Определяем, над каким слотом мышка
    let targetSlot = null;
    if (activeSlotId) {
        targetSlot = viewportContainer.querySelector(`.viewport-slot[data-id="${activeSlotId}"]`);
    }
    
    // Если слота нет (зумим в пустоту или баг), берем весь контейнер, но лучше слот
    const rect = targetSlot ? targetSlot.getBoundingClientRect() : viewportContainer.getBoundingClientRect();

    // 2. Считаем offset мыши относительно ЦЕНТРА ЭТОГО СЛОТА
    // (Потому что transform-origin у нас визуально в центре слота)
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    const useGlobal = AppState.isSynchronized || AppState.viewMode === 'single';
    const cam = useGlobal 
        ? AppState.globalCamera 
        : (AppState.individualCameras[activeSlotId] || AppState.globalCamera);

    if (!cam) return;

    // Экспоненциальный зум (умножение)
    const zoomFactor = 1.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    let newZoom = direction > 0 ? cam.zoom * zoomFactor : cam.zoom / zoomFactor;
    newZoom = Math.min(Math.max(newZoom, 0.05), 50);

    // 3. Компенсация сдвига (чтобы точка под мышкой осталась на месте)
    // NewPos = MouseOffset - (MouseOffset - OldPos) * (NewZoom / OldZoom)
    const scaleChange = newZoom / cam.zoom;
    const newX = offsetX - (offsetX - cam.x) * scaleChange;
    const newY = offsetY - (offsetY - cam.y) * scaleChange;

    AppState.updateCamera(newX, newY, newZoom, useGlobal ? null : activeSlotId);
};

initViewport();