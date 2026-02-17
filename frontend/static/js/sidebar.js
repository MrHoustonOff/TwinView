// --- ЭЛЕМЕНТЫ ---
const sceneListEl = document.getElementById('scene-list');
const dragOverlay = document.getElementById('drag-overlay');
const toastContainer = document.getElementById('toast-container');
const btnAllInactive = document.getElementById('btn-all-inactive');
const syncCheck = document.getElementById('sync-check');

// --- ЛОГИКА СИНХРОНИЗАЦИИ ---
if (syncCheck) {
    syncCheck.addEventListener('change', (e) => {
        if (AppState.viewMode === 'single') {
            e.target.checked = true;
            AppState.setSync(true);
            return;
        }
        AppState.setSync(e.target.checked);
    });
}

// --- КНОПКА ОТКЛЮЧИТЬ ВСЕ (CLEAR ALL) ---
if (btnAllInactive) {
    btnAllInactive.onclick = () => {
        const toDisable = AppState.images.filter(img => img.active);
        if (toDisable.length === 0) {
            showToast("No active selection", "default");
            return;
        }
        
        // Оптимистичное обновление UI
        toDisable.forEach(img => {
            const toggle = document.querySelector(`.scene-item[data-id="${img.id}"] input`);
            if (toggle) toggle.checked = false;
        });

        const promises = toDisable.map(img => 
            fetch(`/toggle/${img.id}`, { method: 'POST' })
        );
        
        Promise.all(promises)
            .then(() => {
                fetchImages(); 
                showToast("Workspace cleared", "success");
            })
            .catch(err => {
                console.error(err);
                showToast("Cleanup failed", "error");
                fetchImages(); // Откат состояния
            });
    };
}

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Sidebar Controller Ready");
    
    const highlightCheck = document.getElementById('highlight-check');
    if (highlightCheck) {
        highlightCheck.checked = AppState.showHighlight;
        AppState.setHighlight(AppState.showHighlight);
    }

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

    // Submode Buttons
    document.querySelectorAll('.btn-submode').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-submode').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AppState.setSubMode(btn.dataset.submode);
        });
    });

    // Clean Inactive Button
    const btnClean = document.getElementById('btn-clean');
    if (btnClean) {
        btnClean.addEventListener('click', () => {
            fetch('/delete_deactivated', { method: 'POST' })
                .then(res => {
                    if (!res.ok) throw new Error('Server error');
                    return res.json();
                })
                .then(data => {
                    if (data.count > 0) {
                        showToast(`Purged ${data.count} inactive assets`, "success");
                    } else {
                        showToast("No inactive assets found", "default");
                    }
                    fetchImages();
                })
                .catch(err => {
                    showToast("Purge action failed", "error");
                });
        });
    }

    // Sliders & Slicing Controls
    const btnAddSlider = document.getElementById('btn-add-slider');
    if (btnAddSlider) btnAddSlider.onclick = () => AppState.addSlider();
    
    const btnSubSlider = document.getElementById('btn-sub-slider');
    if (btnSubSlider) btnSubSlider.onclick = () => AppState.removeSlider();
    
    const sliceSelect = document.getElementById('select-slice-mode');
    if (sliceSelect) sliceSelect.onchange = (e) => AppState.setSlicingMode(e.target.value);
    
    const labelsCheck = document.getElementById('slice-labels-check');
    if (labelsCheck) {
        labelsCheck.onchange = (e) => {
            AppState.setSliceLabels(e.target.checked);
            if (typeof renderViewport === 'function') renderViewport(AppState);
        };
    }

    // Mode Switcher (Multi / Single)
    document.querySelectorAll('.btn-mode').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const mode = btn.dataset.mode;
            const subContainer = document.getElementById('submode-container');
            const singleControls = document.getElementById('single-controls');
            const syncCheck = document.getElementById('sync-check');

            if (syncCheck) syncCheck.checked = true;
            AppState.setSync(true);

            if (mode === 'single') {
                if (subContainer) subContainer.classList.add('hidden');
                if (singleControls) {
                    singleControls.classList.remove('hidden');
                    const countLabel = document.getElementById('slider-count');
                    if (countLabel) countLabel.innerText = AppState.sliders.length;
                }
            } else {
                if (subContainer) subContainer.classList.remove('hidden');
                if (singleControls) singleControls.classList.add('hidden');
            }
            
            AppState.setViewMode(mode);
        });
    });
}

