from flask import Flask, render_template

server = Flask(__name__, 
               static_folder='../frontend/static',
               template_folder='../frontend/templates')

@server.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    server.run(debug=True)