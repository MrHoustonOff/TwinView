const sceneListEl = document.getElementById('scene-list');
const viewportGridEl = document.getElementById('viewport-grid'); // НОВЫЙ ЭЛЕМЕНТ
const toastContainer = document.getElementById('toast-container');
const dragOverlay = document.getElementById('drag-overlay');
const btnClean = document.getElementById('btn-clean');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    updateSceneList();
});

// --- CORE LOGIC ---
function updateSceneList() {
    fetch('/images')
        .then(res => res.json())
        .then(data => {
            const images = data.images; // Получаем список
            renderList(images);         // Рисуем сайдбар
            updateViewport(images);     // Рисуем центр (НОВОЕ)
        })
        .catch(err => console.error('Error fetching images:', err));
}

// Рендер сайдбара (как и был)
function renderList(images) {
    sceneListEl.innerHTML = ''; 
    const sortedImages = [...images].reverse(); // Копия массива для реверса

    sortedImages.forEach(img => {
        const item = document.createElement('div');
        item.className = 'scene-item';
        
        item.innerHTML = `
            <img src="/thumbnail/${img.id}" class="thumb" alt="thumb">
            <div class="file-info">
                <div class="filename" title="${img.filename}">${img.filename}</div>
            </div>
            <label class="switch">
                <input type="checkbox" ${img.active ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        `;

        const toggle = item.querySelector('input');
        toggle.addEventListener('change', (e) => {
            toggleImageState(img.id, e.target.checked);
        });

        sceneListEl.appendChild(item);
    });
}

// Рендер Вьюпорта (НОВАЯ ФУНКЦИЯ)
function updateViewport(images) {
    viewportGridEl.innerHTML = '';

    // Фильтруем: показываем только active
    const activeImages = images.filter(img => img.active);

    if (activeImages.length === 0) {
        // Если ничего не выбрано, показываем заглушку
        viewportGridEl.innerHTML = '<div style="color: #444; margin: auto;">No active images</div>';
        viewportGridEl.style.display = 'flex'; // Чтобы заглушка была по центру
        return;
    } else {
        viewportGridEl.style.display = 'grid'; // Возвращаем грид
    }

    activeImages.forEach(img => {
        const card = document.createElement('div');
        card.className = 'vp-image-card';
        
        // ВАЖНО: Во вьюпорте грузим ОРИГИНАЛ (/image/), чтобы видеть детали
        card.innerHTML = `
            <img src="/image/${img.id}" alt="${img.filename}">
            <div class="vp-image-label">${img.filename}</div>
        `;
        
        viewportGridEl.appendChild(card);
    });
}

function toggleImageState(id, isActive) {
    fetch(`/toggle/${id}`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            // После переключения просто обновляем всё состояние
            // Это самый надежный способ синхронизации
            updateSceneList(); 
        });
}

// --- CLEANUP LOGIC (DELETE INACTIVE) ---
if (btnClean) {
    btnClean.addEventListener('click', () => {
        fetch('/delete_deactivated', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.count > 0) {
                    showToast(`Удалено файлов: <b>${data.count}</b>`, 'success');
                    updateSceneList(); // Перерисовываем список
                } else {
                    showToast('Нет отключенных изображений', 'default');
                }
            })
            .catch(err => {
                console.error(err);
                showToast('Ошибка при удалении', 'error');
            });
    });
}

// --- SMART TOAST SYSTEM ---
const toastQueue = [];
let activeToasts = 0;
const MAX_VISIBLE_TOASTS = 8;
const TOAST_STAGGER_DELAY = 300; 

function showToast(message, type = 'default') {
    toastQueue.push({ message, type });
    processToastQueue();
}

function processToastQueue() {
    if (activeToasts >= MAX_VISIBLE_TOASTS || toastQueue.length === 0) return;

    const { message, type } = toastQueue.shift();
    activeToasts++;

    createToastElement(message, type);

    if (toastQueue.length > 0 && activeToasts < MAX_VISIBLE_TOASTS) {
        setTimeout(processToastQueue, TOAST_STAGGER_DELAY);
    }
}

function createToastElement(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message; 
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => removeToast(toast), 4000); 
}

function removeToast(toast) {
    if (toast.classList.contains('removing')) return;
    
    toast.classList.add('removing'); 
    toast.classList.remove('show');

    toast.addEventListener('transitionend', () => {
        if (toast.parentElement) {
            toast.remove();
            activeToasts--;
            setTimeout(processToastQueue, 100);
        }
    }, { once: true });
}

// --- DRAG & DROP UI LOGIC ---
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dragOverlay.classList.add('active');
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
        dragOverlay.classList.remove('active');
    }
});

document.addEventListener('dragover', (e) => { e.preventDefault(); });

document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragOverlay.classList.remove('active');
    
    const files = e.dataTransfer.files;
    handleFiles(files);
});

// --- PASTE LOGIC ---
document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const files = [];
    for (let item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            files.push(item.getAsFile());
        }
    }
    if (files.length > 0) handleFiles(files);
});

// --- FILE HANDLING ---
function handleFiles(fileList) {
    const formData = new FormData();
    const files = Array.from(fileList);
    if (files.length === 0) return;

    let imageCount = 0;
    let invalidCount = 0;

    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            formData.append('files[]', file);
            imageCount++;
        } else {
            invalidCount++;
        }
    });

    if (imageCount === 0) {
        showToast('Файлы данного формата не поддерживаются', 'error');
        return;
    }
    if (invalidCount > 0) {
        showToast(`Пропущено файлов: ${invalidCount}`, 'error');
    }

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast(`Загружено: <b>${data.count}</b>`, 'success');
            updateSceneList(); // Обновляем список после успешной загрузки
        } else {
            showToast(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Ошибка соединения', 'error');
    });
}