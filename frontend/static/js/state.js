window.AppState = {
    images: [],
    gap: 5,
    showHighlight: false,
    subMode: 'row',
    isSynchronized: true,
    globalCamera: { x: 0, y: 0, zoom: 1 },
    individualCameras: {},
    listeners: [],
    currentIndex: 0,

    setImages(newImages) {
        this.images = newImages;
        // Сбрасываем индекс при изменении пачки изображений
        if (this.currentIndex >= newImages.length) this.currentIndex = 0;
        
        newImages.forEach(img => {
            if (!this.individualCameras[img.id]) {
                this.individualCameras[img.id] = { x: 0, y: 0, zoom: 1 };
            }
        });
        this.notify('images');
    },

    nextImage() {
        const active = this.images.filter(img => img.active);
        if (active.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % active.length;
        this.notify('index');
    },

    prevImage() {
        const active = this.images.filter(img => img.active);
        if (active.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + active.length) % active.length;
        this.notify('index');
    },

    setViewMode(val) {
        this.viewMode = val;
        this.notify('viewMode');
    },

    setGap(val) { this.gap = parseInt(val, 10); this.notify('gap'); },
    setSubMode(val) { this.subMode = val; this.notify('subMode'); },
    setHighlight(val) { this.showHighlight = val; this.notify('highlight'); },
    setSync(val) { this.isSynchronized = val; this.notify('camera'); },
    
    updateCamera(x, y, zoom, imgId = null) {
        if (this.isSynchronized) {
            this.globalCamera = { x, y, zoom };
        } else if (imgId) {
            this.individualCameras[imgId] = { x, y, zoom };
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
        // Сбрасываем все индивидуальные камеры
        Object.keys(this.individualCameras).forEach(id => {
            this.individualCameras[id] = { x: 0, y: 0, zoom: 1 };
        });
    }
    this.notify('camera');
},
};

console.log("AppState defined on window.");