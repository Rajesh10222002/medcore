import time

from db import get_db


def test_admin_can_get_kpis(client, admin_token, auth_header):
    res = client.get("/api/admin/kpis", headers=auth_header(admin_token))
    assert res.status_code == 200
    data = res.get_json()
    assert "total_patients" in data
    assert "total_doctors" in data


def test_admin_kpis_are_numbers(client, admin_token, auth_header):
    res = client.get("/api/admin/kpis", headers=auth_header(admin_token))
    data = res.get_json()
    assert data["total_patients"] >= 0
    assert data["total_doctors"] >= 0


def test_admin_can_list_patients(client, admin_token, auth_header):
    res = client.get("/api/admin/patients", headers=auth_header(admin_token))
    assert res.status_code == 200
    body = res.get_json()
    assert isinstance(body["items"], list)
    assert "total" in body and "page" in body and "per_page" in body
    assert "stats" in body


def test_admin_patients_pagination(client, admin_token, auth_header):
    res = client.get("/api/admin/patients?page=1&per_page=5", headers=auth_header(admin_token))
    body = res.get_json()
    assert len(body["items"]) <= 5
    assert body["page"] == 1
    assert body["per_page"] == 5


def test_admin_patients_search_filters_results(client, admin_token, auth_header):
    res = client.get("/api/admin/patients?search=zzzz_no_such_patient", headers=auth_header(admin_token))
    body = res.get_json()
    assert body["items"] == []
    assert body["total"] == 0


def test_admin_can_view_patient_detail(client, admin_token, auth_header):
    list_res = client.get("/api/admin/patients?per_page=1", headers=auth_header(admin_token))
    patient_id = list_res.get_json()["items"][0]["patient_id"]

    res = client.get(f"/api/admin/patients/{patient_id}", headers=auth_header(admin_token))
    assert res.status_code == 200
    body = res.get_json()
    assert body["patient_id"] == patient_id
    assert "fhir" in body and "appointments" in body and "notes" in body


def test_admin_patient_detail_404_for_unknown_id(client, admin_token, auth_header):
    res = client.get("/api/admin/patients/999999999", headers=auth_header(admin_token))
    assert res.status_code == 404


def test_admin_can_list_doctors(client, admin_token, auth_header):
    res = client.get("/api/admin/doctors", headers=auth_header(admin_token))
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


def test_admin_can_view_doctor_detail(client, admin_token, auth_header):
    list_res = client.get("/api/admin/doctors", headers=auth_header(admin_token))
    doctor_id = list_res.get_json()[0]["doctor_id"]

    res = client.get(f"/api/admin/doctors/{doctor_id}", headers=auth_header(admin_token))
    assert res.status_code == 200
    body = res.get_json()
    assert body["doctor_id"] == doctor_id
    assert "schedule" in body and "stats" in body and "recent_appointments" in body


def test_admin_doctor_detail_404_for_unknown_id(client, admin_token, auth_header):
    res = client.get("/api/admin/doctors/999999999", headers=auth_header(admin_token))
    assert res.status_code == 404


def test_admin_can_list_appointments(client, admin_token, auth_header):
    res = client.get("/api/admin/appointments", headers=auth_header(admin_token))
    assert res.status_code == 200
    body = res.get_json()
    assert isinstance(body["items"], list)
    assert "total" in body and "stats" in body
    if body["items"]:
        assert "patient_id" in body["items"][0]
        assert "doctor_id" in body["items"][0]


def test_admin_appointments_status_filter(client, admin_token, auth_header):
    res = client.get("/api/admin/appointments?status=cancelled&per_page=50", headers=auth_header(admin_token))
    body = res.get_json()
    assert all(a["status"] == "cancelled" for a in body["items"])


def test_admin_create_doctor_missing_fields_rejected(client, admin_token, auth_header):
    res = client.post("/api/admin/doctors", json={}, headers=auth_header(admin_token))
    assert res.status_code == 400


def test_admin_can_create_and_view_doctor(client, admin_token, auth_header):
    email = f"ci_doctor_{int(time.time())}@medcore.ai"
    payload = {
        "first_name":      "CI",
        "last_name":       "TestDoctor",
        "email":           email,
        "password":        "citest1234",
        "specialization":  "General Medicine",
        "license_number":  "CI-TEST-0001",
        "phone":           "9999999998",
    }
    res = client.post("/api/admin/doctors", json=payload, headers=auth_header(admin_token))
    assert res.status_code == 201
    doctor_id = res.get_json()["doctor_id"]

    try:
        list_res = client.get("/api/admin/doctors", headers=auth_header(admin_token))
        ids = [d["doctor_id"] for d in list_res.get_json()]
        assert doctor_id in ids
    finally:
        # cleanup — an admin-visible junk doctor would be visible in reviewer demos
        conn = get_db()
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM doctor_schedules WHERE doctor_id = %s", (doctor_id,))
            cur.execute("DELETE FROM doctors WHERE doctor_id = %s", (doctor_id,))
            cur.execute("DELETE FROM users WHERE email = %s", (email,))
            conn.commit()
        finally:
            cur.close()
            conn.close()
