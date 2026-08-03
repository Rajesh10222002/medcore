import datetime

from db import get_db


def _find_available_slot(client, headers, doctor_id):
    """Scan forward for the next weekday slot the seeded Mon-Fri schedule offers."""
    today = datetime.date.today()
    for offset in range(1, 60):
        day = today + datetime.timedelta(days=offset)
        if day.weekday() > 4:
            continue
        res = client.get(
            f"/api/appointments/slots?doctor_id={doctor_id}&date={day.isoformat()}",
            headers=headers,
        )
        data = res.get_json()
        for slot in data.get("slots", []):
            if slot["available"]:
                return slot["datetime"]
    return None


def _next_weekday():
    day = datetime.date.today()
    while day.weekday() > 4:
        day += datetime.timedelta(days=1)
    return day.isoformat()


def test_slots_endpoint_returns_structure(client, patient_token, auth_header, doctor_id):
    res = client.get(
        f"/api/appointments/slots?doctor_id={doctor_id}&date={_next_weekday()}",
        headers=auth_header(patient_token),
    )
    assert res.status_code == 200
    body = res.get_json()
    assert "slots" in body
    assert body["doctor_id"] == str(doctor_id)


def test_slots_endpoint_requires_params(client, patient_token, auth_header):
    res = client.get("/api/appointments/slots", headers=auth_header(patient_token))
    assert res.status_code == 400


def test_book_appointment_missing_fields_rejected(client, patient_token, auth_header):
    res = client.post("/api/appointments", json={}, headers=auth_header(patient_token))
    assert res.status_code == 400


def test_book_then_cancel_appointment_flow(client, patient_token, auth_header, doctor_id):
    headers = auth_header(patient_token)
    slot_dt = _find_available_slot(client, headers, doctor_id)
    assert slot_dt is not None, "No available slot found for doctor in next 60 days"

    book_res = client.post(
        "/api/appointments",
        json={"doctor_id": doctor_id, "appointment_date": slot_dt, "reason": "CI test booking"},
        headers=headers,
    )
    assert book_res.status_code == 201
    appt_id = book_res.get_json()["appointment_id"]

    try:
        cancel_res = client.put(f"/api/appointments/{appt_id}/cancel", headers=headers)
        assert cancel_res.status_code == 200

        recancel_res = client.put(f"/api/appointments/{appt_id}/cancel", headers=headers)
        assert recancel_res.status_code == 400
    finally:
        # cleanup — keep admin KPI counts from drifting across CI runs
        conn = get_db()
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM appointments WHERE appointment_id = %s", (appt_id,))
            conn.commit()
        finally:
            cur.close()
            conn.close()
