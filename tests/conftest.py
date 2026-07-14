import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import app as flask_app

@pytest.fixture(scope="session")
def client():
    flask_app.config["TESTING"] = True
    return flask_app.test_client()

def get_token(client, email, password):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    return res.get_json().get("token", "")

@pytest.fixture(scope="session")
def admin_token(client):
    return get_token(client, "admin@medcore.ai", "admin123")

@pytest.fixture(scope="session")
def doctor_token(client):
    return get_token(client, "doctor@medcore.ai", "admin123")

@pytest.fixture(scope="session")
def patient_token(client):
    return get_token(client, "patient@medcore.ai", "admin123")