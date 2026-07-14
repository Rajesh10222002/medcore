from flask import Blueprint, jsonify, request
from db import get_db
from middleware.auth import token_required, role_required
import requests as http_req
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()
FHIR_URL = os.getenv("FHIR_BASE_URL")

appointments_bp = Blueprint("appointments", __name__)


# ─────────────────────────────────────────
# GET /api/appointments/mine
# ─────────────────────────────────────────
@appointments_bp.route("/appointments/mine", methods=["GET"])
@token_required
@role_required(["patient"])
def get_my_appointments():
    patient_id = request.user.get("patient_id")
    conn = get_db()
    cur  = conn.cursor()

    # Auto-complete past scheduled appointments
    cur.execute("""
        UPDATE appointments
        SET status = 'completed'
        WHERE status = 'scheduled'
        AND appointment_date < NOW()
        AND patient_id = %s
    """, (patient_id,))
    conn.commit()

    try:
        cur.execute("""
            SELECT
                a.appointment_id,
                a.appointment_date,
                a.status,
                a.reason,
                a.no_show_risk,
                d.first_name || ' ' || d.last_name AS doctor_name,
                d.specialization
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE a.patient_id = %s
            ORDER BY a.appointment_date DESC
        """, (patient_id,))
        rows = cur.fetchall()
        return jsonify([{
            "appointment_id":   r[0],
            "appointment_date": str(r[1]),
            "status":           r[2],
            "reason":           r[3],
            "no_show_risk":     float(r[4]) if r[4] else None,
            "doctor_name":      r[5],
            "specialization":   r[6]
        } for r in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/doctors
# ─────────────────────────────────────────
@appointments_bp.route("/doctors", methods=["GET"])
@token_required
def get_doctors():
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT doctor_id, first_name, last_name,
                   specialization, phone, email
            FROM doctors ORDER BY first_name
        """)
        rows = cur.fetchall()
        return jsonify([{
            "doctor_id":      r[0],
            "first_name":     r[1],
            "last_name":      r[2],
            "specialization": r[3],
            "phone":          r[4],
            "email":          r[5]
        } for r in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# POST /api/appointments
# ─────────────────────────────────────────
@appointments_bp.route("/appointments", methods=["POST"])
@token_required
@role_required(["patient"])
def book_appointment():
    data       = request.json
    patient_id = request.user.get("patient_id")
    fhir_id    = request.user.get("fhir_id")

    required = ["doctor_id", "appointment_date", "reason"]
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing: {missing}"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        # Placeholder no-show risk — ML model added later
        no_show_risk = 25.0

        cur.execute("""
            INSERT INTO appointments
            (patient_id, doctor_id, appointment_date,
             status, reason, no_show_risk)
            VALUES (%s, %s, %s, 'scheduled', %s, %s)
            RETURNING appointment_id
        """, (
            patient_id, data["doctor_id"],
            data["appointment_date"],
            data["reason"], no_show_risk
        ))
        appointment_id = cur.fetchone()[0]

        # Create FHIR Appointment
        try:
            cur.execute(
                "SELECT fhir_id FROM doctors WHERE doctor_id = %s",
                (data["doctor_id"],)
            )
            dr             = cur.fetchone()
            doctor_fhir_id = dr[0] if dr and dr[0] else ""

            fhir_appt = {
                "resourceType": "Appointment",
                "status":       "booked",
                "start":        data["appointment_date"],
                "description":  data["reason"],
                "participant": [{
                    "actor":  {"reference": f"Patient/{fhir_id}"},
                    "status": "accepted"
                }]
            }
            if doctor_fhir_id:
                fhir_appt["participant"].append({
                    "actor":  {"reference": f"Practitioner/{doctor_fhir_id}"},
                    "status": "accepted"
                })

            fhir_resp = http_req.post(
                f"{FHIR_URL}/Appointment",
                json=fhir_appt,
                headers={"Content-Type": "application/fhir+json"},
                timeout=10
            )
            if fhir_resp.status_code in [200, 201]:
                fhir_appt_id = fhir_resp.json().get("id", "")
                cur.execute(
                    "UPDATE appointments SET fhir_id=%s WHERE appointment_id=%s",
                    (fhir_appt_id, appointment_id)
                )
        except Exception as fe:
            print(f"FHIR warning: {fe}")

        conn.commit()
        return jsonify({
            "message":        "Appointment booked successfully",
            "appointment_id": appointment_id,
            "no_show_risk":   no_show_risk,
            "status":         "scheduled"
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# PUT /api/appointments/:id/cancel
# ─────────────────────────────────────────
@appointments_bp.route("/appointments/<int:appointment_id>/cancel", methods=["PUT"])
@token_required
@role_required(["patient"])
def cancel_appointment(appointment_id):
    patient_id = request.user.get("patient_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT appointment_id, status
            FROM appointments
            WHERE appointment_id = %s
            AND patient_id = %s
        """, (appointment_id, patient_id))
        appt = cur.fetchone()

        if not appt:
            return jsonify({"error": "Appointment not found"}), 404
        if appt[1] == "cancelled":
            return jsonify({"error": "Already cancelled"}), 400
        if appt[1] == "completed":
            return jsonify({"error": "Cannot cancel a completed appointment"}), 400

        cur.execute("""
            UPDATE appointments
            SET status = 'cancelled'
            WHERE appointment_id = %s
        """, (appointment_id,))
        conn.commit()
        return jsonify({"message": "Appointment cancelled successfully"}), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/appointments/slots
# Available time slots for a doctor on a date
# ─────────────────────────────────────────
@appointments_bp.route("/appointments/slots", methods=["GET"])
@token_required
def get_slots():
    doctor_id = request.args.get("doctor_id")
    date_str  = request.args.get("date")

    if not doctor_id or not date_str:
        return jsonify({"error": "doctor_id and date required"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        selected_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        day_of_week   = selected_date.weekday()

        # Get doctor schedule
        cur.execute("""
            SELECT start_time, end_time, slot_duration
            FROM doctor_schedules
            WHERE doctor_id = %s AND day_of_week = %s
        """, (doctor_id, day_of_week))
        schedule = cur.fetchone()

        if not schedule:
            return jsonify({
                "slots":   [],
                "message": "Doctor is not available on this day"
            }), 200

        start_time, end_time, slot_duration = schedule

        # Generate all slots
        slots       = []
        current     = datetime.combine(selected_date, start_time)
        end_dt      = datetime.combine(selected_date, end_time)
        slot_length = timedelta(minutes=slot_duration)

        while current + slot_length <= end_dt:
            slots.append(current)
            current += slot_length

        # Get already booked slots
        cur.execute("""
            SELECT appointment_date
            FROM appointments
            WHERE doctor_id = %s
              AND DATE(appointment_date) = %s
              AND status != 'cancelled'
        """, (doctor_id, date_str))
        booked = [row[0] for row in cur.fetchall()]

        booked_times = []
        for b in booked:
            if hasattr(b, 'hour'):
                booked_times.append(b.strftime("%H:%M"))
            else:
                booked_times.append(
                    datetime.fromisoformat(str(b)).strftime("%H:%M")
                )

        # Check doctor_leaves — full day leave or hourly blocks
        full_day_blocked = False
        blocked_ranges   = []
        cur.execute("""
            SELECT block_type, block_start, block_end
            FROM doctor_leaves
            WHERE doctor_id = %s AND leave_date = %s
        """, (doctor_id, date_str))
        for row in cur.fetchall():
            if row[0] == "full_day":
                full_day_blocked = True
            elif row[0] == "hourly" and row[1] and row[2]:
                # Convert TIME columns to proper time objects for accurate comparison
                # row[1] and row[2] are datetime.time objects from psycopg2
                from datetime import time as dt_time
                bs = row[1] if isinstance(row[1], dt_time) else \
                     dt_time(*[int(x) for x in str(row[1]).split(":")[:2]])
                be = row[2] if isinstance(row[2], dt_time) else \
                     dt_time(*[int(x) for x in str(row[2]).split(":")[:2]])
                blocked_ranges.append((bs, be))

        if full_day_blocked:
            return jsonify({
                "slots":         [],
                "message":       "Doctor is on leave this day",
                "leave_blocked": True
            }), 200

        # Build result
        now    = datetime.now()
        result = []
        for slot in slots:
            slot_time  = slot.strftime("%H:%M")
            slot_time_ = slot.time()   # actual time object for comparison
            is_booked  = slot_time in booked_times
            is_past    = slot <= now
            # Check hourly blocks using time object comparison — no string bugs
            is_blocked = False
            for (bs, be) in blocked_ranges:
                if bs <= slot_time_ < be:
                    is_blocked = True
                    break
            result.append({
                "datetime":  slot.isoformat(),
                "time":      slot_time,
                "label":     slot.strftime("%I:%M %p"),
                "available": not is_booked and not is_past and not is_blocked,
                "booked":    is_booked,
                "past":      is_past,
                "blocked":   is_blocked
            })

        return jsonify({
            "slots":     result,
            "date":      date_str,
            "doctor_id": doctor_id
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()