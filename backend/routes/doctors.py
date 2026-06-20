from flask import Blueprint, jsonify, request
from db import get_db
from middleware.auth import token_required, role_required
import requests as http_req
import os
from dotenv import load_dotenv
from datetime import date, datetime

load_dotenv()
FHIR_URL = os.getenv("FHIR_BASE_URL")

doctors_bp = Blueprint("doctors", __name__)


# ─────────────────────────────────────────
# GET /api/doctor/me
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/me", methods=["GET"])
@token_required
@role_required(["doctor"])
def get_doctor_profile():
    doctor_id = request.user.get("doctor_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT doctor_id, first_name, last_name,
                   specialization, license_number, phone, email
            FROM doctors WHERE doctor_id = %s
        """, (doctor_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Doctor not found"}), 404
        return jsonify({
            "doctor_id":      row[0],
            "first_name":     row[1],
            "last_name":      row[2],
            "specialization": row[3],
            "license_number": row[4],
            "phone":          row[5],
            "email":          row[6]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/doctor/patients
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/patients", methods=["GET"])
@token_required
@role_required(["doctor"])
def get_my_patients():
    doctor_id = request.user.get("doctor_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT DISTINCT
                p.patient_id,
                p.first_name,
                p.last_name,
                p.date_of_birth,
                p.gender,
                p.phone,
                p.email,
                p.fhir_id,
                COUNT(a.appointment_id) as total_visits,
                MAX(a.appointment_date) as last_visit
            FROM patients p
            JOIN appointments a ON p.patient_id = a.patient_id
            WHERE a.doctor_id = %s
            GROUP BY p.patient_id, p.first_name, p.last_name,
                     p.date_of_birth, p.gender, p.phone,
                     p.email, p.fhir_id
            ORDER BY last_visit DESC
        """, (doctor_id,))
        rows = cur.fetchall()
        patients = []
        for r in rows:
            dob = r[3]
            if dob:
                today = date.today()
                age   = today.year - dob.year - (
                    (today.month, today.day) < (dob.month, dob.day)
                )
            else:
                age = 0
            patients.append({
                "patient_id":    r[0],
                "first_name":    r[1],
                "last_name":     r[2],
                "date_of_birth": str(r[3]),
                "age":           age,
                "gender":        r[4],
                "phone":         r[5],
                "email":         r[6],
                "fhir_id":       r[7],
                "total_visits":  r[8],
                "last_visit":    str(r[9])[:10] if r[9] else None
            })
        return jsonify(patients), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/doctor/patients/:id
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/patients/<int:patient_id>", methods=["GET"])
@token_required
@role_required(["doctor"])
def get_patient_detail(patient_id):
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT patient_id, first_name, last_name,
                   date_of_birth, gender, phone, email, fhir_id
            FROM patients WHERE patient_id = %s
        """, (patient_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Patient not found"}), 404

        dob = row[3]
        if dob:
            today = date.today()
            age   = today.year - dob.year - (
                (today.month, today.day) < (dob.month, dob.day)
            )
        else:
            age = 0

        patient = {
            "patient_id":    row[0],
            "first_name":    row[1],
            "last_name":     row[2],
            "date_of_birth": str(row[3]),
            "age":           age,
            "gender":        row[4],
            "phone":         row[5],
            "email":         row[6],
            "fhir_id":       row[7]
        }

        # Appointments
        cur.execute("""
            SELECT appointment_id, appointment_date,
                   status, reason, no_show_risk
            FROM appointments
            WHERE patient_id = %s
            ORDER BY appointment_date DESC
            LIMIT 10
        """, (patient_id,))
        appts = cur.fetchall()
        patient["appointments"] = [{
            "appointment_id":   a[0],
            "appointment_date": str(a[1]),
            "status":           a[2],
            "reason":           a[3],
            "no_show_risk":     float(a[4]) if a[4] else None
        } for a in appts]

        # Clinical notes
        cur.execute("""
            SELECT note_id, note_text, note_type, created_at
            FROM clinical_notes
            WHERE patient_id = %s
            ORDER BY created_at DESC
            LIMIT 5
        """, (patient_id,))
        notes = cur.fetchall()
        patient["notes"] = [{
            "note_id":    n[0],
            "note_text":  n[1],
            "note_type":  n[2],
            "created_at": str(n[3])
        } for n in notes]

        # FHIR data
        fhir_id = row[7]
        patient["fhir"] = {
            "conditions":   [],
            "medications":  [],
            "observations": [],
            "allergies":    []
        }

        if fhir_id:
            try:
                # ── FIXED: Search each resource directly ──
                # $everything was not returning newly added resources
                # Direct search is more reliable and always up to date

                def fetch(resource_type, param=None):
                    """Fetch FHIR resources by direct search"""
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

                condition_entries   = fetch("Condition")
                medication_entries  = fetch("MedicationRequest")
                observation_entries = fetch("Observation")
                allergy_entries     = fetch("AllergyIntolerance", "patient")

                # Parse Conditions
                for entry in condition_entries:
                    res  = entry.get("resource", {})
                    code = res.get("code", {})
                    patient["fhir"]["conditions"].append({
                        "display": code.get("text") or
                                   code.get("coding", [{}])[0].get("display", "Unknown"),
                        "code":    code.get("coding", [{}])[0].get("code", ""),
                        "date":    res.get("recordedDate", "")
                    })

                # Parse Medications
                for entry in medication_entries:
                    res = entry.get("resource", {})
                    med = res.get("medicationCodeableConcept", {})
                    patient["fhir"]["medications"].append({
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
                    date_ = res.get("effectiveDateTime", "")
                    patient["fhir"]["observations"].append({
                        "name":      code.get("text") or
                                     code.get("coding", [{}])[0].get("display", "Unknown"),
                        "value":     str(value.get("value", "")),
                        "unit":      value.get("unit", ""),
                        "date":      date_,
                        "date_only": date_[:10] if date_ else ""
                    })

                # Parse Allergies
                for entry in allergy_entries:
                    res  = entry.get("resource", {})
                    code = res.get("code", {})
                    patient["fhir"]["allergies"].append({
                        "name":     code.get("text") or
                                    code.get("coding", [{}])[0].get("display", "Unknown"),
                        "severity": res.get("reaction", [{}])[0]
                                        .get("severity", "unknown")
                    })

                # Sort observations newest first
                patient["fhir"]["observations"].sort(
                    key=lambda x: x.get("date", ""),
                    reverse=True
                )

            except Exception as fe:
                print(f"FHIR error: {fe}")

        return jsonify(patient), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# POST /api/doctor/notes/:patient_id
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/notes/<int:patient_id>", methods=["POST"])
@token_required
@role_required(["doctor"])
def save_note(patient_id):
    data      = request.json
    doctor_id = request.user.get("doctor_id")
    note_text = data.get("note_text", "")

    if not note_text:
        return jsonify({"error": "Note text required"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO clinical_notes
            (patient_id, doctor_id, note_text, note_type)
            VALUES (%s, %s, %s, 'progress')
            RETURNING note_id
        """, (patient_id, doctor_id, note_text))
        note_id = cur.fetchone()[0]

        cur.execute(
            "SELECT fhir_id FROM patients WHERE patient_id = %s",
            (patient_id,)
        )
        row     = cur.fetchone()
        fhir_id = row[0] if row and row[0] else None

        fhir_saved = False
        if fhir_id:
            try:
                fhir_note = {
                    "resourceType": "ClinicalImpression",
                    "status":       "completed",
                    "subject":      {"reference": f"Patient/{fhir_id}"},
                    "description":  note_text,
                    "date":         str(datetime.now().date())
                }
                resp = http_req.post(
                    f"{FHIR_URL}/ClinicalImpression",
                    json=fhir_note,
                    headers={"Content-Type": "application/fhir+json"},
                    timeout=10
                )
                if resp.status_code in [200, 201]:
                    fhir_saved = True
            except Exception as fe:
                print(f"FHIR note error: {fe}")

        conn.commit()
        return jsonify({
            "message":    "Note saved successfully",
            "note_id":    note_id,
            "fhir_saved": fhir_saved
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# POST /api/doctor/vitals/:patient_id
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/vitals/<int:patient_id>", methods=["POST"])
@token_required
@role_required(["doctor"])
def save_vitals(patient_id):
    data = request.json
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute(
            "SELECT fhir_id FROM patients WHERE patient_id = %s",
            (patient_id,)
        )
        row     = cur.fetchone()
        fhir_id = row[0] if row and row[0] else None

        saved_vitals = []

        if fhir_id:
            vital_map = {
                "heart_rate":         ("8867-4", "Heart rate",               "/min"),
                "systolic_bp":        ("8480-6", "Systolic blood pressure",  "mmHg"),
                "diastolic_bp":       ("8462-4", "Diastolic blood pressure", "mmHg"),
                "temperature":        ("8310-5", "Body temperature",         "Cel"),
                "respiratory_rate":   ("9279-1", "Respiratory rate",         "/min"),
                "oxygen_saturation":  ("2708-6", "Oxygen saturation",        "%"),
            }
            for key, (loinc, display, unit) in vital_map.items():
                value = data.get(key)
                if value:
                    try:
                        obs = {
                            "resourceType": "Observation",
                            "status":       "final",
                            "code": {
                                "coding": [{
                                    "system":  "http://loinc.org",
                                    "code":    loinc,
                                    "display": display
                                }],
                                "text": display
                            },
                            "subject":           {"reference": f"Patient/{fhir_id}"},
                            "effectiveDateTime": datetime.now().isoformat(),
                            "valueQuantity": {
                                "value":  float(value),
                                "unit":   unit,
                                "system": "http://unitsofmeasure.org"
                            }
                        }
                        resp = http_req.post(
                            f"{FHIR_URL}/Observation",
                            json=obs,
                            headers={"Content-Type": "application/fhir+json"},
                            timeout=10
                        )
                        if resp.status_code in [200, 201]:
                            saved_vitals.append(display)
                    except Exception as ve:
                        print(f"Vital error {key}: {ve}")

        conn.commit()
        return jsonify({
            "message":      "Vitals saved",
            "saved_vitals": saved_vitals
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# POST /api/doctor/diagnosis/:patient_id
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/diagnosis/<int:patient_id>", methods=["POST"])
@token_required
@role_required(["doctor"])
def add_diagnosis(patient_id):
    data    = request.json
    display = data.get("display", "")
    code    = data.get("code", "")

    if not display:
        return jsonify({"error": "Diagnosis name required"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute(
            "SELECT fhir_id FROM patients WHERE patient_id = %s",
            (patient_id,)
        )
        row     = cur.fetchone()
        fhir_id = row[0] if row and row[0] else None

        if not fhir_id:
            return jsonify({"error": "Patient FHIR ID not found"}), 400

        condition = {
            "resourceType": "Condition",
            "subject":      {"reference": f"Patient/{fhir_id}"},
            "code": {
                "text": display,
                "coding": [{
                    "system":  "http://hl7.org/fhir/sid/icd-10",
                    "code":    code or "Z99",
                    "display": display
                }]
            },
            "recordedDate": str(datetime.now().date()),
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code":   "active"
                }]
            }
        }

        resp = http_req.post(
            f"{FHIR_URL}/Condition",
            json=condition,
            headers={"Content-Type": "application/fhir+json"},
            timeout=10
        )

        if resp.status_code in [200, 201]:
            return jsonify({
                "message": "Diagnosis added successfully",
                "fhir_id": resp.json().get("id", "")
            }), 201
        else:
            return jsonify({"error": "Failed to save diagnosis"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# POST /api/doctor/medication/:patient_id
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/medication/<int:patient_id>", methods=["POST"])
@token_required
@role_required(["doctor"])
def add_medication(patient_id):
    data   = request.json
    name   = data.get("name", "")
    dosage = data.get("dosage", "")
    freq   = data.get("frequency", "")

    if not name:
        return jsonify({"error": "Medication name required"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute(
            "SELECT fhir_id FROM patients WHERE patient_id = %s",
            (patient_id,)
        )
        row     = cur.fetchone()
        fhir_id = row[0] if row and row[0] else None

        if not fhir_id:
            return jsonify({"error": "Patient FHIR ID not found"}), 400

        med_display = f"{name} {dosage} {freq}".strip()
        medication  = {
            "resourceType": "MedicationRequest",
            "status":       "active",
            "intent":       "order",
            "subject":      {"reference": f"Patient/{fhir_id}"},
            "medicationCodeableConcept": {
                "text": med_display,
                "coding": [{"display": name}]
            },
            "authoredOn":        str(datetime.now().date()),
            "dosageInstruction": [{"text": f"{dosage} {freq}".strip()}]
        }

        resp = http_req.post(
            f"{FHIR_URL}/MedicationRequest",
            json=medication,
            headers={"Content-Type": "application/fhir+json"},
            timeout=10
        )

        if resp.status_code in [200, 201]:
            return jsonify({
                "message": "Medication added successfully",
                "fhir_id": resp.json().get("id", "")
            }), 201
        else:
            return jsonify({"error": "Failed to save medication"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# POST /api/doctor/allergy/:patient_id
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/allergy/<int:patient_id>", methods=["POST"])
@token_required
@role_required(["doctor"])
def add_allergy(patient_id):
    data     = request.json
    name     = data.get("name", "")
    severity = data.get("severity", "mild")

    if not name:
        return jsonify({"error": "Allergy name required"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute(
            "SELECT fhir_id FROM patients WHERE patient_id = %s",
            (patient_id,)
        )
        row     = cur.fetchone()
        fhir_id = row[0] if row and row[0] else None

        if not fhir_id:
            return jsonify({"error": "Patient FHIR ID not found"}), 400

        allergy = {
            "resourceType": "AllergyIntolerance",
            "patient":      {"reference": f"Patient/{fhir_id}"},
            "code": {
                "text":   name,
                "coding": [{"display": name}]
            },
            "clinicalStatus": {
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                    "code":   "active"
                }]
            },
            "reaction": [{
                "severity":        severity,
                "manifestation":   [{"text": name}]
            }]
        }

        resp = http_req.post(
            f"{FHIR_URL}/AllergyIntolerance",
            json=allergy,
            headers={"Content-Type": "application/fhir+json"},
            timeout=10
        )

        if resp.status_code in [200, 201]:
            return jsonify({
                "message": "Allergy added successfully",
                "fhir_id": resp.json().get("id", "")
            }), 201
        else:
            return jsonify({"error": "Failed to save allergy"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()