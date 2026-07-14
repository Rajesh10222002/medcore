"""
MedCore AI — Patient route tests
Tests: GET /api/patients/me, GET /api/patients/me/fhir
"""
import pytest
from tests.conftest import auth_headers


class TestPatientProfile:
    """Tests for GET /api/patients/me"""

    def test_get_my_profile_success(self, client, patient_token):
        """Patient can fetch their own profile"""
        res = client.get(
            "/api/patients/me",
            headers=auth_headers(patient_token)
        )
        assert res.status_code == 200
        data = res.get_json()
        assert "first_name" in data
        assert "last_name"  in data
        assert "email"      in data

    def test_get_profile_without_token_rejected(self, client):
        """Cannot access patient profile without token"""
        res = client.get("/api/patients/me")
        assert res.status_code in [401, 403]

    def test_doctor_cannot_access_patient_me(self, client, doctor_token):
        """Doctor cannot access patient-only /patients/me endpoint"""
        res = client.get(
            "/api/patients/me",
            headers=auth_headers(doctor_token)
        )
        assert res.status_code in [401, 403]

    def test_admin_cannot_access_patient_me(self, client, admin_token):
        """Admin cannot access patient-only /patients/me endpoint"""
        res = client.get(
            "/api/patients/me",
            headers=auth_headers(admin_token)
        )
        assert res.status_code in [401, 403]

    def test_profile_contains_correct_email(self, client, patient_token):
        """Patient profile email matches login email"""
        res = client.get(
            "/api/patients/me",
            headers=auth_headers(patient_token)
        )
        data = res.get_json()
        assert data["email"] == "patient@medcore.ai"


class TestPatientFHIR:
    """Tests for GET /api/patients/me/fhir"""

    def test_get_fhir_success(self, client, patient_token):
        """Patient can fetch their FHIR clinical data"""
        res = client.get(
            "/api/patients/me/fhir",
            headers=auth_headers(patient_token)
        )
        assert res.status_code == 200
        data = res.get_json()
        # Must contain all 4 FHIR resource lists
        assert "conditions"   in data
        assert "medications"  in data
        assert "observations" in data
        assert "allergies"    in data

    def test_fhir_returns_lists(self, client, patient_token):
        """FHIR response fields are lists not None"""
        res = client.get(
            "/api/patients/me/fhir",
            headers=auth_headers(patient_token)
        )
        data = res.get_json()
        assert isinstance(data["conditions"],   list)
        assert isinstance(data["medications"],  list)
        assert isinstance(data["observations"], list)
        assert isinstance(data["allergies"],    list)

    def test_fhir_contains_blood_group_field(self, client, patient_token):
        """FHIR response includes blood_group field (may be null if not set)"""
        res = client.get(
            "/api/patients/me/fhir",
            headers=auth_headers(patient_token)
        )
        data = res.get_json()
        assert "blood_group" in data

    def test_fhir_without_token_rejected(self, client):
        """Cannot access FHIR data without token"""
        res = client.get("/api/patients/me/fhir")
        assert res.status_code in [401, 403]

    def test_doctor_cannot_access_patient_fhir(self, client, doctor_token):
        """Doctor cannot access patient-only FHIR endpoint"""
        res = client.get(
            "/api/patients/me/fhir",
            headers=auth_headers(doctor_token)
        )
        assert res.status_code in [401, 403]
