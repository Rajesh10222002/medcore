"""
MedCore AI — Admin route tests
Tests: GET /api/admin/kpis, GET /api/admin/patients,
       GET /api/admin/doctors, GET /api/admin/appointments
"""
import pytest
from tests.conftest import auth_headers


class TestAdminKPIs:
    """Tests for GET /api/admin/kpis"""

    def test_admin_can_get_kpis(self, client, admin_token):
        """Admin can fetch system KPIs"""
        res = client.get(
            "/api/admin/kpis",
            headers=auth_headers(admin_token)
        )
        assert res.status_code == 200
        data = res.get_json()
        assert "total_patients"     in data
        assert "total_doctors"      in data
        assert "total_appointments" in data

    def test_kpis_are_numbers(self, client, admin_token):
        """KPI values are non-negative numbers"""
        res = client.get(
            "/api/admin/kpis",
            headers=auth_headers(admin_token)
        )
        data = res.get_json()
        assert data["total_patients"]     >= 0
        assert data["total_doctors"]      >= 0
        assert data["total_appointments"] >= 0

    def test_patient_cannot_access_kpis(self, client, patient_token):
        """Patient cannot access admin KPIs"""
        res = client.get(
            "/api/admin/kpis",
            headers=auth_headers(patient_token)
        )
        assert res.status_code in [401, 403]

    def test_doctor_cannot_access_kpis(self, client, doctor_token):
        """Doctor cannot access admin KPIs"""
        res = client.get(
            "/api/admin/kpis",
            headers=auth_headers(doctor_token)
        )
        assert res.status_code in [401, 403]

    def test_no_token_rejected(self, client):
        """Cannot access KPIs without token"""
        res = client.get("/api/admin/kpis")
        assert res.status_code in [401, 403]


class TestAdminPatients:
    """Tests for GET /api/admin/patients"""

    def test_admin_can_list_all_patients(self, client, admin_token):
        """Admin can fetch all patients"""
        res = client.get(
            "/api/admin/patients",
            headers=auth_headers(admin_token)
        )
        assert res.status_code == 200
        assert isinstance(res.get_json(), list)

    def test_all_patients_have_required_fields(self, client, admin_token):
        """Each patient in admin list has required fields"""
        res = client.get(
            "/api/admin/patients",
            headers=auth_headers(admin_token)
        )
        data = res.get_json()
        if len(data) > 0:
            p = data[0]
            assert "patient_id"  in p
            assert "first_name"  in p
            assert "last_name"   in p
            assert "email"       in p
            assert "gender"      in p

    def test_patient_count_matches_kpi(self, client, admin_token):
        """Patient list count matches KPI total_patients"""
        kpi_res  = client.get("/api/admin/kpis",     headers=auth_headers(admin_token))
        list_res = client.get("/api/admin/patients",  headers=auth_headers(admin_token))
        kpi_count  = kpi_res.get_json()["total_patients"]
        list_count = len(list_res.get_json())
        assert list_count == kpi_count

    def test_non_admin_cannot_list_all_patients(self, client, patient_token):
        """Non-admin cannot access all patients list"""
        res = client.get(
            "/api/admin/patients",
            headers=auth_headers(patient_token)
        )
        assert res.status_code in [401, 403]


class TestAdminDoctors:
    """Tests for GET /api/admin/doctors"""

    def test_admin_can_list_all_doctors(self, client, admin_token):
        """Admin can fetch all doctors"""
        res = client.get(
            "/api/admin/doctors",
            headers=auth_headers(admin_token)
        )
        assert res.status_code == 200
        assert isinstance(res.get_json(), list)

    def test_all_doctors_have_required_fields(self, client, admin_token):
        """Each doctor in admin list has required fields"""
        res = client.get(
            "/api/admin/doctors",
            headers=auth_headers(admin_token)
        )
        data = res.get_json()
        if len(data) > 0:
            d = data[0]
            assert "doctor_id"      in d
            assert "first_name"     in d
            assert "specialization" in d

    def test_non_admin_cannot_list_all_doctors(self, client, doctor_token):
        """Non-admin cannot access all doctors list"""
        res = client.get(
            "/api/admin/doctors",
            headers=auth_headers(doctor_token)
        )
        assert res.status_code in [401, 403]


class TestAdminAppointments:
    """Tests for GET /api/admin/appointments"""

    def test_admin_can_list_all_appointments(self, client, admin_token):
        """Admin can fetch all appointments"""
        res = client.get(
            "/api/admin/appointments",
            headers=auth_headers(admin_token)
        )
        assert res.status_code == 200
        assert isinstance(res.get_json(), list)

    def test_appointments_have_required_fields(self, client, admin_token):
        """Each appointment has required fields"""
        res = client.get(
            "/api/admin/appointments",
            headers=auth_headers(admin_token)
        )
        data = res.get_json()
        if len(data) > 0:
            a = data[0]
            assert "appointment_id"   in a
            assert "appointment_date" in a
            assert "status"           in a
            assert "patient_name"     in a
            assert "doctor_name"      in a

    def test_non_admin_cannot_list_all_appointments(self, client, patient_token):
        """Non-admin cannot access all appointments"""
        res = client.get(
            "/api/admin/appointments",
            headers=auth_headers(patient_token)
        )
        assert res.status_code in [401, 403]
