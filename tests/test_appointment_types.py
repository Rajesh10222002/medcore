import datetime

from db import get_db


def _next_weekday():
    day = datetime.date.today()
    while day.weekday() > 4:
        day += datetime.timedelta(days=1)
    return day.isoformat()


def _find_available_slot(client, headers, doctor_id):
    today = datetime.date.today()
    for offset in range(1, 60):
        day = today + datetime.timedelta(days=offset)
        if day.weekday() > 4:
            continue
        res = client.get(
            f"/api/appointments/slots?doctor_id={doctor_id}&date={day.isoformat()}",
            headers=headers,
        )
        for slot in res.get_json().get("slots", []):
            if slot["available"]:
                return slot["datetime"]
    return None


def test_get_appointment_types(client, patient_token, auth_header):
    res = client.get("/api/appointment-types", headers=auth_header(patient_token))
    assert res.status_code == 200
    body = res.get_json()
    names = [t["name"] for t in body]
    assert "In-Person" in names
    assert "Video Consultation" in names


def test_get_appointment_types_requires_auth(client):
    res = client.get("/api/appointment-types")
    assert res.status_code in (401, 403)


def test_book_appointment_with_video_type(client, patient_token, auth_header, doctor_id):
    headers = auth_header(patient_token)

    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("SELECT type_id FROM appointment_types WHERE name = 'Video Consultation'")
        video_type_id = cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()

    slot_dt = _find_available_slot(client, headers, doctor_id)
    assert slot_dt is not None

    res = client.post(
        "/api/appointments",
        json={
            "doctor_id": doctor_id,
            "appointment_date": slot_dt,
            "reason": "CI test video booking",
            "type_id": video_type_id,
        },
        headers=headers,
    )
    assert res.status_code == 201
    appt_id = res.get_json()["appointment_id"]

    try:
        list_res = client.get("/api/appointments/mine", headers=headers)
        booked = next(a for a in list_res.get_json() if a["appointment_id"] == appt_id)
        assert booked["appointment_type"] == "Video Consultation"
    finally:
        conn = get_db()
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM appointments WHERE appointment_id = %s", (appt_id,))
            conn.commit()
        finally:
            cur.close()
            conn.close()


def test_book_appointment_without_type_defaults_to_in_person(client, patient_token, auth_header, doctor_id):
    headers = auth_header(patient_token)
    slot_dt = _find_available_slot(client, headers, doctor_id)
    assert slot_dt is not None

    res = client.post(
        "/api/appointments",
        json={"doctor_id": doctor_id, "appointment_date": slot_dt, "reason": "CI test default type"},
        headers=headers,
    )
    assert res.status_code == 201
    appt_id = res.get_json()["appointment_id"]

    try:
        list_res = client.get("/api/appointments/mine", headers=headers)
        booked = next(a for a in list_res.get_json() if a["appointment_id"] == appt_id)
        assert booked["appointment_type"] == "In-Person"
    finally:
        conn = get_db()
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM appointments WHERE appointment_id = %s", (appt_id,))
            conn.commit()
        finally:
            cur.close()
            conn.close()
