const viewportContainer = document.getElementById('viewport-container');
const placeholderText = document.getElementById('placeholder-text');

let isDragging = false;
let startMousePos = { x: 0, y: 0 };
let startCamPos = { x: 0, y: 0 };
let activeSlotId = null;

/**
 * Инициализация вьюпорта: ожидание AppState и подписка на события
 */
function initViewport() {
    if (!window.AppState) {
        console.log("Viewport: Waiting for AppState...");
        setTimeout(initViewport, 50);
        return;
    }

    console.log("Viewport: Initializing...");

    // 1. Глобальные горячие клавиши
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault(); 
            AppState.resetCamera();
        }
        if (e.code === 'ArrowRight') AppState.nextImage();
        if (e.code === 'ArrowLeft') AppState.prevImage();
    });

    // 2. Подписка на изменения состояния через AppState
    AppState.subscribe((event, state) => {
        // Перерисовка при изменении состава фото, режима или зазоров
        if (event === 'images' || event === 'subMode' || event === 'gap' || event === 'viewMode' || event === 'index') {
            renderViewport(state);
        }
        
        // Применение трансформаций камеры
        if (event === 'camera') applyCamera(state);
        
        // Переключение визуальной подсветки активного окна
        if (event === 'highlight') {
            if (viewportContainer) viewportContainer.classList.toggle('highlight-enabled', state.showHighlight);
        }
        
        // Обновление индикатора синхронизации в нижнем хелпере
        if (event === 'camera' || event === 'images') {
            const syncStatus = document.getElementById('sync-status');
            if (syncStatus) {
                syncStatus.innerHTML = `<b>Sync</b> ${state.isSynchronized ? 'On' : 'Off'}`;
            }
        }
    });
    
    // Первичный запуск отрисовки
    renderViewport(AppState);
}

/**
 * Расчет и применение CSS трансформаций для каждой картинки
 */
function applyCamera(state) {
    const slots = document.querySelectorAll('.viewport-slot:not(.empty-logo)');
    slots.forEach(slot => {
        const img = slot.querySelector('img');
        const imgId = slot.dataset.id;
        
        // Выбираем камеру: общую или индивидуальную для этого слота
        const cam = state.isSynchronized ? state.globalCamera : state.individualCameras[imgId];
        
        if (img && cam) {
            // translate(-50%, -50%) нужен для центрирования картинки относительно центра слота
            img.style.transform = `translate(calc(-50% + ${cam.x}px), calc(-50% + ${cam.y}px)) scale(${cam.zoom})`;
        }
    });
}

/**
 * Основная функция рендеринга структуры вьюпорта
 */
