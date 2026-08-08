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
# GET /api/doctor/analytics
# Practice analytics for the logged-in doctor's own Dashboard —
# monthly patient trend + this month's status breakdown.
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/analytics", methods=["GET"])
@token_required
@role_required(["doctor"])
def get_doctor_analytics():
    doctor_id = request.user.get("doctor_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        # Distinct completed patients per month, last 6 months
        cur.execute("""
            SELECT TO_CHAR(DATE_TRUNC('month', appointment_date), 'YYYY-MM') AS month,
                   COUNT(DISTINCT patient_id) AS count
            FROM appointments
            WHERE doctor_id = %s
              AND status = 'completed'
              AND appointment_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
            GROUP BY month
            ORDER BY month ASC
        """, (doctor_id,))
        by_month = {r[0]: r[1] for r in cur.fetchall()}

        monthly_patients = []
        for i in range(5, -1, -1):
            cur.execute("SELECT TO_CHAR(CURRENT_DATE - (INTERVAL '1 month' * %s), 'YYYY-MM')", (i,))
            key = cur.fetchone()[0]
            monthly_patients.append({"month": key, "count": by_month.get(key, 0)})

        # This month's status breakdown
        cur.execute("""
            SELECT status, COUNT(*) FROM appointments
            WHERE doctor_id = %s
              AND DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', CURRENT_DATE)
            GROUP BY status
        """, (doctor_id,))
        by_status = [{"status": r[0], "count": r[1]} for r in cur.fetchall()]

        # Total appointments this month vs last month (for a trend indicator)
        cur.execute("""
            SELECT
              SUM(CASE WHEN DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 ELSE 0 END),
              SUM(CASE WHEN DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' THEN 1 ELSE 0 END)
            FROM appointments WHERE doctor_id = %s
        """, (doctor_id,))
        row = cur.fetchone()

        return jsonify({
            "monthly_patients": monthly_patients,
            "by_status":        by_status,
            "total_this_month": row[0] or 0,
            "total_last_month": row[1] or 0
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
    page      = max(1, int(request.args.get("page", 1)))
    per_page  = max(1, int(request.args.get("per_page", 20)))
    search    = request.args.get("search", "").strip()

    where_extra, params = "", [doctor_id]
    if search:
        like = f"%{search}%"
        where_extra = " AND (p.first_name ILIKE %s OR p.last_name ILIKE %s OR p.email ILIKE %s)"
        params.extend([like, like, like])

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute(f"""
            SELECT COUNT(DISTINCT p.patient_id)
            FROM patients p
            JOIN appointments a ON p.patient_id = a.patient_id
            WHERE a.doctor_id = %s {where_extra}
        """, params)
        total = cur.fetchone()[0]

        offset = (page - 1) * per_page
        cur.execute(f"""
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
            WHERE a.doctor_id = %s {where_extra}
            GROUP BY p.patient_id, p.first_name, p.last_name,
                     p.date_of_birth, p.gender, p.phone,
                     p.email, p.fhir_id
            ORDER BY last_visit DESC
            LIMIT %s OFFSET %s
        """, params + [per_page, offset])
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

        # Unfiltered aggregate stats for the stat cards — always reflect
        # every patient this doctor has seen, independent of search.
        cur.execute("""
            SELECT COUNT(a.appointment_id) as visits, MAX(a.appointment_date) as last_visit
            FROM appointments a
            WHERE a.doctor_id = %s
            GROUP BY a.patient_id
        """, (doctor_id,))
        stat_rows = cur.fetchall()
        total_patients = len(stat_rows)
        frequent_count = sum(1 for r in stat_rows if r[0] >= 5)
        now = date.today()
        new_this_month = sum(
            1 for r in stat_rows
            if r[1] and r[1].month == now.month and r[1].year == now.year
        )

        return jsonify({
            "items":    patients,
            "total":    total,
            "page":     page,
            "per_page": per_page,
            "stats": {
                "total":          total_patients,
                "frequent":       frequent_count,
                "new_this_month": new_this_month
            }
        }), 200
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

                # Parse Observations — deduplicate to latest per vital type
                # Skip blood group (valueString) — it has its own display
                all_obs = []
                for entry in observation_entries:
                    res   = entry.get("resource", {})
                    code  = res.get("code", {})
                    value = res.get("valueQuantity", {})
                    date_ = res.get("effectiveDateTime", "")
                    name  = code.get("text") or \
                            code.get("coding", [{}])[0].get("display", "Unknown")

                    # Skip blood group observations — shown separately
                    codings = code.get("coding", [])
                    is_blood_group = (
                        name.lower() in ["blood group", "abo and rh group"] or
                        any(c.get("code") == "882-1" for c in codings)
                    )
                    if is_blood_group:
                        continue

                    # Only include numeric vitals (valueQuantity present)
                    if not value.get("value"):
                        continue

                    all_obs.append({
                        "name":      name,
                        "value":     str(value.get("value", "")),
                        "unit":      value.get("unit", ""),
                        "date":      date_,
                        "date_only": date_[:10] if date_ else ""
                    })

                # Sort newest first
                all_obs.sort(key=lambda x: x.get("date", ""), reverse=True)

                # Keep only the LATEST reading per vital name
                seen_vitals = set()
                for obs in all_obs:
                    key = obs["name"].lower().strip()
                    if key not in seen_vitals:
                        seen_vitals.add(key)
                        patient["fhir"]["observations"].append(obs)

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
                "weight":             ("29463-7", "Body weight",             "kg"),
                "height":             ("8302-2",  "Body height",            "cm"),
                "glucose":            ("2339-0",  "Glucose",                "mg/dL"),
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


# ─────────────────────────────────────────
# POST /api/doctor/blood-group/:patient_id
# Saves blood group — tries FHIR first, falls back to Neon column
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/blood-group/<int:patient_id>", methods=["POST"])
@token_required
@role_required(["doctor"])
def set_blood_group(patient_id):
    data        = request.json
    blood_group = data.get("blood_group", "").strip()

    valid = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    if blood_group not in valid:
        return jsonify({"error": f"Invalid blood group. Must be one of: {', '.join(valid)}"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute(
            "SELECT fhir_id FROM patients WHERE patient_id = %s",
            (patient_id,)
        )
        row     = cur.fetchone()
        fhir_id = row[0] if row and row[0] else None

        fhir_saved = False

        # Try FHIR first
        if fhir_id:
            try:
                observation = {
                    "resourceType": "Observation",
                    "status":       "final",
                    "category": [{
                        "coding": [{
                            "system":  "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code":    "laboratory",
                            "display": "Laboratory"
                        }]
                    }],
                    "code": {
                        "coding": [{
                            "system":  "http://loinc.org",
                            "code":    "882-1",
                            "display": "ABO and Rh group"
                        }],
                        "text": "Blood Group"
                    },
                    "subject":           {"reference": f"Patient/{fhir_id}"},
                    "effectiveDateTime": str(datetime.now().date()),
                    "valueString":       blood_group
                }
                resp = http_req.post(
                    f"{FHIR_URL}/Observation",
                    json=observation,
                    headers={"Content-Type": "application/fhir+json"},
                    timeout=10
                )
                if resp.status_code in [200, 201]:
                    fhir_saved = True
            except Exception as fhir_err:
                print(f"FHIR blood group error: {fhir_err}")

        # Always save to Neon as fallback
        try:
            cur.execute("""
                ALTER TABLE patients
                ADD COLUMN IF NOT EXISTS blood_group VARCHAR(5)
            """)
            conn.commit()
            cur.execute("""
                UPDATE patients SET blood_group = %s
                WHERE patient_id = %s
            """, (blood_group, patient_id))
            conn.commit()
        except Exception as neon_err:
            print(f"Neon blood group error: {neon_err}")
            conn.rollback()

        return jsonify({
            "message":     "Blood group saved successfully",
            "blood_group": blood_group,
            "fhir_saved":  fhir_saved,
            "neon_saved":  True
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/doctor/blood-group/:patient_id
# Reads blood group from FHIR Observation
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/blood-group/<int:patient_id>", methods=["GET"])
@token_required
@role_required(["doctor"])
def get_blood_group(patient_id):
    conn = get_db()
    cur  = conn.cursor()
    try:
        # Check Neon first (fastest, most reliable)
        try:
            cur.execute(
                "SELECT fhir_id, blood_group FROM patients WHERE patient_id = %s",
                (patient_id,)
            )
        except Exception:
            cur.execute(
                "SELECT fhir_id, NULL FROM patients WHERE patient_id = %s",
                (patient_id,)
            )
        row     = cur.fetchone()
        fhir_id = row[0] if row and row[0] else None
        neon_bg = row[1] if row and len(row) > 1 else None

        # Return from Neon if available
        if neon_bg:
            return jsonify({"blood_group": neon_bg}), 200

        if not fhir_id:
            return jsonify({"blood_group": None}), 200

        # Fallback to FHIR
        blood_group = None
        try:
            bg_resp = http_req.get(
                f"{FHIR_URL}/Observation?subject=Patient/{fhir_id}&code=http://loinc.org|882-1&_count=5",
                headers={"Accept": "application/fhir+json"},
                timeout=8
            )
            if bg_resp.status_code == 200:
                entries = bg_resp.json().get("entry", [])
                if entries:
                    blood_group = entries[0].get("resource", {}).get("valueString", None)

            if not blood_group:
                all_resp = http_req.get(
                    f"{FHIR_URL}/Observation?subject=Patient/{fhir_id}&_count=100",
                    headers={"Accept": "application/fhir+json"},
                    timeout=8
                )
                if all_resp.status_code == 200:
                    for entry in all_resp.json().get("entry", []):
                        res       = entry.get("resource", {})
                        code      = res.get("code", {})
                        codings   = code.get("coding", [])
                        code_text = code.get("text", "")
                        if (
                            code_text.lower() in ["blood group", "abo and rh group"] or
                            any(c.get("code") == "882-1" for c in codings)
                        ) and res.get("valueString"):
                            blood_group = res.get("valueString")
                            break
        except Exception as fhir_err:
            print(f"FHIR blood group GET error: {fhir_err}")

        return jsonify({"blood_group": blood_group}), 200

    except Exception as e:
        return jsonify({"blood_group": None}), 200
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/doctor/me/feedback
# The logged-in doctor's own ratings
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/me/feedback", methods=["GET"])
@token_required
@role_required(["doctor"])
def get_my_feedback():
    doctor_id = request.user.get("doctor_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT AVG(rating), COUNT(*) FROM patient_feedback WHERE doctor_id = %s
        """, (doctor_id,))
        avg_rating, feedback_count = cur.fetchone()

        cur.execute("""
            SELECT f.rating, f.comment, f.created_at,
                   p.first_name || ' ' || p.last_name AS patient_name
            FROM patient_feedback f
            JOIN patients p ON f.patient_id = p.patient_id
            WHERE f.doctor_id = %s
            ORDER BY f.created_at DESC
            LIMIT 20
        """, (doctor_id,))
        feedback = [{
            "rating":       r[0],
            "comment":      r[1],
            "created_at":   str(r[2]),
            "patient_name": r[3]
        } for r in cur.fetchall()]

        return jsonify({
            "avg_rating":     round(float(avg_rating), 1) if avg_rating else None,
            "feedback_count": feedback_count or 0,
            "feedback":       feedback
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# POST /api/doctor/patients/:id/referrals
# Refer a patient to another doctor
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/patients/<int:patient_id>/referrals", methods=["POST"])
@token_required
@role_required(["doctor"])
def create_referral(patient_id):
    data                  = request.json
    referring_doctor_id   = request.user.get("doctor_id")
    referred_to_doctor_id = data.get("referred_to_doctor_id")
    reason                = (data.get("reason") or "").strip()

    if not referred_to_doctor_id or not reason:
        return jsonify({"error": "referred_to_doctor_id and reason are required"}), 400
    if int(referred_to_doctor_id) == referring_doctor_id:
        return jsonify({"error": "Cannot refer a patient to yourself"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("SELECT doctor_id FROM doctors WHERE doctor_id = %s", (referred_to_doctor_id,))
        if not cur.fetchone():
            return jsonify({"error": "Referred doctor not found"}), 404

        cur.execute("""
            INSERT INTO referrals
            (patient_id, referring_doctor_id, referred_to_doctor_id, reason)
            VALUES (%s, %s, %s, %s) RETURNING referral_id
        """, (patient_id, referring_doctor_id, referred_to_doctor_id, reason))
        referral_id = cur.fetchone()[0]
        conn.commit()
        return jsonify({
            "message":     "Referral created successfully",
            "referral_id": referral_id,
            "status":      "pending"
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/doctor/referrals/incoming
# Pending referrals sent to the logged-in doctor
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/referrals/incoming", methods=["GET"])
@token_required
@role_required(["doctor"])
def get_incoming_referrals():
    doctor_id = request.user.get("doctor_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT r.referral_id, r.patient_id,
                   p.first_name || ' ' || p.last_name AS patient_name,
                   d.first_name || ' ' || d.last_name AS referring_doctor_name,
                   r.reason, r.status, r.created_at
            FROM referrals r
            JOIN patients p ON r.patient_id = p.patient_id
            JOIN doctors d ON r.referring_doctor_id = d.doctor_id
            WHERE r.referred_to_doctor_id = %s AND r.status = 'pending'
            ORDER BY r.created_at DESC
        """, (doctor_id,))
        return jsonify([{
            "referral_id":           r[0],
            "patient_id":            r[1],
            "patient_name":          r[2],
            "referring_doctor_name": r[3],
            "reason":                r[4],
            "status":                r[5],
            "created_at":            str(r[6])
        } for r in cur.fetchall()]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# PUT /api/doctor/referrals/:id/accept
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/referrals/<int:referral_id>/accept", methods=["PUT"])
@token_required
@role_required(["doctor"])
def accept_referral(referral_id):
    doctor_id = request.user.get("doctor_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT referral_id FROM referrals
            WHERE referral_id = %s AND referred_to_doctor_id = %s
        """, (referral_id, doctor_id))
        if not cur.fetchone():
            return jsonify({"error": "Referral not found"}), 404

        cur.execute(
            "UPDATE referrals SET status = 'accepted' WHERE referral_id = %s",
            (referral_id,)
        )
        conn.commit()
        return jsonify({"message": "Referral accepted", "status": "accepted"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# PUT /api/doctor/referrals/:id/decline
# ─────────────────────────────────────────
@doctors_bp.route("/doctor/referrals/<int:referral_id>/decline", methods=["PUT"])
@token_required
@role_required(["doctor"])
def decline_referral(referral_id):
    doctor_id      = request.user.get("doctor_id")
    data           = request.get_json(silent=True) or {}
    decline_reason = (data.get("decline_reason") or "").strip() or None
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT referral_id FROM referrals
            WHERE referral_id = %s AND referred_to_doctor_id = %s
        """, (referral_id, doctor_id))
        if not cur.fetchone():
            return jsonify({"error": "Referral not found"}), 404

        cur.execute(
            "UPDATE referrals SET status = 'declined', decline_reason = %s WHERE referral_id = %s",
            (decline_reason, referral_id)
        )
        conn.commit()
        return jsonify({"message": "Referral declined", "status": "declined"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()