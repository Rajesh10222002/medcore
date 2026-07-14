"""
MedCore AI — Doctor route tests
Tests: GET /api/doctor/me, GET /api/doctor/patients,
       GET /api/doctor/patients/:id, GET /api/doctors
"""
import pytest
from tests.conftest import auth_headers


class TestDoctorProfile:
    """Tests for GET /api/doctor/me"""

    def test_doctor_can_get_own_profile(self, client, doctor_token):
        """Doctor can fetch their own profile"""
        res = client.get(
            "/api/doctor/me",
            headers=auth_headers(doctor_token)
        )
        assert res.status_code == 200
        data = res.get_json()
        assert "first_name"      in data
        assert "last_name"       in data
        assert "specialization"  in data

    def test_patient_cannot_access_doctor_profile(self, client, patient_token):
        """Patient cannot access doctor-only profile endpoint"""
        res = client.get(
            "/api/doctor/me",
            headers=auth_headers(patient_token)
        )
        assert res.status_code in [401, 403]

    def test_no_token_rejected(self, client):
        """Cannot access doctor profile without token"""
        res = client.get("/api/doctor/me")
        assert res.status_code in [401, 403]


class TestDoctorPatients:
    """Tests for GET /api/doctor/patients"""

    def test_doctor_can_list_patients(self, client, doctor_token):
        """Doctor can fetch their patient list"""
        res = client.get(
            "/api/doctor/patients",
            headers=auth_headers(doctor_token)
        )
        assert res.status_code == 200
        assert isinstance(res.get_json(), list)

    def test_patient_list_has_required_fields(self, client, doctor_token):
        """Patient list items contain expected fields"""
        res = client.get(
            "/api/doctor/patients",
            headers=auth_headers(doctor_token)
        )
        data = res.get_json()
        if len(data) > 0:
            patient = data[0]
            assert "patient_id"  in patient
            assert "first_name"  in patient
            assert "last_name"   in patient

    def test_patient_cannot_list_doctor_patients(self, client, patient_token):
        """Patient cannot access doctor patient list"""
        res = client.get(
            "/api/doctor/patients",
            headers=auth_headers(patient_token)
        )
        assert res.status_code in [401, 403]

    def test_admin_cannot_list_doctor_patients(self, client, admin_token):
        """Admin cannot access doctor patient list"""
        res = client.get(
            "/api/doctor/patients",
            headers=auth_headers(admin_token)
        )
        assert res.status_code in [401, 403]


class TestDoctorPatientDetail:
    """Tests for GET /api/doctor/patients/:id"""

    def test_doctor_can_get_patient_detail(self, client, doctor_token):
        """Doctor can get full details of a specific patient"""
        # First get list to find a valid patient_id
        list_res = client.get(
            "/api/doctor/patients",
            headers=auth_headers(doctor_token)
        )
        patients = list_res.get_json()
        if len(patients) == 0:
            pytest.skip("No patients available for doctor")

        patient_id = patients[0]["patient_id"]
        res = client.get(
            f"/api/doctor/patients/{patient_id}",
            headers=auth_headers(doctor_token)
        )
        assert res.status_code == 200
        data = res.get_json()
        assert "fhir" in data or "patient_id" in data

    def test_nonexistent_patient_returns_404(self, client, doctor_token):
        """Requesting a non-existent patient returns 404"""
        res = client.get(
            "/api/doctor/patients/999999",
            headers=auth_headers(doctor_token)
        )
        assert res.status_code in [404, 400]

    def test_patient_cannot_view_other_patient(self, client, patient_token):
        """Patient cannot access doctor patient detail endpoint"""
        res = client.get(
            "/api/doctor/patients/1",
            headers=auth_headers(patient_token)
        )
        assert res.status_code in [401, 403]


class TestPublicDoctorList:
    """Tests for GET /api/doctors"""

    def test_patient_can_get_doctors_list(self, client, patient_token):
        """Patient can get doctor list for booking"""
        res = client.get(
            "/api/doctors",
            headers=auth_headers(patient_token)
        )
        assert res.status_code == 200
        assert isinstance(res.get_json(), list)

    def test_doctors_list_has_required_fields(self, client, patient_token):
        """Doctor list items contain required fields"""
        res = client.get(
            "/api/doctors",
            headers=auth_headers(patient_token)
        )
        data = res.get_json()
        if len(data) > 0:
            doc = data[0]
            assert "doctor_id"     in doc
            assert "first_name"    in doc
            assert "specialization" in doc

    def test_no_token_rejected(self, client):
        """Cannot get doctor list without token"""
        res = client.get("/api/doctors")
        assert res.status_code in [401, 403]
