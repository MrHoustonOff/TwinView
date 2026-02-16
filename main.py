import webview
from backend.server import server
import sys
import os

# Фикс для корректной работы путей при сборке (на будущее) и запуске
if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'templates')
    static_folder = os.path.join(sys._MEIPASS, 'static')
    server.template_folder = template_folder
    server.static_folder = static_folder

if __name__ == '__main__':
    # Создаем окно. Передаем server (наш Flask app) напрямую.
    window = webview.create_window(
        'TwinView', 
        server,
        width=1200,
        height=800,
        background_color='#121212' # Чтобы не было белой вспышки при запуске
    )
    
    # Запуск цикла событий
    webview.start(debug=True)