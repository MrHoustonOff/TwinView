// --- ЭЛЕМЕНТЫ ---
const sceneListEl = document.getElementById('scene-list');
const dragOverlay = document.getElementById('drag-overlay');
const toastContainer = document.getElementById('toast-container');
const btnAllInactive = document.getElementById('btn-all-inactive');
const syncCheck = document.getElementById('sync-check');

if (syncCheck) {
    syncCheck.addEventListener('change', (e) => {
        AppState.setSync(e.target.checked);
    });
}
if (btnAllInactive) {
    btnAllInactive.onclick = () => {
        console.log("Deactivating all...");
        
        // Фильтруем только те, что сейчас активны
        const toDisable = AppState.images.filter(img => img.active);
        
        if (toDisable.length === 0) return;

        // Шлем запросы на сервер
        const promises = toDisable.map(img => 
            fetch(`/toggle/${img.id}`, { method: 'POST' })
        );

        Promise.all(promises).then(() => {
            fetchImages(); // Обновляем всё состояние
            showToast("All slots cleared", "default");
        });
    };
}
// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Sidebar Controller Ready");
    fetchImages();
    setupSidebarListeners();
});

function setupSidebarListeners() {
    // Gap Slider
    const gapSlider = document.getElementById('gap-slider');
    if (gapSlider) {
        gapSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            document.getElementById('gap-value').innerText = `${val}px`;
            AppState.setGap(val);
        });
    }

    // Highlight Checkbox
    const highlightCheck = document.getElementById('highlight-check');
    if (highlightCheck) {
        highlightCheck.addEventListener('change', (e) => {
            AppState.setHighlight(e.target.checked);
        });
    }

    // Режимы раскладки
    document.querySelectorAll('.btn-submode').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-submode').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AppState.setSubMode(btn.dataset.submode);
        });
    });

    // Очистка неактивных
    const btnClean = document.getElementById('btn-clean');
    if (btnClean) {
        btnClean.addEventListener('click', () => {
            fetch('/delete_deactivated', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    showToast(`Удалено: ${data.count}`);
                    fetchImages();
                });
        });
    }
}

// --- СИНХРОНИЗАЦИЯ ДАННЫХ ---
function fetchImages() {
    fetch('/images')
        .then(res => res.json())
        .then(data => {
            // Проверяем, существует ли AppState, прежде чем пушить данные
            if (typeof AppState !== 'undefined') {
                AppState.setImages(data.images);
                renderSidebarList(data.images);
            } else {
                // Если вдруг state еще не готов, пробуем через 100мс
                setTimeout(fetchImages, 100);
            }
        });
}

function renderSidebarList(images) {
    if (!sceneListEl) return;
    sceneListEl.innerHTML = ''; 
    [...images].reverse().forEach(img => {
        const item = document.createElement('div');
        item.className = 'scene-item';
        item.innerHTML = `
            <img src="/thumbnail/${img.id}" class="thumb">
            <div class="file-info"><div class="filename">${img.filename}</div></div>
            <label class="switch">
                <input type="checkbox" ${img.active ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        `;
        const toggle = item.querySelector('input');
        toggle.addEventListener('change', () => {
            fetch(`/toggle/${img.id}`, { method: 'POST' }).then(fetchImages);
        });
        sceneListEl.appendChild(item);
    });
}

// --- DRAG & DROP & PASTE ---
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragOverlay) dragOverlay.classList.add('active');
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0 && dragOverlay) dragOverlay.classList.remove('active');
});

document.addEventListener('dragover', (e) => e.preventDefault());

document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (dragOverlay) dragOverlay.classList.remove('active');
    handleFiles(e.dataTransfer.files);
});

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

function handleFiles(fileList) {
    const formData = new FormData();
    const files = Array.from(fileList);
    let count = 0;
    files.forEach(f => {
        if (f.type.startsWith('image/')) {
            formData.append('files[]', f);
            count++;
        }
    });

    if (count === 0) return;

    fetch('/upload', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            showToast(`Загружено: ${data.count}`, 'success');
            fetchImages();
        });
}

// --- TOASTS ---
function showToast(msg, type = 'default') {
    if (!toastContainer) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = msg;
    toastContainer.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
        t.classList.remove('show');
        t.addEventListener('transitionend', () => t.remove());
    }, 3000);
}

// Добавь обработку кнопок MULTI / SINGLE
document.querySelectorAll('.btn-mode').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const subContainer = document.getElementById('submode-container');
        if (btn.dataset.mode === 'single') {
            subContainer.classList.add('hidden');
        } else {
            subContainer.classList.remove('hidden');
        }
        
        AppState.setViewMode(btn.dataset.mode);
    });
});