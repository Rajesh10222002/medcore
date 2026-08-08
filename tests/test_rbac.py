def test_no_token_blocked(client):
    res = client.get("/api/patients/me")
    assert res.status_code in (401, 403)


def test_invalid_token_blocked(client):
    res = client.get("/api/patients/me", headers={"Authorization": "Bearer fake.token"})
    assert res.status_code in (401, 403)


def test_patient_blocked_from_admin(client, patient_token, auth_header):
    res = client.get("/api/admin/kpis", headers=auth_header(patient_token))
    assert res.status_code in (401, 403)


def test_doctor_blocked_from_patient_me(client, doctor_token, auth_header):
    res = client.get("/api/patients/me", headers=auth_header(doctor_token))
    assert res.status_code in (401, 403)


def test_patient_blocked_from_doctor_patients(client, patient_token, auth_header):
    res = client.get("/api/doctor/patients", headers=auth_header(patient_token))
    assert res.status_code in (401, 403)


def test_patient_blocked_from_schedule(client, patient_token, auth_header):
    res = client.get("/api/doctor/schedule/calendar", headers=auth_header(patient_token))
    assert res.status_code in (401, 403)


def test_doctor_blocked_from_admin_doctors_list(client, doctor_token, auth_header):
    res = client.get("/api/admin/doctors", headers=auth_header(doctor_token))
    assert res.status_code in (401, 403)


def test_patient_blocked_from_admin_create_doctor(client, patient_token, auth_header):
    res = client.post("/api/admin/doctors", json={}, headers=auth_header(patient_token))
    assert res.status_code in (401, 403)


def test_patient_blocked_from_writing_vitals(client, patient_token, auth_header):
    res = client.post("/api/doctor/vitals/1", json={"heart_rate": 80}, headers=auth_header(patient_token))
    assert res.status_code in (401, 403)


def test_admin_blocked_from_patient_appointments(client, admin_token, auth_header):
    res = client.get("/api/appointments/mine", headers=auth_header(admin_token))
    assert res.status_code in (401, 403)


def test_doctor_blocked_from_booking_appointment(client, doctor_token, auth_header):
    res = client.post("/api/appointments", json={}, headers=auth_header(doctor_token))
    assert res.status_code in (401, 403)


def test_doctor_blocked_from_admin_patient_detail(client, doctor_token, auth_header):
    res = client.get("/api/admin/patients/1", headers=auth_header(doctor_token))
    assert res.status_code in (401, 403)


def test_patient_blocked_from_admin_doctor_detail(client, patient_token, auth_header):
    res = client.get("/api/admin/doctors/1", headers=auth_header(patient_token))
    assert res.status_code in (401, 403)
