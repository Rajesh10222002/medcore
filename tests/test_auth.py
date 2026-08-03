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
