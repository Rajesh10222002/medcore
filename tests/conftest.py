"""
MedCore AI — Pytest configuration and shared fixtures
"""
import pytest
import json
import sys
import os

# Add backend to path so we can import the Flask app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import app as flask_app


@pytest.fixture(scope="session")
def app():
    """Create Flask test app — session scoped so it starts once"""
    flask_app.config.update({
        "TESTING":   True,
        "DEBUG":     False,
    })
    yield flask_app


@pytest.fixture(scope="session")
def client(app):
    """Flask test client — shared across all tests in the session"""
    return app.test_client()


# ── Demo credentials (seeded by seed_data.py) ────────────────────────────────
ADMIN_EMAIL    = "admin@medcore.ai"
ADMIN_PASSWORD = "admin123"

DOCTOR_EMAIL    = "doctor@medcore.ai"
DOCTOR_PASSWORD = "admin123"

PATIENT_EMAIL    = "patient@medcore.ai"
PATIENT_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def admin_token(client):
    """Log in as admin and return JWT token"""
    res = client.post("/api/auth/login", json={
        "email":    ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert res.status_code == 200, f"Admin login failed: {res.data}"
    return res.get_json()["token"]


@pytest.fixture(scope="session")
def doctor_token(client):
    """Log in as doctor and return JWT token"""
    res = client.post("/api/auth/login", json={
        "email":    DOCTOR_EMAIL,
        "password": DOCTOR_PASSWORD
    })
    assert res.status_code == 200, f"Doctor login failed: {res.data}"
    return res.get_json()["token"]


@pytest.fixture(scope="session")
def patient_token(client):
    """Log in as patient and return JWT token"""
    res = client.post("/api/auth/login", json={
        "email":    PATIENT_EMAIL,
        "password": PATIENT_PASSWORD
    })
    assert res.status_code == 200, f"Patient login failed: {res.data}"
    return res.get_json()["token"]


def auth_headers(token):
    """Helper — returns Authorization header dict"""
    return {"Authorization": f"Bearer {token}"}
