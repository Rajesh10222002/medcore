from flask import Blueprint, request, jsonify
from db import get_db
from middleware.auth import token_required
import bcrypt
import jwt
import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

auth_bp   = Blueprint("auth", __name__)
SECRET    = os.getenv("JWT_SECRET")
FHIR_URL  = os.getenv("FHIR_BASE_URL")

# ─────────────────────────────────────────────
# PATIENT SIGNUP
# POST /api/auth/signup
# ─────────────────────────────────────────────
@auth_bp.route("/auth/signup", methods=["POST"])
def signup():
    data = request.json

    # Validate required fields
    required = ["first_name","last_name","email","password",
                "date_of_birth","gender","phone"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    # Validate password length
    if len(data["password"]) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    conn = get_db()
    cur  = conn.cursor()

    try:
        # Check email already exists
        cur.execute("SELECT user_id FROM users WHERE email = %s",
                    (data["email"],))
        if cur.fetchone():
            return jsonify({"error": "Email already registered"}), 409

        # Hash password
        hashed = bcrypt.hashpw(
            data["password"].encode(), bcrypt.gensalt()
        ).decode()

        # Create user row
        cur.execute("""
            INSERT INTO users (email, password_hash, role)
            VALUES (%s, %s, 'patient') RETURNING user_id
        """, (data["email"], hashed))
        user_id = cur.fetchone()[0]

        # Create FHIR Patient resource
        fhir_id = ""
        try:
            fhir_patient = {
                "resourceType": "Patient",
                "name": [{
                    "family": data["last_name"],
                    "given": [data["first_name"]]
                }],
                "birthDate": data["date_of_birth"],
                "gender":    data["gender"].lower(),
                "telecom":   [{"system": "phone", "value": data["phone"]}]
            }
            fhir_resp = requests.post(
                f"{FHIR_URL}/Patient",
                json=fhir_patient,
                headers={"Content-Type": "application/fhir+json"},
                timeout=10
            )
            if fhir_resp.status_code in [200, 201]:
                fhir_id = fhir_resp.json().get("id", "")
        except Exception as fhir_err:
            # FHIR failure should not block signup
            print(f"FHIR warning: {fhir_err}")

        # Create patient row in Neon
        cur.execute("""
            INSERT INTO patients
            (user_id, first_name, last_name, date_of_birth,
             gender, phone, email, fhir_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING patient_id
        """, (
            user_id,
            data["first_name"], data["last_name"],
            data["date_of_birth"], data["gender"],
            data["phone"], data["email"], fhir_id
        ))
        patient_id = cur.fetchone()[0]
        conn.commit()

        # Issue JWT token
        token = jwt.encode({
            "user_id":    user_id,
            "patient_id": patient_id,
            "role":       "patient",
            "name":       f"{data['first_name']} {data['last_name']}",
            "fhir_id":    fhir_id,
            "exp":        datetime.utcnow() + timedelta(days=7)
        }, SECRET, algorithm="HS256")

        return jsonify({
            "token":      token,
            "role":       "patient",
            "name":       f"{data['first_name']} {data['last_name']}",
            "patient_id": patient_id
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()


# ─────────────────────────────────────────────
# LOGIN — all roles
# POST /api/auth/login
# ─────────────────────────────────────────────
@auth_bp.route("/auth/login", methods=["POST"])
def login():
    data = request.json

    if not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password required"}), 400

    conn = get_db()
    cur  = conn.cursor()

    try:
        # Find user
        cur.execute("""
            SELECT user_id, password_hash, role
            FROM users WHERE email = %s
        """, (data["email"],))
        user = cur.fetchone()

        if not user:
            return jsonify({"error": "Invalid email or password"}), 401

        user_id, password_hash, role = user

        # Verify password
        if not bcrypt.checkpw(
            data["password"].encode(),
            password_hash.encode()
        ):
            return jsonify({"error": "Invalid email or password"}), 401

        # Build token payload based on role
        payload = {
            "user_id": user_id,
            "role":    role,
            "exp":     datetime.utcnow() + timedelta(days=7)
        }

        if role == "patient":
            cur.execute("""
                SELECT patient_id, first_name, last_name, fhir_id
                FROM patients WHERE user_id = %s
            """, (user_id,))
            row = cur.fetchone()
            if row:
                payload["patient_id"] = row[0]
                payload["name"]       = f"{row[1]} {row[2]}"
                payload["fhir_id"]    = row[3] or ""

        elif role == "doctor":
            cur.execute("""
                SELECT doctor_id, first_name, last_name,
                       specialization, fhir_id
                FROM doctors WHERE user_id = %s
            """, (user_id,))
            row = cur.fetchone()
            if row:
                payload["doctor_id"]      = row[0]
                payload["name"]           = f"Dr. {row[1]} {row[2]}"
                payload["specialization"] = row[3]
                payload["fhir_id"]        = row[4] or ""

        elif role == "admin":
            cur.execute("""
                SELECT admin_id, name FROM admins
                WHERE user_id = %s
            """, (user_id,))
            row = cur.fetchone()
            if row:
                payload["admin_id"] = row[0]
                payload["name"]     = row[1]

        token = jwt.encode(payload, SECRET, algorithm="HS256")

        return jsonify({
            "token": token,
            "role":  role,
            "name":  payload.get("name", "")
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()


# ─────────────────────────────────────────────
# CHANGE PASSWORD — any authenticated role
# PUT /api/auth/change-password
# ─────────────────────────────────────────────
@auth_bp.route("/auth/change-password", methods=["PUT"])
@token_required
def change_password():
    data             = request.json
    current_password = data.get("current_password", "")
    new_password     = data.get("new_password", "")

    if not current_password or not new_password:
        return jsonify({"error": "Current and new password are required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400

    user_id = request.user.get("user_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("SELECT password_hash FROM users WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404

        if not bcrypt.checkpw(current_password.encode(), row[0].encode()):
            return jsonify({"error": "Current password is incorrect"}), 401

        new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE user_id = %s",
            (new_hash, user_id)
        )
        conn.commit()
        return jsonify({"message": "Password updated successfully"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()