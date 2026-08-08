from flask import Blueprint, request, jsonify
from middleware.auth import token_required, role_required
from db import get_db
from datetime import datetime, date

schedule_bp = Blueprint("schedule", __name__)

# ─────────────────────────────────────────
# GET /api/doctor/schedule/leaves
# Returns all leaves and blocks for this doctor
# ─────────────────────────────────────────
@schedule_bp.route("/doctor/schedule/leaves", methods=["GET"])
@token_required
@role_required(["doctor"])
def get_leaves():
    doctor_id = request.user.get("doctor_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT leave_id, leave_date, block_type,
                   block_start, block_end, reason, created_at
            FROM doctor_leaves
            WHERE doctor_id = %s
              AND leave_date >= CURRENT_DATE
            ORDER BY leave_date ASC, block_start ASC
        """, (doctor_id,))
        rows = cur.fetchall()
        return jsonify([{
            "leave_id":    r[0],
            "leave_date":  str(r[1]),
            "block_type":  r[2],
            "block_start": str(r[3]) if r[3] else None,
            "block_end":   str(r[4]) if r[4] else None,
            "reason":      r[5],
            "created_at":  str(r[6])
        } for r in rows]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/doctor/schedule/calendar
# Returns per-day appointment counts + leave status
# for next 30 days — powers the calendar view
# ─────────────────────────────────────────
@schedule_bp.route("/doctor/schedule/calendar", methods=["GET"])
@token_required
@role_required(["doctor"])
def get_calendar():
    doctor_id = request.user.get("doctor_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        # Appointment counts per day (next 30 days)
        cur.execute("""
            SELECT DATE(appointment_date) AS appt_day,
                   COUNT(*) AS total,
                   SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                   SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
            FROM appointments
            WHERE doctor_id = %s
              AND DATE(appointment_date) BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
            GROUP BY DATE(appointment_date)
            ORDER BY appt_day ASC
        """, (doctor_id,))
        appt_rows = cur.fetchall()
        appt_map = {}
        for r in appt_rows:
            appt_map[str(r[0])] = {
                "total":     r[1],
                "scheduled": r[2],
                "completed": r[3],
                "cancelled": r[4]
            }

        # Leaves / blocks for next 30 days
        cur.execute("""
            SELECT leave_date, block_type, block_start, block_end, reason
            FROM doctor_leaves
            WHERE doctor_id = %s
              AND leave_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        """, (doctor_id,))
        leave_rows = cur.fetchall()
        leave_map = {}
        for r in leave_rows:
            d = str(r[0])
            if d not in leave_map:
                leave_map[d] = []
            leave_map[d].append({
                "block_type":  r[1],
                "block_start": str(r[2]) if r[2] else None,
                "block_end":   str(r[3]) if r[3] else None,
                "reason":      r[4]
            })

        # Build calendar days
        from datetime import timedelta
        today  = date.today()
        result = []
        for i in range(31):
            day = today + timedelta(days=i)
            day_str = str(day)
            blocks = leave_map.get(day_str, [])
            full_day_leave = any(b["block_type"] == "full_day" for b in blocks)
            result.append({
                "date":           day_str,
                "weekday":        day.strftime("%a"),
                "appointments":   appt_map.get(day_str, {"total": 0, "scheduled": 0, "completed": 0, "cancelled": 0}),
                "full_day_leave": full_day_leave,
                "blocks":         blocks
            })

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# GET /api/doctor/schedule/day/:date
# Returns full appointment list for a specific day
# ─────────────────────────────────────────
@schedule_bp.route("/doctor/schedule/day/<date_str>", methods=["GET"])
@token_required
@role_required(["doctor"])
def get_day_detail(date_str):
    doctor_id = request.user.get("doctor_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            SELECT a.appointment_id, a.appointment_date, a.status,
                   a.reason, a.patient_id,
                   p.first_name || ' ' || p.last_name AS patient_name,
                   p.phone, p.age_years,
                   COALESCE(t.name, 'In-Person') AS appointment_type
            FROM appointments a
            JOIN (
                SELECT patient_id,
                       first_name, last_name, phone,
                       EXTRACT(YEAR FROM AGE(date_of_birth))::int AS age_years
                FROM patients
            ) p ON a.patient_id = p.patient_id
            LEFT JOIN appointment_types t ON a.type_id = t.type_id
            WHERE a.doctor_id = %s
              AND DATE(a.appointment_date) = %s
            ORDER BY a.appointment_date ASC
        """, (doctor_id, date_str))
        rows = cur.fetchall()
        appointments = [{
            "appointment_id":   r[0],
            "appointment_date": str(r[1]),
            "status":           r[2],
            "reason":           r[3],
            "patient_id":       r[4],
            "patient_name":     r[5],
            "phone":            r[6],
            "age":              r[7],
            "appointment_type": r[8]
        } for r in rows]

        # Also get blocks for this day
        cur.execute("""
            SELECT leave_id, block_type, block_start, block_end, reason
            FROM doctor_leaves
            WHERE doctor_id = %s AND leave_date = %s
        """, (doctor_id, date_str))
        blocks = [{
            "leave_id":    r[0],
            "block_type":  r[1],
            "block_start": str(r[2]) if r[2] else None,
            "block_end":   str(r[3]) if r[3] else None,
            "reason":      r[4]
        } for r in cur.fetchall()]

        return jsonify({
            "date":         date_str,
            "appointments": appointments,
            "blocks":       blocks
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# POST /api/doctor/schedule/leave
# Add a full-day leave or hourly block
# ─────────────────────────────────────────
@schedule_bp.route("/doctor/schedule/leave", methods=["POST"])
@token_required
@role_required(["doctor"])
def add_leave():
    doctor_id  = request.user.get("doctor_id")
    data       = request.json
    leave_date = data.get("leave_date")
    block_type = data.get("block_type", "full_day")  # full_day | hourly
    reason     = data.get("reason", "").strip()
    block_start = data.get("block_start")  # "HH:MM" for hourly
    block_end   = data.get("block_end")    # "HH:MM" for hourly

    if not leave_date:
        return jsonify({"error": "leave_date required"}), 400
    if block_type not in ["full_day", "hourly"]:
        return jsonify({"error": "block_type must be full_day or hourly"}), 400
    if block_type == "hourly" and (not block_start or not block_end):
        return jsonify({"error": "block_start and block_end required for hourly blocks"}), 400
    if block_type == "hourly":
        # Validate end is strictly after start
        from datetime import time as dt_time
        try:
            bs_h, bs_m = int(block_start.split(":")[0]), int(block_start.split(":")[1])
            be_h, be_m = int(block_end.split(":")[0]),   int(block_end.split(":")[1])
            bs = dt_time(bs_h, bs_m)
            be = dt_time(be_h, be_m)
            if be <= bs:
                return jsonify({"error": f"End time ({block_end}) must be after start time ({block_start})"}), 400
        except Exception:
            return jsonify({"error": "Invalid time format. Use HH:MM"}), 400

    conn = get_db()
    cur  = conn.cursor()
    try:
        # Validate date is in future
        try:
            ld = datetime.strptime(leave_date, "%Y-%m-%d").date()
            if ld < date.today():
                return jsonify({"error": "Cannot add leave for a past date"}), 400
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

        # For full_day — check if already has a full day leave
        if block_type == "full_day":
            cur.execute("""
                SELECT COUNT(*) FROM doctor_leaves
                WHERE doctor_id = %s AND leave_date = %s AND block_type = 'full_day'
            """, (doctor_id, leave_date))
            if cur.fetchone()[0] > 0:
                return jsonify({"error": "Full day leave already exists for this date"}), 400

        cur.execute("""
            INSERT INTO doctor_leaves
            (doctor_id, leave_date, block_type, block_start, block_end, reason)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING leave_id
        """, (
            doctor_id, leave_date, block_type,
            block_start, block_end, reason or None
        ))
        leave_id = cur.fetchone()[0]
        conn.commit()

        return jsonify({
            "message":  "Leave added successfully",
            "leave_id": leave_id,
            "type":     "Full day leave" if block_type == "full_day" else f"Blocked {block_start}–{block_end}"
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────
# DELETE /api/doctor/schedule/leave/:leave_id
# Remove a leave or block
# ─────────────────────────────────────────
@schedule_bp.route("/doctor/schedule/leave/<int:leave_id>", methods=["DELETE"])
@token_required
@role_required(["doctor"])
def delete_leave(leave_id):
    doctor_id = request.user.get("doctor_id")
    conn = get_db()
    cur  = conn.cursor()
    try:
        cur.execute("""
            DELETE FROM doctor_leaves
            WHERE leave_id = %s AND doctor_id = %s
            RETURNING leave_id
        """, (leave_id, doctor_id))
        deleted = cur.fetchone()
        if not deleted:
            return jsonify({"error": "Leave not found or not yours"}), 404
        conn.commit()
        return jsonify({"message": "Leave removed"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close()
        conn.close()