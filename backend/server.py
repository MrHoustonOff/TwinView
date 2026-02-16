import uuid
import io
import mimetypes
from flask import Flask, render_template, request, jsonify, send_file

server = Flask(__name__, 
               static_folder='../frontend/static',
               template_folder='../frontend/templates')

# Хранилище: { 'uuid': { 'filename': '...', 'data': bytes, 'active': True } }
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
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp')):
            continue

        file_id = str(uuid.uuid4())
        file_data = file.read()
        
        IMAGES_DB[file_id] = {
            'id': file_id,
            'filename': file.filename,
            'data': file_data,
            'active': True # По дефолту видно
        }
        uploaded_count += 1

    if uploaded_count == 0:
        return jsonify({'status': 'error', 'message': 'Ни один файл не является изображением'}), 400

    return jsonify({
        'status': 'success', 
        'count': uploaded_count
    })

@server.route('/images', methods=['GET'])
def get_images_list():
    """Возвращает список метаданных (без самих байтов)"""
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
    """Отдает сырые байты картинки по ID"""
    if file_id not in IMAGES_DB:
        return "Not found", 404
    
    img_entry = IMAGES_DB[file_id]
    img_io = io.BytesIO(img_entry['data'])
    
    # Определяем mime-type по имени файла
    mime_type, _ = mimetypes.guess_type(img_entry['filename'])
    if not mime_type:
        mime_type = 'application/octet-stream'
        
    return send_file(img_io, mimetype=mime_type)

@server.route('/toggle/<file_id>', methods=['POST'])
def toggle_image(file_id):
    """Переключает статус видимости"""
    if file_id in IMAGES_DB:
        IMAGES_DB[file_id]['active'] = not IMAGES_DB[file_id]['active']
        return jsonify({'status': 'success', 'active': IMAGES_DB[file_id]['active']})
    return jsonify({'status': 'error'}), 404

if __name__ == '__main__':
    server.run(debug=True, port=5000)