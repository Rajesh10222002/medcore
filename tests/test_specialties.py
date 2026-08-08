from db import get_db


def test_admin_can_list_specialties(client, admin_token, auth_header):
    res = client.get("/api/admin/specialties", headers=auth_header(admin_token))
    assert res.status_code == 200
    body = res.get_json()
    assert isinstance(body, list) and len(body) > 0
    names = [s["name"] for s in body]
    assert "General Medicine" in names
    assert "Cardiology" in names


def test_doctor_can_list_specialties(client, doctor_token, auth_header):
    # Doctors need this list too — sourcing the "Refer to Specialist" specialty dropdown
    res = client.get("/api/admin/specialties", headers=auth_header(doctor_token))
    assert res.status_code == 200
    assert len(res.get_json()) > 0


def test_list_specialties_blocks_patient(client, patient_token, auth_header):
    res = client.get("/api/admin/specialties", headers=auth_header(patient_token))
    assert res.status_code == 403


def test_admin_create_specialty_missing_name_rejected(client, admin_token, auth_header):
    res = client.post("/api/admin/specialties", json={}, headers=auth_header(admin_token))
    assert res.status_code == 400


def test_admin_create_duplicate_specialty_rejected(client, admin_token, auth_header):
    res = client.post(
        "/api/admin/specialties",
        json={"name": "Cardiology"},
        headers=auth_header(admin_token),
    )
    assert res.status_code == 409


def test_admin_can_create_specialty(client, admin_token, auth_header):
    name = "CI Test Specialty"
    res = client.post(
        "/api/admin/specialties",
        json={"name": name, "description": "Created by CI"},
        headers=auth_header(admin_token),
    )
    assert res.status_code == 201
    specialty_id = res.get_json()["specialty_id"]

    try:
        list_res = client.get("/api/admin/specialties", headers=auth_header(admin_token))
        names = [s["name"] for s in list_res.get_json()]
        assert name in names
    finally:
        conn = get_db()
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM specialties WHERE specialty_id = %s", (specialty_id,))
            conn.commit()
        finally:
            cur.close()
            conn.close()


def test_create_specialty_requires_admin_role(client, doctor_token, patient_token, auth_header):
    for token in (doctor_token, patient_token):
        res = client.post(
            "/api/admin/specialties",
            json={"name": "Should Not Be Created"},
            headers=auth_header(token),
        )
        assert res.status_code == 403
