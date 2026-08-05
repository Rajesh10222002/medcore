from flask import Blueprint, jsonify, request
from db import get_db
from middleware.auth import token_required, role_required
from ai_client import generate_text
import bcrypt
import requests as http_req
import os
from dotenv import load_dotenv
from datetime import date, datetime

load_dotenv()
FHIR_URL = os.getenv("FHIR_BASE_URL")

admin_bp = Blueprint("admin", __name__)


# ─────────────────────────────────────────
# GET /api/admin/kpis
# Dashboard KPI numbers
# ─────────────────────────────────────────
@admin_bp.route("/admin/kpis", methods=["GET"])
@token_required
@role_required(["admin"])
def get_kpis():
    conn = get_db()
    cur  = conn.cursor()
    try:
        # Total patients
        cur.execute("SELECT COUNT(*) FROM patients")
        total_patients = cur.fetchone()[0]

        # Total doctors
        cur.execute("SELECT COUNT(*) FROM doctors")
        total_doctors = cur.fetchone()[0]

        # Total appointments
        cur.execute("SELECT COUNT(*) FROM appointments")
        total_appointments = cur.fetchone()[0]

        # Appointments today
        cur.execute("""
            SELECT COUNT(*) FROM appointments
            WHERE DATE(appointment_date) = CURRENT_DATE
        """)
        today_appointments = cur.fetchone()[0]

        # Scheduled appointments
        cur.execute("""
            SELECT COUNT(*) FROM appointments
            WHERE status = 'scheduled'
        """)
        scheduled = cur.fetchone()[0]

        # Cancelled appointments
        cur.execute("""
            SELECT COUNT(*) FROM appointments
            WHERE status = 'cancelled'
        """)
        cancelled = cur.fetchone()[0]

        # New patients this month
        cur.execute("""
            SELECT COUNT(*) FROM patients
            WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        """)
        new_this_month = cur.fetchone()[0]

        # Appointments per day last 7 days
        cur.execute("""
            SELECT DATE(appointment_date) as appt_date,
                   COUNT(*) as count
            FROM appointments
            WHERE appointment_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY appt_date
            ORDER BY appt_date ASC
        """)
        daily_appts = [
            {"date": str(r[0]), "count": r[1]}
            for r in cur.fetchall()
        ]

        # Appointments by status
        cur.execute("""
            SELECT status, COUNT(*) as count
            FROM appointments
            GROUP BY status
        """)
        by_status = [
            {"status": r[0], "count": r[1]}
            for r in cur.fetchall()
        ]

        # Top doctors by appointment count
        cur.execute("""
            SELECT d.first_name || ' ' || d.last_name as name,
                   d.specialization,
                   COUNT(a.appointment_id) as total,
                   d.doctor_id
            FROM doctors d
            LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
            GROUP BY d.doctor_id, d.first_name, d.last_name, d.specialization
            ORDER BY total DESC
            LIMIT 5
        """)
        top_doctors = [
            {"name": r[0], "specialization": r[1], "total": r[2], "doctor_id": r[3]}
            for r in cur.fetchall()
        ]

        return jsonify({
            "total_patients":    total_patients,
            "total_doctors":     total_doctors,
            "total_appointments": total_appointments,
            "today_appointments": today_appointments,
            "scheduled":          scheduled,
            "cancelled":          cancelled,
            "new_this_month":     new_this_month,
            "daily_appointments": daily_appts,
            "by_status":          by_status,
            "top_doctors":        top_doctors
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/admin/patients
# All patients
# ─────────────────────────────────────────
@admin_bp.route("/admin/patients", methods=["GET"])
@token_required
@role_required(["admin"])
def get_all_patients():
    page     = max(1, int(request.args.get("page", 1)))
    per_page = max(1, int(request.args.get("per_page", 20)))
    search   = request.args.get("search", "").strip()
    gender   = request.args.get("gender", "").strip().lower()

    where, params = [], []
    if search:
        like = f"%{search}%"
        where.append("(p.first_name ILIKE %s OR p.last_name ILIKE %s OR p.email ILIKE %s OR p.phone ILIKE %s)")
        params.extend([like, like, like, like])
    if gender and gender != "all":
        where.append("LOWER(p.gender) = %s")
        params.append(gender)
    where_clause = f"WHERE {' AND '.join(where)}" if where else ""

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute(f"SELECT COUNT(*) FROM patients p {where_clause}", params)
        total = cur.fetchone()[0]

        offset = (page - 1) * per_page
        cur.execute(f"""
            SELECT
                p.patient_id,
                p.first_name,
                p.last_name,
                p.date_of_birth,
                p.gender,
                p.phone,
                p.email,
                p.created_at,
                COUNT(a.appointment_id) as total_appointments
            FROM patients p
            LEFT JOIN appointments a ON p.patient_id = a.patient_id
            {where_clause}
            GROUP BY p.patient_id, p.first_name, p.last_name,
                     p.date_of_birth, p.gender, p.phone,
                     p.email, p.created_at
            ORDER BY p.created_at DESC
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
                "patient_id":          r[0],
                "first_name":          r[1],
                "last_name":           r[2],
                "date_of_birth":       str(r[3]),
                "age":                 age,
                "gender":              r[4],
                "phone":               r[5],
                "email":               r[6],
                "created_at":          str(r[7])[:10],
                "total_appointments":  r[8]
            })

        # Unfiltered aggregate stats for the stat cards — independent of
        # the current search/gender filter, always reflect the full dataset.
        cur.execute("SELECT COUNT(*) FROM patients")
        total_patients = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM patients WHERE LOWER(gender) = 'male'")
        male_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM patients WHERE LOWER(gender) = 'female'")
        female_count = cur.fetchone()[0]
        cur.execute("""
            SELECT COUNT(*) FROM patients
            WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        """)
        new_this_month = cur.fetchone()[0]

        return jsonify({
            "items":    patients,
            "total":    total,
            "page":     page,
            "per_page": per_page,
            "stats": {
                "total":          total_patients,
                "male":           male_count,
                "female":         female_count,
                "new_this_month": new_this_month
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/admin/patients/:id
# Full clinical record for one patient (read-only)
# ─────────────────────────────────────────
@admin_bp.route("/admin/patients/<int:patient_id>", methods=["GET"])
@token_required
@role_required(["admin"])
def get_admin_patient_detail(patient_id):
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

        fhir_id = row[7]
        patient["fhir"] = {
            "conditions":   [],
            "medications":  [],
            "observations": [],
            "allergies":    []
        }

        if fhir_id:
            try:
                def fetch(resource_type, param=None):
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

                for entry in condition_entries:
                    res  = entry.get("resource", {})
                    code = res.get("code", {})
                    patient["fhir"]["conditions"].append({
                        "display": code.get("text") or
                                   code.get("coding", [{}])[0].get("display", "Unknown"),
                        "code":    code.get("coding", [{}])[0].get("code", ""),
                        "date":    res.get("recordedDate", "")
                    })

                for entry in medication_entries:
                    res = entry.get("resource", {})
                    med = res.get("medicationCodeableConcept", {})
                    patient["fhir"]["medications"].append({
                        "name":   med.get("text") or
                                  med.get("coding", [{}])[0].get("display", "Unknown"),
                        "status": res.get("status", ""),
                        "date":   res.get("authoredOn", "")
                    })

                all_obs = []
                for entry in observation_entries:
                    res   = entry.get("resource", {})
                    code  = res.get("code", {})
                    value = res.get("valueQuantity", {})
                    date_ = res.get("effectiveDateTime", "")
                    name  = code.get("text") or \
                            code.get("coding", [{}])[0].get("display", "Unknown")

                    codings = code.get("coding", [])
                    is_blood_group = (
                        name.lower() in ["blood group", "abo and rh group"] or
                        any(c.get("code") == "882-1" for c in codings)
                    )
                    if is_blood_group:
                        continue
                    if not value.get("value"):
                        continue

                    all_obs.append({
                        "name":  name,
                        "value": str(value.get("value", "")),
                        "unit":  value.get("unit", ""),
                        "date":  date_
                    })

                all_obs.sort(key=lambda x: x.get("date", ""), reverse=True)
                seen_vitals = set()
                for obs in all_obs:
                    key = obs["name"].lower().strip()
                    if key not in seen_vitals:
                        seen_vitals.add(key)
                        patient["fhir"]["observations"].append(obs)

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
# GET /api/admin/doctors
# All doctors
# ─────────────────────────────────────────
@admin_bp.route("/admin/doctors", methods=["GET"])
@token_required
@role_required(["admin"])
def get_all_doctors():
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT
                d.doctor_id,
                d.first_name,
                d.last_name,
                d.specialization,
                d.license_number,
                d.phone,
                d.email,
                d.created_at,
                COUNT(a.appointment_id) as total_appointments
            FROM doctors d
            LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
            GROUP BY d.doctor_id, d.first_name, d.last_name,
                     d.specialization, d.license_number,
                     d.phone, d.email, d.created_at
            ORDER BY d.created_at DESC
        """)
        rows = cur.fetchall()
        return jsonify([{
            "doctor_id":          r[0],
            "first_name":         r[1],
            "last_name":          r[2],
            "specialization":     r[3],
            "license_number":     r[4],
            "phone":              r[5],
            "email":              r[6],
            "created_at":         str(r[7])[:10],
            "total_appointments": r[8]
        } for r in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/admin/doctors/:id
# Doctor profile + schedule + appointment history (read-only)
# ─────────────────────────────────────────
@admin_bp.route("/admin/doctors/<int:doctor_id>", methods=["GET"])
@token_required
@role_required(["admin"])
def get_admin_doctor_detail(doctor_id):
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT doctor_id, first_name, last_name, specialization,
                   license_number, phone, email, fhir_id, created_at
            FROM doctors WHERE doctor_id = %s
        """, (doctor_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Doctor not found"}), 404

        doctor = {
            "doctor_id":      row[0],
            "first_name":     row[1],
            "last_name":      row[2],
            "specialization": row[3],
            "license_number": row[4],
            "phone":          row[5],
            "email":          row[6],
            "fhir_id":        row[7],
            "created_at":     str(row[8])[:10]
        }

        cur.execute("""
            SELECT day_of_week, start_time, end_time, slot_duration
            FROM doctor_schedules
            WHERE doctor_id = %s
            ORDER BY day_of_week
        """, (doctor_id,))
        doctor["schedule"] = [{
            "day_of_week":   r[0],
            "start_time":    str(r[1]),
            "end_time":      str(r[2]),
            "slot_duration": r[3]
        } for r in cur.fetchall()]

        cur.execute("""
            SELECT COUNT(*),
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
                   SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END),
                   SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)
            FROM appointments WHERE doctor_id = %s
        """, (doctor_id,))
        s = cur.fetchone()
        doctor["stats"] = {
            "total":     s[0] or 0,
            "completed": s[1] or 0,
            "scheduled": s[2] or 0,
            "cancelled": s[3] or 0
        }

        cur.execute("""
            SELECT a.appointment_id, a.appointment_date, a.status, a.reason,
                   p.first_name || ' ' || p.last_name AS patient_name, a.patient_id
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            WHERE a.doctor_id = %s
            ORDER BY a.appointment_date DESC
            LIMIT 10
        """, (doctor_id,))
        doctor["recent_appointments"] = [{
            "appointment_id":   r[0],
            "appointment_date": str(r[1]),
            "status":           r[2],
            "reason":           r[3],
            "patient_name":     r[4],
            "patient_id":       r[5]
        } for r in cur.fetchall()]

        return jsonify(doctor), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# POST /api/admin/doctors
# Create new doctor account
# ─────────────────────────────────────────
@admin_bp.route("/admin/doctors", methods=["POST"])
@token_required
@role_required(["admin"])
def create_doctor():
    data = request.json
    required = ["first_name", "last_name", "email",
                "password", "specialization", "license_number", "phone"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing: {missing}"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        # Check email exists
        cur.execute(
            "SELECT user_id FROM users WHERE email = %s",
            (data["email"],)
        )
        if cur.fetchone():
            return jsonify({"error": "Email already registered"}), 409

        # Hash password
        hashed = bcrypt.hashpw(
            data["password"].encode(), bcrypt.gensalt()
        ).decode()

        # Create user
        cur.execute("""
            INSERT INTO users (email, password_hash, role)
            VALUES (%s, %s, 'doctor') RETURNING user_id
        """, (data["email"], hashed))
        user_id = cur.fetchone()[0]

        # Create FHIR Practitioner
        fhir_id = ""
        try:
            practitioner = {
                "resourceType": "Practitioner",
                "name": [{
                    "family": data["last_name"],
                    "given":  [data["first_name"]],
                    "prefix": ["Dr."]
                }],
                "telecom": [
                    {"system": "phone", "value": data["phone"]},
                    {"system": "email", "value": data["email"]}
                ],
                "qualification": [{
                    "code": {
                        "text": data["specialization"]
                    }
                }]
            }
            resp = http_req.post(
                f"{FHIR_URL}/Practitioner",
                json=practitioner,
                headers={"Content-Type": "application/fhir+json"},
                timeout=10
            )
            if resp.status_code in [200, 201]:
                fhir_id = resp.json().get("id", "")
        except Exception as fe:
            print(f"FHIR practitioner error: {fe}")

        # Create doctor record
        cur.execute("""
            INSERT INTO doctors
            (user_id, first_name, last_name, specialization,
             license_number, phone, email, fhir_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING doctor_id
        """, (
            user_id,
            data["first_name"], data["last_name"],
            data["specialization"], data["license_number"],
            data["phone"], data["email"], fhir_id
        ))
        doctor_id = cur.fetchone()[0]

        # Insert default schedule Mon-Fri 9-5
        for day in range(5):
            cur.execute("""
                INSERT INTO doctor_schedules
                (doctor_id, day_of_week, start_time, end_time, slot_duration)
                VALUES (%s, %s, '09:00', '17:00', 30)
            """, (doctor_id, day))

        conn.commit()
        return jsonify({
            "message":   "Doctor created successfully",
            "doctor_id": doctor_id,
            "fhir_id":   fhir_id
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/admin/appointments
# All appointments
# ─────────────────────────────────────────
@admin_bp.route("/admin/appointments", methods=["GET"])
@token_required
@role_required(["admin"])
def get_all_appointments():
    page     = max(1, int(request.args.get("page", 1)))
    per_page = max(1, int(request.args.get("per_page", 20)))
    search   = request.args.get("search", "").strip()
    status   = request.args.get("status", "").strip().lower()

    where, params = [], []
    if status and status != "all":
        where.append("a.status = %s")
        params.append(status)
    if search:
        like = f"%{search}%"
        where.append("""(
            p.first_name ILIKE %s OR p.last_name ILIKE %s OR
            d.first_name ILIKE %s OR d.last_name ILIKE %s OR
            a.reason ILIKE %s OR d.specialization ILIKE %s
        )""")
        params.extend([like, like, like, like, like, like])
    where_clause = f"WHERE {' AND '.join(where)}" if where else ""

    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute(f"""
            SELECT COUNT(*)
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            JOIN doctors  d ON a.doctor_id  = d.doctor_id
            {where_clause}
        """, params)
        total = cur.fetchone()[0]

        offset = (page - 1) * per_page
        cur.execute(f"""
            SELECT
                a.appointment_id,
                a.appointment_date,
                a.status,
                a.reason,
                a.no_show_risk,
                a.patient_id,
                a.doctor_id,
                p.first_name || ' ' || p.last_name as patient_name,
                p.email as patient_email,
                d.first_name || ' ' || d.last_name as doctor_name,
                d.specialization
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            JOIN doctors  d ON a.doctor_id  = d.doctor_id
            {where_clause}
            ORDER BY a.appointment_date DESC
            LIMIT %s OFFSET %s
        """, params + [per_page, offset])
        rows = cur.fetchall()
        appointments = [{
            "appointment_id":   r[0],
            "appointment_date": str(r[1]),
            "status":           r[2],
            "reason":           r[3],
            "no_show_risk":     float(r[4]) if r[4] else None,
            "patient_id":       r[5],
            "doctor_id":        r[6],
            "patient_name":     r[7],
            "patient_email":    r[8],
            "doctor_name":      r[9],
            "specialization":   r[10]
        } for r in rows]

        # Unfiltered aggregate stats for the stat cards — always the full
        # dataset, independent of the current search/status filter.
        cur.execute("SELECT COUNT(*) FROM appointments")
        total_all = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM appointments WHERE status = 'scheduled'")
        scheduled_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM appointments WHERE status = 'completed'")
        completed_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM appointments WHERE status = 'cancelled'")
        cancelled_count = cur.fetchone()[0]

        return jsonify({
            "items":    appointments,
            "total":    total,
            "page":     page,
            "per_page": per_page,
            "stats": {
                "total":     total_all,
                "scheduled": scheduled_count,
                "completed": completed_count,
                "cancelled": cancelled_count
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()

# ─────────────────────────────────────────
# POST /api/admin/nl-query
# Natural language analytics query
# Admin types a question → Gemini answers
# using live KPI data from the DB
# ─────────────────────────────────────────
@admin_bp.route("/admin/nl-query", methods=["POST"])
@token_required
@role_required(["admin"])
def nl_query():
    data     = request.json
    question = data.get("question", "").strip()

    if not question:
        return jsonify({"error": "Question required"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        # Pull rich data snapshot for context
        cur.execute("SELECT COUNT(*) FROM patients")
        total_patients = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM doctors")
        total_doctors = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM appointments")
        total_appointments = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM appointments WHERE status='scheduled'")
        scheduled = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM appointments WHERE status='completed'")
        completed = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM appointments WHERE status='cancelled'")
        cancelled = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM appointments WHERE DATE(appointment_date) = CURRENT_DATE")
        today_appointments = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM patients
            WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        """)
        new_this_month = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM appointments
            WHERE appointment_date >= CURRENT_DATE - INTERVAL '7 days'
        """)
        last_7_days = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM appointments
            WHERE appointment_date >= CURRENT_DATE - INTERVAL '30 days'
        """)
        last_30_days = cur.fetchone()[0]

        # Appointments per day last 7 days
        cur.execute("""
            SELECT DATE(appointment_date), COUNT(*)
            FROM appointments
            WHERE appointment_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(appointment_date)
            ORDER BY 1 ASC
        """)
        daily = [{"date": str(r[0]), "count": r[1]} for r in cur.fetchall()]

        # Top doctors
        cur.execute("""
            SELECT d.first_name || ' ' || d.last_name, d.specialization,
                   COUNT(a.appointment_id) as total
            FROM doctors d
            LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
            GROUP BY d.doctor_id, d.first_name, d.last_name, d.specialization
            ORDER BY total DESC
            LIMIT 5
        """)
        top_docs = [{"name": r[0], "specialization": r[1], "appointments": r[2]}
                    for r in cur.fetchall()]

        # Specialization breakdown
        cur.execute("""
            SELECT d.specialization, COUNT(a.appointment_id) as total
            FROM doctors d
            LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
            GROUP BY d.specialization
            ORDER BY total DESC
        """)
        by_spec = [{"specialization": r[0], "appointments": r[1]} for r in cur.fetchall()]

        # Cancellation rate
        cancel_rate = round((cancelled / total_appointments * 100), 1) if total_appointments > 0 else 0

        # Build context string
        today_str = date.today().strftime("%d %B %Y")
        context = f"""
MedCore AI Healthcare System — Live Analytics Data
Report generated: {today_str}

PATIENTS:
- Total registered patients: {total_patients}
- New patients this month: {new_this_month}

DOCTORS:
- Total doctors: {total_doctors}
- By specialization: {', '.join([f"{s['specialization']} ({s['appointments']} appts)" for s in by_spec])}

APPOINTMENTS:
- Total all time: {total_appointments}
- Today: {today_appointments}
- Last 7 days: {last_7_days}
- Last 30 days: {last_30_days}
- Currently scheduled: {scheduled}
- Completed: {completed}
- Cancelled: {cancelled}
- Cancellation rate: {cancel_rate}%

DAILY TREND (last 7 days):
{chr(10).join([f"  {d['date']}: {d['count']} appointments" for d in daily])}

TOP DOCTORS BY APPOINTMENTS:
{chr(10).join([f"  {i+1}. Dr. {d['name']} ({d['specialization']}): {d['appointments']} appointments" for i, d in enumerate(top_docs)])}
"""

        prompt = f"""You are an AI analytics assistant for MedCore AI, a healthcare management system.
You have access to live system data. Answer the admin's question clearly and concisely.

{context}

Admin's question: {question}

Instructions:
- Answer directly using the data above
- Use specific numbers from the data
- Keep the response concise — 2-4 sentences or a short list
- If the question can't be answered from the data, say so clearly
- Do not make up numbers that aren't in the data
- Format clearly — use bullet points if listing multiple items

Answer:"""

        answer = generate_text(prompt) or "Unable to process query."
        return jsonify({
            "answer":  answer,
            "context": {
                "total_patients":     total_patients,
                "total_doctors":      total_doctors,
                "total_appointments": total_appointments,
                "today":              today_appointments
            }
        }), 200

    except Exception as e:
        print(f"NL query error: {e}")
        return jsonify({"error": "Unable to process query at this time."}), 500
    finally:
        cur.close()
        conn.close()