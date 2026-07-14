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
    patient_id = request.user.get("patient_id")
    fhir_id    = request.user.get("fhir_id")

    # Read blood group from Neon first (fast, reliable)
    neon_blood_group = None
    conn2 = get_db()
    cur2  = conn2.cursor()
    try:
        # Check if blood_group column exists first
        cur2.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='patients' AND column_name='blood_group'
        """)
        col_exists = cur2.fetchone()
        if col_exists:
            cur2.execute(
                "SELECT blood_group FROM patients WHERE patient_id = %s",
                (patient_id,)
            )
            bg_row = cur2.fetchone()
            neon_blood_group = bg_row[0] if bg_row else None
    except Exception:
        neon_blood_group = None
    finally:
        cur2.close()
        conn2.close()

    if not fhir_id:
        return jsonify({
            "conditions":   [],
            "medications":  [],
            "observations": [],
            "allergies":    [],
            "blood_group":  neon_blood_group
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

        # Blood group — use Neon value if available, else try FHIR
        blood_group = neon_blood_group
        if not blood_group:
            try:
                bg_resp = http_req.get(
                    f"{FHIR_URL}/Observation?subject=Patient/{fhir_id}&code=http://loinc.org|882-1&_count=5",
                    headers={"Accept": "application/fhir+json"},
                    timeout=8
                )
                if bg_resp.status_code == 200:
                    bg_entries = bg_resp.json().get("entry", [])
                    if bg_entries:
                        blood_group = bg_entries[0].get("resource", {}).get("valueString", None)

                # Method 2: Fallback — scan all observations for blood group code
                if not blood_group:
                    all_obs_resp = http_req.get(
                        f"{FHIR_URL}/Observation?subject=Patient/{fhir_id}&_count=100",
                        headers={"Accept": "application/fhir+json"},
                        timeout=10
                    )
                    if all_obs_resp.status_code == 200:
                        for entry in all_obs_resp.json().get("entry", []):
                            res  = entry.get("resource", {})
                            code = res.get("code", {})
                            codings   = code.get("coding", [])
                            code_text = code.get("text", "")
                            is_blood_group = (
                                code_text.lower() in ["blood group", "abo and rh group"] or
                                any(c.get("code") == "882-1" for c in codings)
                            )
                            if is_blood_group and res.get("valueString"):
                                blood_group = res.get("valueString")
                                break
            except Exception:
                pass

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

        # Parse Observations — deduplicate to latest per vital type, skip blood group
        all_obs = []
        for entry in observation_entries:
            res   = entry.get("resource", {})
            code  = res.get("code", {})
            value = res.get("valueQuantity", {})
            date_ = res.get("effectiveDateTime", "")
            name  = code.get("text") or \
                    code.get("coding", [{}])[0].get("display", "Unknown")

            # Skip blood group — shown separately
            codings = code.get("coding", [])
            is_blood_group = (
                name.lower() in ["blood group", "abo and rh group"] or
                any(c.get("code") == "882-1" for c in codings)
            )
            if is_blood_group:
                continue

            # Only numeric vitals
            if not value.get("value"):
                continue

            all_obs.append({
                "name":  name,
                "value": str(value.get("value", "")),
                "unit":  value.get("unit", ""),
                "date":  date_
            })

        # Sort newest first, then keep only latest per vital
        all_obs.sort(key=lambda x: x.get("date", ""), reverse=True)
        seen = set()
        for obs in all_obs:
            key = obs["name"].lower().strip()
            if key not in seen:
                seen.add(key)
                observations.append(obs)

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
            "allergies":    allergies,
            "blood_group":  blood_group
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500