from db import get_db


def _create_appointment(patient_id, doctor_id, status="completed"):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO appointments (patient_id, doctor_id, appointment_date, status, reason, no_show_risk)
            VALUES (%s, %s, NOW() - INTERVAL '1 day', %s, 'CI test appointment', 10.0)
            RETURNING appointment_id
            """,
            (patient_id, doctor_id, status),
        )
        appointment_id = cur.fetchone()[0]
        conn.commit()
        return appointment_id
    finally:
        cur.close()
        conn.close()


def _cleanup(appointment_id):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM patient_feedback WHERE appointment_id = %s", (appointment_id,))
        cur.execute("DELETE FROM appointments WHERE appointment_id = %s", (appointment_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def test_submit_feedback_requires_completed_status(client, test_patient, doctor_id, auth_header):
    appt_id = _create_appointment(test_patient["patient_id"], doctor_id, status="scheduled")
    try:
        res = client.post(
            f"/api/patients/appointments/{appt_id}/feedback",
            json={"rating": 5, "comment": "too soon"},
            headers=auth_header(test_patient["token"]),
        )
        assert res.status_code == 400
    finally:
        _cleanup(appt_id)


def test_submit_feedback_invalid_rating_rejected(client, test_patient, doctor_id, auth_header):
    appt_id = _create_appointment(test_patient["patient_id"], doctor_id, status="completed")
    headers = auth_header(test_patient["token"])
    try:
        res = client.post(
            f"/api/patients/appointments/{appt_id}/feedback",
            json={"rating": 6, "comment": "out of range"},
            headers=headers,
        )
        assert res.status_code == 400
    finally:
        _cleanup(appt_id)


def test_submit_feedback_success_and_visible_to_doctor_and_admin(
    client, test_patient, doctor_id, doctor_token, admin_token, auth_header
):
    appt_id = _create_appointment(test_patient["patient_id"], doctor_id, status="completed")
    patient_headers = auth_header(test_patient["token"])
    try:
        res = client.post(
            f"/api/patients/appointments/{appt_id}/feedback",
            json={"rating": 5, "comment": "CI test — excellent visit"},
            headers=patient_headers,
        )
        assert res.status_code == 201

        # Duplicate submission rejected
        dup_res = client.post(
            f"/api/patients/appointments/{appt_id}/feedback",
            json={"rating": 4},
            headers=patient_headers,
        )
        assert dup_res.status_code == 409

        # Doctor sees it on their own feedback view
        doctor_res = client.get("/api/doctor/me/feedback", headers=auth_header(doctor_token))
        assert doctor_res.status_code == 200
        doctor_body = doctor_res.get_json()
        assert doctor_body["feedback_count"] >= 1
        assert any(f["comment"] == "CI test — excellent visit" for f in doctor_body["feedback"])

        # Admin sees it on the doctor detail feedback view
        admin_res = client.get(f"/api/admin/doctors/{doctor_id}/feedback", headers=auth_header(admin_token))
        assert admin_res.status_code == 200
        admin_body = admin_res.get_json()
        assert admin_body["feedback_count"] >= 1
    finally:
        _cleanup(appt_id)


def test_feedback_requires_patient_role(client, doctor_token, admin_token, auth_header, test_patient, doctor_id):
    appt_id = _create_appointment(test_patient["patient_id"], doctor_id, status="completed")
    try:
        for token in (doctor_token, admin_token):
            res = client.post(
                f"/api/patients/appointments/{appt_id}/feedback",
                json={"rating": 5},
                headers=auth_header(token),
            )
            assert res.status_code == 403
    finally:
        _cleanup(appt_id)


def test_doctor_feedback_requires_doctor_role(client, patient_token, admin_token, auth_header):
    for token in (patient_token, admin_token):
        res = client.get("/api/doctor/me/feedback", headers=auth_header(token))
        assert res.status_code == 403
