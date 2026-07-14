"""
MedCore AI — Minimal Pytest Suite
Covers: Auth, RBAC, Patient, Doctor, Admin routes
Impact pSiddhi 3.0 · S4-I-07 · Rajesh Natarajan (P396)
"""

def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── Auth tests ────────────────────────────────────────────────────────────────

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
    assert res.status_code in [400, 401]

def test_unknown_email_rejected(client):
    res = client.post("/api/auth/login", json={"email": "nobody@medcore.ai", "password": "admin123"})
    assert res.status_code in [400, 401, 404]

def test_login_returns_token(client):
    res = client.post("/api/auth/login", json={"email": "admin@medcore.ai", "password": "admin123"})
    assert "token" in res.get_json()


# ── RBAC boundary tests ───────────────────────────────────────────────────────

def test_no_token_blocked(client):
    res = client.get("/api/patients/me")
    assert res.status_code in [401, 403]

def test_invalid_token_blocked(client):
    res = client.get("/api/patients/me", headers={"Authorization": "Bearer fake.token"})
    assert res.status_code in [401, 403]

def test_patient_blocked_from_admin(client, patient_token):
    res = client.get("/api/admin/kpis", headers=auth(patient_token))
    assert res.status_code in [401, 403]

def test_doctor_blocked_from_patient_me(client, doctor_token):
    res = client.get("/api/patients/me", headers=auth(doctor_token))
    assert res.status_code in [401, 403]

def test_patient_blocked_from_doctor_patients(client, patient_token):
    res = client.get("/api/doctor/patients", headers=auth(patient_token))
    assert res.status_code in [401, 403]


# ── Patient route tests ───────────────────────────────────────────────────────

def test_patient_can_get_profile(client, patient_token):
    res = client.get("/api/patients/me", headers=auth(patient_token))
    assert res.status_code == 200
    data = res.get_json()
    assert "first_name" in data
    assert "email" in data

def test_patient_profile_email_correct(client, patient_token):
    res = client.get("/api/patients/me", headers=auth(patient_token))
    assert res.get_json()["email"] == "patient@medcore.ai"

def test_patient_can_get_appointments(client, patient_token):
    res = client.get("/api/appointments/mine", headers=auth(patient_token))
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)

def test_patient_can_get_doctors(client, patient_token):
    res = client.get("/api/doctors", headers=auth(patient_token))
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


# ── Doctor route tests ────────────────────────────────────────────────────────

def test_doctor_can_get_profile(client, doctor_token):
    res = client.get("/api/doctor/me", headers=auth(doctor_token))
    assert res.status_code == 200
    data = res.get_json()
    assert "first_name" in data
    assert "specialization" in data

def test_doctor_can_list_patients(client, doctor_token):
    res = client.get("/api/doctor/patients", headers=auth(doctor_token))
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


# ── Admin route tests ─────────────────────────────────────────────────────────

def test_admin_can_get_kpis(client, admin_token):
    res = client.get("/api/admin/kpis", headers=auth(admin_token))
    assert res.status_code == 200
    data = res.get_json()
    assert "total_patients" in data
    assert "total_doctors" in data
    assert "total_appointments" in data

def test_admin_kpis_are_numbers(client, admin_token):
    res = client.get("/api/admin/kpis", headers=auth(admin_token))
    data = res.get_json()
    assert data["total_patients"] >= 0
    assert data["total_doctors"] >= 0

def test_admin_can_list_patients(client, admin_token):
    res = client.get("/api/admin/patients", headers=auth(admin_token))
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)

def test_admin_can_list_doctors(client, admin_token):
    res = client.get("/api/admin/doctors", headers=auth(admin_token))
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)

def test_admin_can_list_appointments(client, admin_token):
    res = client.get("/api/admin/appointments", headers=auth(admin_token))
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)