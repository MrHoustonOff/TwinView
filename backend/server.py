import uuid
from flask import Flask, render_template, request, jsonify

server = Flask(__name__, 
               static_folder='../frontend/static',
               template_folder='../frontend/templates')

# Хранилище в памяти (очищается при перезапуске)
# Структура: { 'id': 'uuid', 'filename': 'name.jpg', 'data': binary_data }
IMAGES_DB = {}

@server.route('/')
def index():
    return render_template('index.html')

@server.route('/upload', methods=['POST'])
def upload_file():
    if 'files[]' not in request.files:
        return jsonify({'status': 'error', 'message': 'Нет файлов для загрузки'}), 400
    
    files = request.files.getlist('files[]')
    uploaded_count = 0
    
    for file in files:
        if file.filename == '':
            continue
            
        # Простейшая валидация расширений на бэке
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp')):
            continue

        file_id = str(uuid.uuid4())
        # Читаем байты в память
        file_data = file.read()
        
        IMAGES_DB[file_id] = {
            'id': file_id,
            'filename': file.filename,
            'data': file_data # Храним сырые байты пока что
        }
        uploaded_count += 1

    if uploaded_count == 0:
        return jsonify({'status': 'error', 'message': 'Ни один файл не является изображением'}), 400

    return jsonify({
        'status': 'success', 
        'message': f'Загружено изображений: {uploaded_count}',
        'count': uploaded_count
    })

if __name__ == '__main__':
    server.run(debug=True, port=5000)