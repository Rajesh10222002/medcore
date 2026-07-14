"""
MedCore AI — Auth route tests
Tests: POST /api/auth/login, POST /api/auth/signup
"""
import pytest
import uuid
from tests.conftest import auth_headers


class TestLogin:
    """Tests for POST /api/auth/login"""

    def test_admin_login_success(self, client):
        """Admin can log in with correct credentials"""
        res = client.post("/api/auth/login", json={
            "email":    "admin@medcore.ai",
            "password": "admin123"
        })
        assert res.status_code == 200
        data = res.get_json()
        assert "token" in data
        assert data["role"] == "admin"

    def test_doctor_login_success(self, client):
        """Doctor can log in with correct credentials"""
        res = client.post("/api/auth/login", json={
            "email":    "doctor@medcore.ai",
            "password": "admin123"
        })
        assert res.status_code == 200
        data = res.get_json()
        assert "token" in data
        assert data["role"] == "doctor"

    def test_patient_login_success(self, client):
        """Patient can log in with correct credentials"""
        res = client.post("/api/auth/login", json={
            "email":    "patient@medcore.ai",
            "password": "admin123"
        })
        assert res.status_code == 200
        data = res.get_json()
        assert "token" in data
        assert data["role"] == "patient"

    def test_wrong_password_rejected(self, client):
        """Login fails with wrong password"""
        res = client.post("/api/auth/login", json={
            "email":    "admin@medcore.ai",
            "password": "wrongpassword"
        })
        assert res.status_code in [401, 400]

    def test_unknown_email_rejected(self, client):
        """Login fails with non-existent email"""
        res = client.post("/api/auth/login", json={
            "email":    "nobody@medcore.ai",
            "password": "admin123"
        })
        assert res.status_code in [401, 404, 400]

    def test_missing_email_rejected(self, client):
        """Login fails when email field is missing"""
        res = client.post("/api/auth/login", json={
            "password": "admin123"
        })
        assert res.status_code in [400, 422]

    def test_missing_password_rejected(self, client):
        """Login fails when password field is missing"""
        res = client.post("/api/auth/login", json={
            "email": "admin@medcore.ai"
        })
        assert res.status_code in [400, 422]

    def test_token_is_string(self, client):
        """Token returned must be a non-empty string"""
        res = client.post("/api/auth/login", json={
            "email":    "admin@medcore.ai",
            "password": "admin123"
        })
        token = res.get_json().get("token", "")
        assert isinstance(token, str)
        assert len(token) > 20

    def test_login_returns_name(self, client):
        """Login response includes user's name"""
        res = client.post("/api/auth/login", json={
            "email":    "patient@medcore.ai",
            "password": "admin123"
        })
        data = res.get_json()
        assert "name" in data
        assert len(data["name"]) > 0


class TestSignup:
    """Tests for POST /api/auth/signup"""

    def test_signup_success(self, client):
        """New patient can register successfully"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        res = client.post("/api/auth/signup", json={
            "first_name":    "Test",
            "last_name":     "Patient",
            "email":         unique_email,
            "password":      "Test@1234",
            "date_of_birth": "1995-06-15",
            "gender":        "male",
            "phone":         "+91 9000000001"
        })
        assert res.status_code in [200, 201]
        data = res.get_json()
        assert "token" in data
        assert data["role"] == "patient"

    def test_duplicate_email_rejected(self, client):
        """Cannot register with an email that already exists"""
        res = client.post("/api/auth/signup", json={
            "first_name":    "Duplicate",
            "last_name":     "User",
            "email":         "patient@medcore.ai",
            "password":      "Test@1234",
            "date_of_birth": "1990-01-01",
            "gender":        "female",
            "phone":         "+91 9000000002"
        })
        assert res.status_code in [400, 409, 422]

    def test_missing_required_field_rejected(self, client):
        """Signup fails when required field is missing"""
        res = client.post("/api/auth/signup", json={
            "first_name": "No",
            "last_name":  "Email"
            # email missing
        })
        assert res.status_code in [400, 422]

    def test_signup_no_blood_group_at_registration(self, client):
        """Blood group is NOT collected at signup — clinical data only"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        res = client.post("/api/auth/signup", json={
            "first_name":    "NoBG",
            "last_name":     "Test",
            "email":         unique_email,
            "password":      "Test@1234",
            "date_of_birth": "1998-03-10",
            "gender":        "male",
            "phone":         "+91 9000000003"
        })
        # Should succeed without blood_group
        assert res.status_code in [200, 201]
