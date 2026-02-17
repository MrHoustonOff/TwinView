window.AppState = {
    images: [],
    gap: 5,
    showHighlight: true,
    subMode: 'row',
    viewMode: 'multi',
    sliders: [],
    slicingMode: 'vertical',
    showSliceLabels: true,
    currentIndex: 0,
    isSynchronized: true,
    globalCamera: { x: 0, y: 0, zoom: 1 },
    individualCameras: {},
    listeners: [],
    rainbow: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e0baff'],

    addSlider() {
        const activeCount = this.images.filter(img => img.active).length;
        if (this.sliders.length < activeCount - 1) {
            const count = this.sliders.length;
            const newVal = count === 0 ? 50 : Math.min(this.sliders[count - 1].pos + 10, 98);
            this.sliders.push({ pos: newVal, color: this.rainbow[count % this.rainbow.length] });
            this.sliders.sort((a, b) => a.pos - b.pos);
            this.notify('sliders');
        }
    },
    removeSlider() {
        if (this.sliders.length > 0) {
            this.sliders.pop();
            this.notify('sliders');
        }
    },
    updateSlider(index, val) {
        const min = index > 0 ? this.sliders[index - 1].pos + 1 : 0;
        const max = index < this.sliders.length - 1 ? this.sliders[index + 1].pos - 1 : 100;
        this.sliders[index].pos = Math.min(Math.max(val, min), max);
        this.notify('sliders');
    },
    setImages(newImages) {
        this.images = newImages;
        const activeImages = this.images.filter(img => img.active);
        const activeCount = activeImages.length;

        // 1. Умное удаление слайдеров
        let changed = false;
        while (this.sliders.length > 0 && this.sliders.length >= activeCount) {
            this.sliders.pop();
            changed = true;
        }
        if (changed) this.notify('sliders');

        // 2. ФИКС ЧЕРНОГО ЭКРАНА
        if (activeCount > 0) {
            if (this.currentIndex >= activeCount) {
                this.currentIndex = 0;
                this.notify('index');
            }
        } else {
            this.currentIndex = 0;
            this.notify('index');
        }

        this.notify('images');
    },
    setViewMode(val) {
        this.viewMode = val;
        // Если заходим в Single — принудительно врубаем синхрон
        if (val === 'single') {
            this.isSynchronized = true;
        }
        this.notify('viewMode');
        this.notify('camera');
    },
    setGap(val) { this.gap = parseInt(val, 10); this.notify('gap'); },
    setSubMode(val) { this.subMode = val; this.notify('subMode'); },
    setHighlight(val) {
        this.showHighlight = val;
        this.notify('highlight');
    },
    setSync(val) {
        this.isSynchronized = val;
        if (this.isSynchronized) {
            Object.keys(this.individualCameras).forEach(id => {
                this.individualCameras[id] = { ...this.globalCamera };
            });
        }
        this.notify('camera');
    },
    updateCamera(x, y, zoom, id) {
        if (this.isSynchronized) {
            this.globalCamera = { x, y, zoom };
        } else if (id) {
            this.individualCameras[id] = { x, y, zoom };
        }
        this.notify('camera');
    },
    subscribe(callback) { this.listeners.push(callback); },
    notify(event) {
        console.log(`State Event: ${event}`);
        this.listeners.forEach(cb => cb(event, this));
    },
    resetCamera() {
        if (this.isSynchronized) {
            this.globalCamera = { x: 0, y: 0, zoom: 1 };
        } else {
            Object.keys(this.individualCameras).forEach(id => {
                this.individualCameras[id] = { x: 0, y: 0, zoom: 1 };
            });
        }
        this.notify('camera');
    },
    setSliceLabels(val) {
        this.showSliceLabels = val;
        this.notify('sliders');
    },
    setSlicingMode(val) { this.slicingMode = val; this.notify('sliders'); },
    setSliceGap(val) { /* метод-заглушка */ },

    // --- ИСПРАВЛЕННАЯ НАВИГАЦИЯ (КОЛЬЦО) ---
    nextImage() {
        const active = this.images.filter(img => img.active);
        if (active.length === 0) return;
        // Убрали проверку на sliders.length, чтобы работало всегда
        this.currentIndex = (this.currentIndex + 1) % active.length;
        this.notify('index');
        // Уведомляем слайдеры, чтобы перерисовались лейблы и слои
        if (this.sliders.length > 0) this.notify('sliders'); 
    },
    prevImage() {
        const active = this.images.filter(img => img.active);
        if (active.length === 0) return;
        // Убрали проверку на sliders.length
        this.currentIndex = (this.currentIndex - 1 + active.length) % active.length;
        this.notify('index');
        if (this.sliders.length > 0) this.notify('sliders');
    }
};

console.log("AppState defined on window.");