function fetchImages() {
    fetch('/images')
        .then(res => res.json())
        .then(data => {
            if (typeof AppState !== 'undefined') {
                AppState.setImages(data.images);
                renderSidebarList(data.images);
            } else {
                setTimeout(fetchImages, 100);
            }
        })
        .catch(err => {
            console.error("Failed to fetch images:", err);
            // Можно добавить тост, если сеть отвалилась совсем, но лучше не спамить
        });
}

// --- SMART RENDER (Без мигания и без кнопок удаления) ---
function renderSidebarList(images) {
    if (!sceneListEl) return;

    const imagesMap = new Map(images.map(img => [String(img.id), img]));
    
    // 1. Удаляем лишнее
    Array.from(sceneListEl.children).forEach(item => {
        if (!imagesMap.has(item.dataset.id)) {
            item.remove();
        }
    });

    // 2. Создаем или обновляем
    const reversedImages = [...images].reverse();
    
    reversedImages.forEach((img, index) => {
        let item = sceneListEl.querySelector(`.scene-item[data-id="${img.id}"]`);

        // Создаем, если нет
        if (!item) {
            item = document.createElement('div');
            item.className = 'scene-item';
            item.dataset.id = img.id;
            // ВАЖНО: Никакой кнопки удаления, только свитч
            item.innerHTML = `
                <img src="/thumbnail/${img.id}" class="thumb">
                <div class="file-info"><div class="filename">${img.filename}</div></div>
                <label class="switch">
                    <input type="checkbox">
                    <span class="slider"></span>
                </label>
            `;
            
            const toggle = item.querySelector('input');
            toggle.addEventListener('change', () => {
                fetch(`/toggle/${img.id}`, { method: 'POST' })
                    .then(() => fetchImages())
                    .catch(() => {
                        showToast("Error yopta", "error");
                        toggle.checked = !toggle.checked; // Возвращаем свитч обратно
                    });
            });
        }

        // Обновляем состояние свитча
        const checkbox = item.querySelector('input');
        if (checkbox && checkbox.checked !== img.active) {
            checkbox.checked = img.active;
        }

        // Поддерживаем порядок
        if (sceneListEl.children[index] !== item) {
             if (index < sceneListEl.children.length) {
                sceneListEl.insertBefore(item, sceneListEl.children[index]);
             } else {
                sceneListEl.appendChild(item);
             }
        }
    });
}

// --- DRAG & DROP & PASTE ---
let dragCounter = 0;
document.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; if (dragOverlay) dragOverlay.classList.add('active'); });
document.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter === 0 && dragOverlay) dragOverlay.classList.remove('active'); });
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

    if (count === 0) {
        // Если пользователь кинул txt или pdf
        showToast("Unsupported media type", "error");
        return;
    }

    fetch('/upload', { method: 'POST', body: formData })
        .then(res => {
            if (!res.ok) throw new Error('Upload failed');
            return res.json();
        })
        .then(data => {
            showToast(`Imported files ${data.count}`, 'success');
            fetchImages();
        })
        .catch(err => {
            console.error(err);
            showToast("Upload error", "error");
        });
}

function showToast(msg, type = 'default') {
    if (!toastContainer) return;
    
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = msg;
    
    toastContainer.prepend(t);
    
    requestAnimationFrame(() => {
        t.classList.add('show');
    });
    
    setTimeout(() => {
        t.classList.remove('show');
        t.addEventListener('transitionend', () => t.remove());
    }, 3000);
}

// --- SUBSCRIPTIONS ---
AppState.subscribe((event, state) => {
    if (event === 'highlight' || event === 'sliders') {
        if (typeof renderViewport === 'function') renderViewport(state);
    }
    if (event === 'sliders') {
        const countLabel = document.getElementById('slider-count');
        if (countLabel) countLabel.innerText = state.sliders.length;
    }
    if (event === 'viewMode') {
        const singleCtrl = document.getElementById('single-controls');
        const multiSub = document.getElementById('submode-container');
        if (state.viewMode === 'single') {
            if (singleCtrl) singleCtrl.classList.remove('hidden');
            if (multiSub) multiSub.classList.add('hidden');
        } else {
            if (singleCtrl) singleCtrl.classList.add('hidden');
            if (multiSub) multiSub.classList.remove('hidden');
        }
        if (typeof renderViewport === 'function') renderViewport(state);
    }
});