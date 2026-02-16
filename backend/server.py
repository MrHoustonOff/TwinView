import uuid
import io
import mimetypes
from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image  # НОВАЯ ЗАВИСИМОСТЬ

server = Flask(__name__, 
               static_folder='../frontend/static',
               template_folder='../frontend/templates')

# Хранилище: { 'uuid': { 'filename': '...', 'data': bytes, 'thumb': bytes, 'active': True } }
IMAGES_DB = {}

@server.route('/')
def index():
    return render_template('index.html')

# --- API ---

@server.route('/upload', methods=['POST'])
def upload_file():
    if 'files[]' not in request.files:
        return jsonify({'status': 'error', 'message': 'Нет файлов'}), 400
    
    files = request.files.getlist('files[]')
    uploaded_count = 0
    
    for file in files:
        if file.filename == '': continue
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tga', '.tiff')):
            continue

        file_id = str(uuid.uuid4())
        file_data = file.read()
        
        # --- ГЕНЕРАЦИЯ МИНИАТЮРЫ ---
        try:
            # Открываем из байтов
            img = Image.open(io.BytesIO(file_data))
            
            # Конвертируем в RGB если это CMYK или RGBA (для JPEG сохранения)
            if img.mode in ('RGBA', 'P'): 
                img = img.convert('RGBA')
            
            # Делаем тамбнейл (макс 128x128)
            img.thumbnail((128, 128))
            
            # Сохраняем миниатюру в байты
            thumb_io = io.BytesIO()
            # Сохраняем как PNG для поддержки прозрачности или JPEG для скорости
            # Используем PNG для универсальности иконок
            img.save(thumb_io, format='PNG', optimize=True)
            thumb_data = thumb_io.getvalue()
            
        except Exception as e:
            print(f"Error creating thumbnail for {file.filename}: {e}")
            # Если сломалось создание миниатюры, используем оригинал (fallback)
            thumb_data = file_data

        IMAGES_DB[file_id] = {
            'id': file_id,
            'filename': file.filename,
            'data': file_data,      # ОРИГИНАЛ (Heavy)
            'thumb': thumb_data,    # МИНИАТЮРА (Light)
            'active': True
        }
        uploaded_count += 1

    if uploaded_count == 0:
        return jsonify({'status': 'error', 'message': 'Ни один файл не загружен'}), 400

    return jsonify({
        'status': 'success', 
        'count': uploaded_count
    })

@server.route('/images', methods=['GET'])
def get_images_list():
    images_list = []
    for img_id, img_data in IMAGES_DB.items():
        images_list.append({
            'id': img_id,
            'filename': img_data['filename'],
            'active': img_data['active']
        })
    return jsonify({'images': images_list})

@server.route('/image/<file_id>')
def get_image(file_id):
    """Отдает ОРИГИНАЛ (для вьюпорта)"""
    if file_id not in IMAGES_DB: return "Not found", 404
    
    img_entry = IMAGES_DB[file_id]
    img_io = io.BytesIO(img_entry['data'])
    
    mime_type, _ = mimetypes.guess_type(img_entry['filename'])
    if not mime_type: mime_type = 'application/octet-stream'
        
    return send_file(img_io, mimetype=mime_type)

@server.route('/thumbnail/<file_id>')
def get_thumbnail(file_id):
    """Отдает МИНИАТЮРУ (для сайдбара)"""
    if file_id not in IMAGES_DB: return "Not found", 404
    
    img_entry = IMAGES_DB[file_id]
    # Берем подготовленные маленькие данные
    img_io = io.BytesIO(img_entry['thumb'])
    
    return send_file(img_io, mimetype='image/png')

@server.route('/toggle/<file_id>', methods=['POST'])
def toggle_image(file_id):
    if file_id in IMAGES_DB:
        IMAGES_DB[file_id]['active'] = not IMAGES_DB[file_id]['active']
        return jsonify({'status': 'success', 'active': IMAGES_DB[file_id]['active']})
    return jsonify({'status': 'error'}), 404

@server.route('/delete_deactivated', methods=['POST'])
def delete_deactivated():
    deleted_count = 0
    for img_id in list(IMAGES_DB.keys()):
        if not IMAGES_DB[img_id]['active']:
            del IMAGES_DB[img_id]
            deleted_count += 1
            
    return jsonify({'status': 'success', 'count': deleted_count})

if __name__ == '__main__':
    server.run(debug=True, port=5000)