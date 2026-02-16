// --- SMART NOTIFICATION SYSTEM ---
const toastContainer = document.getElementById('toast-container');
const toastQueue = [];
let activeToasts = 0;
const MAX_VISIBLE_TOASTS = 2;
const TOAST_STAGGER_DELAY = 300; // 0.3s задержка между появлениями

/**
 * Добавляет уведомление в очередь.
 */
function showToast(message, type = 'default') {
    toastQueue.push({ message, type });
    processToastQueue();
}

/**
 * Обрабатывает очередь и показывает уведомления, если есть слоты.
 */
function processToastQueue() {
    if (activeToasts >= MAX_VISIBLE_TOASTS || toastQueue.length === 0) {
        return;
    }

    const { message, type } = toastQueue.shift();
    activeToasts++;

    createToastElement(message, type);

    // Если в очереди есть еще сообщения и есть свободные слоты,
    // запускаем следующее с небольшой задержкой для красоты
    if (toastQueue.length > 0 && activeToasts < MAX_VISIBLE_TOASTS) {
        setTimeout(processToastQueue, TOAST_STAGGER_DELAY);
    }
}

function createToastElement(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Используем innerHTML, чтобы можно было выделять жирным (например, числа)
    toast.innerHTML = message; 

    toastContainer.appendChild(toast);

    // Анимация появления
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Таймер жизни уведомления
    setTimeout(() => {
        removeToast(toast);
    }, 4000); // Чуть увеличили время чтения до 4 сек
}

function removeToast(toast) {
    // Если уже удаляется, игнорируем
    if (toast.classList.contains('removing')) return;
    
    toast.classList.add('removing'); // Класс для анимации исчезновения (опционально)
    toast.classList.remove('show');

    toast.addEventListener('transitionend', () => {
        toast.remove();
        activeToasts--;
        // После удаления пробуем показать следующее из очереди
        // Небольшая пауза, чтобы не "стреляло" мгновенно на место старого
        setTimeout(processToastQueue, 200);
    });
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

    // Сценарий 1: Пользователь скинул только мусор
    if (imageCount === 0) {
        showToast('Файлы данного формата не поддерживаются.<br>Пожалуйста, используйте изображения.', 'error');
        return;
    }

    // Сценарий 2: Смешанный контент (Картинки + Мусор)
    // Сначала предупреждаем о мусоре, потом грузим картинки
    if (invalidCount > 0) {
        const fileWord = invalidCount === 1 ? 'файл' : 'файла';
        showToast(`Пропущено ${invalidCount} ${fileWord} (неверный формат).`, 'error');
    }

    // Отправка валидных изображений
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Красивое сообщение с жирным шрифтом для числа
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