function renderViewport(state) {
    // 1. Ищем элементы ПРЯМО ЗДЕСЬ, чтобы избежать ошибок инициализации
    const vContainer = document.getElementById('viewport-container');
    const hints = document.getElementById('nav-hints-group');
    const fileBubble = document.getElementById('file-info-bubble');
    const nameLabel = document.getElementById('current-filename');

    if (!vContainer) return;

    const activeImages = state.images.filter(img => img.active);

    // 2. Если нет активных фото — всё прячем и показываем заставку
    if (activeImages.length === 0) {
        vContainer.innerHTML = '';
        placeholderText?.classList.remove('hidden');
        fileBubble?.classList.add('hidden');
        hints?.classList.add('hidden');
        return;
    }
    
    // Если фото есть — убираем заставку
    placeholderText?.classList.add('hidden');
    vContainer.innerHTML = '';

    // 3. ЖЕСТКИЙ СБРОС стилей (лечит баг наплыва сетки из режима G в Single)
    vContainer.style.display = ''; 
    vContainer.style.gridTemplateColumns = '';
    vContainer.style.gridTemplateRows = '';
    vContainer.style.gap = `${state.gap}px`;

    // 4. ЛОГИКА ОТОБРАЖЕНИЯ
    if (state.viewMode === 'single') {
        // --- РЕЖИМ SINGLE ---
        fileBubble?.classList.remove('hidden');
        hints?.classList.remove('hidden'); // Показываем стрелки в нижнем хелпере
        
        vContainer.className = 'viewport-container mode-single';
        vContainer.style.display = 'flex'; 
        
        const currentImg = activeImages[state.currentIndex];
        if (nameLabel && currentImg) {
            nameLabel.innerText = currentImg.filename;
        }

        // Создаем один активный слот
        if (currentImg) {
            const slot = document.createElement('div');
            slot.className = 'viewport-slot';
            slot.dataset.id = currentImg.id;
            slot.innerHTML = `<img src="/image/${currentImg.id}" draggable="false">`;
            slot.onmouseenter = () => { activeSlotId = currentImg.id; };
            vContainer.appendChild(slot);
        }
        
    } else {
        // --- РЕЖИМ MULTI ---
        fileBubble?.classList.add('hidden');
        hints?.classList.add('hidden'); // Прячем стрелки в нижнем хелпере
        
        vContainer.className = `viewport-container mode-${state.subMode} ${state.showHighlight ? 'highlight-enabled' : ''}`;

        if (state.subMode === 'grid') {
            // Матрица (Grid)
            const n = activeImages.length;
            const side = Math.ceil(Math.sqrt(n));
            vContainer.style.display = 'grid';
            vContainer.style.gridTemplateColumns = `repeat(${side}, 1fr)`;
            vContainer.style.gridTemplateRows = `repeat(${side}, 1fr)`;
            
            for (let i = 0; i < side * side; i++) {
                renderSlot(activeImages[i]);
            }
        } else {
            // Ряд (H) или Колонка (V)
            vContainer.style.display = 'flex';
            vContainer.style.flexDirection = (state.subMode === 'col') ? 'column' : 'row';
            activeImages.forEach(img => renderSlot(img));
        }
    }
    
    /**
     * Внутренняя функция для отрисовки стандартного слота
     */
    function renderSlot(imgData) {
        const slot = document.createElement('div');
        slot.className = 'viewport-slot';
        if (imgData) {
            slot.dataset.id = imgData.id;
            slot.innerHTML = `<img src="/image/${imgData.id}" draggable="false">`;
            slot.onmouseenter = () => { activeSlotId = imgData.id; };
        } else {
            // Пустая ячейка для завершения квадрата в Grid
            slot.classList.add('empty-logo');
            slot.innerHTML = `<span>TWINVIEW</span>`;
        }
        vContainer.appendChild(slot);
    }
    
    // В конце всегда применяем текущую камеру
    applyCamera(state);
}

// --- ОБРАБОТКА МЫШИ (PAN & ZOOM) ---

if (viewportContainer) {
    viewportContainer.onmousedown = (e) => {
        isDragging = true;
        startMousePos = { x: e.clientX, y: e.clientY };
        const cam = AppState.isSynchronized ? AppState.globalCamera : AppState.individualCameras[activeSlotId];
        if (cam) startCamPos = { x: cam.x, y: cam.y };
    };

    window.onmousemove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startMousePos.x;
        const dy = e.clientY - startMousePos.y;
        
        const cam = AppState.isSynchronized ? AppState.globalCamera : AppState.individualCameras[activeSlotId];
        if (cam) {
            AppState.updateCamera(startCamPos.x + dx, startCamPos.y + dy, cam.zoom, activeSlotId);
        }
    };

    window.onmouseup = () => { isDragging = false; };

    viewportContainer.onwheel = (e) => {
        e.preventDefault();
        const cam = AppState.isSynchronized ? AppState.globalCamera : AppState.individualCameras[activeSlotId];
        if (!cam) return;

        const zoomSpeed = 0.05;
        const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        const newZoom = Math.min(Math.max(cam.zoom + delta, 0.05), 20);
        
        AppState.updateCamera(cam.x, cam.y, newZoom, activeSlotId);
    };
}

// Запуск процесса
initViewport();