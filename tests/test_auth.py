import time


def test_admin_login(client):
    res = client.post("/api/auth/login", json={"email": "admin@medcore.ai", "password": "admin123"})
    assert res.status_code == 200
    assert res.get_json()["role"] == "admin"


def test_doctor_login(client):
    res = client.post("/api/auth/login", json={"email": "doctor@medcore.ai", "password": "admin123"})
    assert res.status_code == 200
    assert res.get_json()["role"] == "doctor"


def test_patient_login(client):
    res = client.post("/api/auth/login", json={"email": "patient@medcore.ai", "password": "admin123"})
    assert res.status_code == 200
    assert res.get_json()["role"] == "patient"


def test_wrong_password_rejected(client):
    res = client.post("/api/auth/login", json={"email": "admin@medcore.ai", "password": "wrong"})
    assert res.status_code in (400, 401)


def test_login_missing_fields_rejected(client):
    res = client.post("/api/auth/login", json={"email": "admin@medcore.ai"})
    assert res.status_code == 400


def test_login_unknown_email_rejected(client):
    res = client.post("/api/auth/login", json={"email": "nobody@medcore.ai", "password": "whatever"})
    assert res.status_code == 401


def test_signup_creates_patient(client):
    suffix = int(time.time())
    email = f"ci_signup_{suffix}@medcore.ai"
    res = client.post("/api/auth/signup", json={
        "first_name":    "Signup",
        "last_name":     f"Test{suffix}",
        "email":         email,
        "password":      "citest1234",
        "date_of_birth": "1990-05-05",
        "gender":        "male",
        "phone":         "9998887777",
    })
    assert res.status_code == 201
    body = res.get_json()
    assert body["role"] == "patient"
    assert "token" in body and body["token"]

    # cleanup — don't leave junk patients in the demo dataset
    from db import get_db
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM patients WHERE email = %s", (email,))
        cur.execute("DELETE FROM users WHERE email = %s", (email,))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def test_signup_missing_fields_rejected(client):
    res = client.post("/api/auth/signup", json={"email": "incomplete@medcore.ai"})
    assert res.status_code == 400


def test_signup_short_password_rejected(client):
    res = client.post("/api/auth/signup", json={
        "first_name":    "Short",
        "last_name":     "Pw",
        "email":         f"ci_shortpw_{int(time.time())}@medcore.ai",
        "password":      "short",
        "date_of_birth": "1990-01-01",
        "gender":        "male",
        "phone":         "9998887777",
    })
    assert res.status_code == 400


def test_signup_duplicate_email_rejected(client):
    res = client.post("/api/auth/signup", json={
        "first_name":    "Dup",
        "last_name":     "Patient",
        "email":         "patient@medcore.ai",
        "password":      "citest1234",
        "date_of_birth": "1990-01-01",
        "gender":        "male",
        "phone":         "9998887777",
    })
    assert res.status_code == 409


def test_change_password_requires_auth(client):
    res = client.put("/api/auth/change-password", json={
        "current_password": "x", "new_password": "y" * 10
    })
    assert res.status_code in (401, 403)


def test_change_password_wrong_current_rejected(client, test_patient, auth_header):
    res = client.put(
        "/api/auth/change-password",
        json={"current_password": "wrongpassword", "new_password": "newpassword123"},
        headers=auth_header(test_patient["token"]),
    )
    assert res.status_code == 401


def test_change_password_too_short_rejected(client, test_patient, auth_header):
    res = client.put(
        "/api/auth/change-password",
        json={"current_password": "citest1234", "new_password": "short"},
        headers=auth_header(test_patient["token"]),
    )
    assert res.status_code == 400


def test_change_password_success_round_trip(client, test_patient, auth_header):
    headers = auth_header(test_patient["token"])

    res = client.put(
        "/api/auth/change-password",
        json={"current_password": "citest1234", "new_password": "newpassword123"},
        headers=headers,
    )
    assert res.status_code == 200

    login_new = client.post("/api/auth/login", json={
        "email": test_patient["email"], "password": "newpassword123"
    })
    assert login_new.status_code == 200

    # revert so the fixture's known password stays valid for any later use
    revert = client.put(
        "/api/auth/change-password",
        json={"current_password": "newpassword123", "new_password": "citest1234"},
        headers=headers,
    )
    assert revert.status_code == 200
