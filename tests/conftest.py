import os
import sys
import time
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app import app as flask_app
from db import get_db


@pytest.fixture(scope="session")
def client():
    flask_app.config["TESTING"] = True
    return flask_app.test_client()


@pytest.fixture(scope="session")
def auth_header():
    def _make(token):
        return {"Authorization": f"Bearer {token}"}
    return _make


def _login(client, email, password):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    return res.get_json().get("token", "")


@pytest.fixture(scope="session")
def admin_token(client):
    return _login(client, "admin@medcore.ai", "admin123")


@pytest.fixture(scope="session")
def doctor_token(client):
    return _login(client, "doctor@medcore.ai", "admin123")


@pytest.fixture(scope="session")
def patient_token(client):
    return _login(client, "patient@medcore.ai", "admin123")


@pytest.fixture(scope="session")
def doctor_id(client, doctor_token, auth_header):
    res = client.get("/api/doctor/me", headers=auth_header(doctor_token))
    return res.get_json()["doctor_id"]


def _delete_patient(patient_id, email):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM clinical_notes WHERE patient_id = %s", (patient_id,))
        cur.execute("DELETE FROM appointments WHERE patient_id = %s", (patient_id,))
        cur.execute("DELETE FROM patients WHERE patient_id = %s", (patient_id,))
        cur.execute("DELETE FROM users WHERE email = %s", (email,))
        conn.commit()
    finally:
        cur.close()
        conn.close()


@pytest.fixture(scope="session")
def test_patient(client, auth_header):
    """
    Fresh throwaway patient signed up for CI, used by any test that writes
    clinical data (vitals/diagnosis/medication/allergy/blood-group/notes).
    Keeps those writes off the real demo accounts shown during reviews.

    Signup's FHIR Patient write is best-effort (the public HAPI test server
    is occasionally slow/unavailable — a known, documented risk for this
    project) and silently leaves fhir_id empty on failure. Diagnosis/
    medication/allergy all require a real fhir_id, so retry a few times
    rather than let third-party flakiness fail the suite.
    """
    last_attempt = None
    for attempt in range(3):
        # HAPI FHIR flags same-name+DOB+gender patients as duplicates (412) —
        # last_name must vary per attempt, not just email, or every retry
        # after the first would be rejected as a dupe of the earlier one.
        suffix = f"{int(time.time())}_{attempt}"
        email = f"ci_patient_{suffix}@medcore.ai"
        res = client.post("/api/auth/signup", json={
            "first_name":    "CI",
            "last_name":     f"TestPatient{suffix}",
            "email":         email,
            "password":      "citest1234",
            "date_of_birth": "1995-01-01",
            "gender":        "female",
            "phone":         "9999999999",
        })
        body = res.get_json()
        token = body.get("token", "")
        patient_id = body.get("patient_id")

        profile = client.get("/api/patients/me", headers=auth_header(token)).get_json()
        fhir_id = profile.get("fhir_id", "")

        if fhir_id:
            data = {"email": email, "token": token, "patient_id": patient_id, "fhir_id": fhir_id}
            yield data
            _delete_patient(patient_id, email)
            return

        if last_attempt:
            _delete_patient(*last_attempt)
        last_attempt = (patient_id, email)

    # All retries failed to get a real fhir_id from the FHIR server — clean up
    # the last attempt and yield it anyway so tests fail with a clear reason
    # instead of erroring, rather than block the whole suite on a flaky third party.
    data = {"email": last_attempt[1], "token": token, "patient_id": last_attempt[0], "fhir_id": ""}
    yield data
    _delete_patient(*last_attempt)
