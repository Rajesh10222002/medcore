from flask import Blueprint, jsonify, request
from db import get_db
from middleware.auth import token_required, role_required
import requests as http_req
import os
from dotenv import load_dotenv

load_dotenv()
FHIR_URL = os.getenv("FHIR_BASE_URL")

patients_bp = Blueprint("patients", __name__)


# ─────────────────────────────────────────
# GET /api/patients/me
# ─────────────────────────────────────────
@patients_bp.route("/patients/me", methods=["GET"])
@token_required
@role_required(["patient"])
def get_my_profile():
    patient_id = request.user.get("patient_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT patient_id, first_name, last_name,
                   date_of_birth, gender, phone,
                   email, fhir_id, created_at
            FROM patients WHERE patient_id = %s
        """, (patient_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Patient not found"}), 404
        return jsonify({
            "patient_id":    row[0],
            "first_name":    row[1],
            "last_name":     row[2],
            "date_of_birth": str(row[3]),
            "gender":        row[4],
            "phone":         row[5],
            "email":         row[6],
            "fhir_id":       row[7],
            "created_at":    str(row[8])
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/patients/me/fhir
# ─────────────────────────────────────────
@patients_bp.route("/patients/me/fhir", methods=["GET"])
@token_required
@role_required(["patient"])
def get_my_fhir():
    fhir_id = request.user.get("fhir_id")

    if not fhir_id:
        return jsonify({
            "conditions":   [],
            "medications":  [],
            "observations": [],
            "allergies":    []
        }), 200

    try:
        conditions   = []
        medications  = []
        observations = []
        allergies    = []

        def fetch(resource_type, param=None):
            """Fetch FHIR resources by direct search instead of $everything"""
            if param:
                url = f"{FHIR_URL}/{resource_type}?{param}={fhir_id}&_count=50"
            else:
                url = f"{FHIR_URL}/{resource_type}?subject=Patient/{fhir_id}&_count=50"
            r = http_req.get(
                url,
                headers={"Accept": "application/fhir+json"},
                timeout=10
            )
            if r.status_code == 200:
                return r.json().get("entry", [])
            return []

        # Fetch each resource type separately
        condition_entries   = fetch("Condition")
        medication_entries  = fetch("MedicationRequest")
        observation_entries = fetch("Observation")
        allergy_entries     = fetch("AllergyIntolerance", "patient")

        # Parse Conditions
        for entry in condition_entries:
            res  = entry.get("resource", {})
            code = res.get("code", {})
            conditions.append({
                "display": code.get("text") or
                           code.get("coding", [{}])[0].get("display", "Unknown"),
                "code":    code.get("coding", [{}])[0].get("code", ""),
                "date":    res.get("recordedDate", "")
            })

        # Parse Medications
        for entry in medication_entries:
            res = entry.get("resource", {})
            med = res.get("medicationCodeableConcept", {})
            medications.append({
                "name":   med.get("text") or
                          med.get("coding", [{}])[0].get("display", "Unknown"),
                "status": res.get("status", ""),
                "date":   res.get("authoredOn", "")
            })

        # Parse Observations
        for entry in observation_entries:
            res   = entry.get("resource", {})
            code  = res.get("code", {})
            value = res.get("valueQuantity", {})
            observations.append({
                "name":  code.get("text") or
                         code.get("coding", [{}])[0].get("display", "Unknown"),
                "value": str(value.get("value", "")),
                "unit":  value.get("unit", ""),
                "date":  res.get("effectiveDateTime", "")
            })

        # Parse Allergies
        for entry in allergy_entries:
            res  = entry.get("resource", {})
            code = res.get("code", {})
            allergies.append({
                "name":     code.get("text") or
                            code.get("coding", [{}])[0].get("display", "Unknown"),
                "severity": res.get("reaction", [{}])[0]
                                .get("severity", "unknown")
            })

        return jsonify({
            "conditions":   conditions,
            "medications":  medications,
            "observations": observations,
            "allergies":    allergies
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500