from flask import Flask
from flask_cors import CORS
from routes.auth         import auth_bp
from routes.patients     import patients_bp
from routes.appointments import appointments_bp
from routes.ai           import ai_bp
from routes.doctors      import doctors_bp
from routes.admin        import admin_bp

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])

app.register_blueprint(auth_bp,         url_prefix="/api")
app.register_blueprint(patients_bp,     url_prefix="/api")
app.register_blueprint(appointments_bp, url_prefix="/api")
app.register_blueprint(ai_bp,           url_prefix="/api")
app.register_blueprint(doctors_bp,      url_prefix="/api")
app.register_blueprint(admin_bp,        url_prefix="/api")

@app.route("/")
def health():
    return {
        "status":  "MedCore AI backend running",
        "version": "1.0.0",
        "portals": ["patient", "doctor", "admin"]
    }

if __name__ == "__main__":
    app.run(debug=True, port=5000)