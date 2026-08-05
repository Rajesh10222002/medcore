import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from routes.auth         import auth_bp
from routes.patients     import patients_bp
from routes.appointments import appointments_bp
from routes.ai           import ai_bp
from routes.doctors      import doctors_bp
from routes.admin        import admin_bp
from routes.schedule     import schedule_bp

load_dotenv()

app = Flask(__name__)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS(app, origins=[FRONTEND_ORIGIN])

app.register_blueprint(auth_bp,         url_prefix="/api")
app.register_blueprint(patients_bp,     url_prefix="/api")
app.register_blueprint(appointments_bp, url_prefix="/api")
app.register_blueprint(ai_bp,           url_prefix="/api")
app.register_blueprint(doctors_bp,      url_prefix="/api")
app.register_blueprint(admin_bp,        url_prefix="/api")
app.register_blueprint(schedule_bp,     url_prefix="/api")


@app.route("/api/health")
def health():
    return {
        "status":  "MedCore AI backend running",
        "version": "1.0.0",
        "portals": ["patient", "doctor", "admin"]
    }


# ─────────────────────────────────────────
# Serve the built React frontend (single Azure Web App deployment).
# frontend/dist is copied here by build.sh at deploy time — see
# DEPLOYMENT.md. In local dev this directory won't exist (the Vite
# dev server on :5173 serves the frontend instead), so we fall back
# to the old JSON health response.
# ─────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static_frontend")


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404

    if path and os.path.isfile(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)

    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_path):
        return send_from_directory(FRONTEND_DIR, "index.html")

    return jsonify({
        "status": "MedCore AI backend running",
        "note":   "Frontend build not found — run build.sh to bundle it in, "
                  "or use the Vite dev server on :5173 for local development."
    })


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug_mode, port=int(os.getenv("PORT", 5000)))
