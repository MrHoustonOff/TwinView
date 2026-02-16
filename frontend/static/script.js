// --- SMART NOTIFICATION SYSTEM ---
const toastContainer = document.getElementById('toast-container');
const toastQueue = [];
let activeToasts = 0;
const MAX_VISIBLE_TOASTS = 6;
const TOAST_STAGGER_DELAY = 300; 

function showToast(message, type = 'default') {
    toastQueue.push({ message, type });
    processToastQueue();
}

function processToastQueue() {
    if (activeToasts >= MAX_VISIBLE_TOASTS || toastQueue.length === 0) {
        return;
    }

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

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        removeToast(toast);
    }, 4000); 
}

function removeToast(toast) {
    if (toast.classList.contains('removing')) return;
    
    // Запускаем CSS анимацию схлопывания
    toast.classList.add('removing'); 
    toast.classList.remove('show');

    // Ждем окончания CSS transition (0.4s), затем удаляем из DOM
    toast.addEventListener('transitionend', () => {
        // Проверка нужна, чтобы не срабатывало на каждый transition property
        if (toast.parentElement) {
            toast.remove();
            activeToasts--;
            setTimeout(processToastQueue, 100);
        }
    }, { once: true }); // Важно: once: true, чтобы событие не дублировалось
}

// --- DRAG & DROP UI LOGIC ---
const dragOverlay = document.getElementById('drag-overlay');
const mainTitle = document.querySelector('h1'); 
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dragOverlay.classList.add('active');
    if (mainTitle) mainTitle.classList.add('hidden');
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
        dragOverlay.classList.remove('active');
        if (mainTitle) mainTitle.classList.remove('hidden');
    }
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragOverlay.classList.remove('active');
    if (mainTitle) mainTitle.classList.remove('hidden');
    
    const files = e.dataTransfer.files;
    handleFiles(files);
});

// --- CLIPBOARD PASTE LOGIC ---
document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const files = [];
    
    for (let item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            files.push(blob);
        }
    }

    if (files.length > 0) {
        handleFiles(files);
    }
});

// --- SMART FILE HANDLING ---
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
        showToast('Файлы данного формата не поддерживаются.<br>Пожалуйста, используйте изображения.', 'error');
        return;
    }

    if (invalidCount > 0) {
        const fileWord = invalidCount === 1 ? 'файл' : 'файла';
        showToast(`Пропущено ${invalidCount} ${fileWord} (неверный формат).`, 'error');
    }

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast(`Успешно загружено: <b>${data.count}</b>`, 'success');
        } else {
            showToast(data.message || 'Ошибка обработки файлов', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Не удалось соединиться с сервером.', 'error');
    });
}