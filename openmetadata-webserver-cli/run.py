import os
from webserver import app

# app = Flask(__name__, static_folder=os.path.join(os.getcwd(), 'ui/dist/assets'), static_url_path='')

if __name__ == "__main__":
    app.run(port=8001, debug=True)
