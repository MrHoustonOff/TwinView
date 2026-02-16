// --- NOTIFICATION SYSTEM ---
const toastContainer = document.getElementById('toast-container');

function showToast(message, type = 'default') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    
    // Добавляем в конец списка (они будут выстраиваться сверху вниз)
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 3000);
}

// --- DRAG & DROP LOGIC ---
const dragOverlay = document.getElementById('drag-overlay');
// Находим заголовок, чтобы прятать его
const mainTitle = document.querySelector('h1'); 

let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dragOverlay.classList.add('active');
    
    // TWEAK 1: Прячем заголовок
    if (mainTitle) mainTitle.classList.add('hidden');
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
        dragOverlay.classList.remove('active');
        
        // TWEAK 1: Возвращаем заголовок
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
    // Возвращаем заголовок при дропе
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

// --- UPLOAD HANDLER ---
function handleFiles(fileList) {
    const formData = new FormData();
    let imageCount = 0;
    let hasNonImage = false;

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
        showToast('Только изображения!', 'error');
    }

    if (imageCount === 0) {
        showToast('Ошибка: нет изображений', 'error');
        return;
    }

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast(`Загружено: ${data.count}`, 'success');
        } else {
            showToast(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Ошибка соединения', 'error');
    });
}