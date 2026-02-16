// --- NOTIFICATION SYSTEM ---
const toastContainer = document.getElementById('toast-container');

function showToast(message, type = 'default') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    
    toastContainer.appendChild(toast);

    // Trigger reflow для анимации
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Удаление через 3 секунды
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 3000);
}

// --- DRAG & DROP LOGIC ---
const dragOverlay = document.getElementById('drag-overlay');
let dragCounter = 0; // Счетчик, чтобы не мигал оверлей при наведении на детей

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

document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragOverlay.classList.remove('active');
    
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
    } else {
        // Если в буфере нет картинок
        // showToast('В буфере обмена нет изображений', 'error'); 
        // Пока молчим, чтобы не бесить при копировании текста, 
        // но можно раскомментировать, если нужно строгое поведение.
    }
});

// --- UPLOAD HANDLER ---
function handleFiles(fileList) {
    const formData = new FormData();
    let imageCount = 0;
    let hasNonImage = false;

    // Превращаем FileList или Array в массив для перебора
    const files = Array.from(fileList);

    if (files.length === 0) return;

    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            formData.append('files[]', file);
            imageCount++;
        } else {
            hasNonImage = true;
        }
    });

    if (hasNonImage) {
        showToast('Некоторые файлы не являются изображениями', 'error');
    }

    if (imageCount === 0) {
        showToast('Ошибка: нет изображений для загрузки', 'error');
        return;
    }

    // Отправка на сервер
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast(`Успешно загружено: ${data.count}`, 'success');
            console.log('Server response:', data);
        } else {
            showToast(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Ошибка соединения с сервером', 'error');
    });
}