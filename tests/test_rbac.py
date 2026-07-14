"""
MedCore AI — Role-Based Access Control (RBAC) tests
Verifies that each role can ONLY access its own routes.
This is the security boundary test from proposal Section 10.
"""
import pytest
from tests.conftest import auth_headers


class TestRBACBoundaries:
    """
    Cross-role access tests — ensure no role can access
    another role's protected endpoints.
    """

    # ── Patient trying doctor routes ──────────────────────────────────────
    def test_patient_blocked_from_doctor_patients(self, client, patient_token):
        res = client.get("/api/doctor/patients", headers=auth_headers(patient_token))
        assert res.status_code in [401, 403]

    def test_patient_blocked_from_doctor_me(self, client, patient_token):
        res = client.get("/api/doctor/me", headers=auth_headers(patient_token))
        assert res.status_code in [401, 403]

    def test_patient_blocked_from_admin_kpis(self, client, patient_token):
        res = client.get("/api/admin/kpis", headers=auth_headers(patient_token))
        assert res.status_code in [401, 403]

    def test_patient_blocked_from_admin_patients(self, client, patient_token):
        res = client.get("/api/admin/patients", headers=auth_headers(patient_token))
        assert res.status_code in [401, 403]

    # ── Doctor trying patient routes ──────────────────────────────────────
    def test_doctor_blocked_from_patient_me(self, client, doctor_token):
        res = client.get("/api/patients/me", headers=auth_headers(doctor_token))
        assert res.status_code in [401, 403]

    def test_doctor_blocked_from_patient_fhir(self, client, doctor_token):
        res = client.get("/api/patients/me/fhir", headers=auth_headers(doctor_token))
        assert res.status_code in [401, 403]

    def test_doctor_blocked_from_admin_kpis(self, client, doctor_token):
        res = client.get("/api/admin/kpis", headers=auth_headers(doctor_token))
        assert res.status_code in [401, 403]

    def test_doctor_blocked_from_booking(self, client, doctor_token):
        res = client.post(
            "/api/appointments",
            json={"doctor_id": 1, "appointment_date": "2026-08-01T10:00:00", "reason": "test"},
            headers=auth_headers(doctor_token)
        )
        assert res.status_code in [401, 403]

    # ── Admin trying patient/doctor routes ───────────────────────────────
    def test_admin_blocked_from_patient_me(self, client, admin_token):
        res = client.get("/api/patients/me", headers=auth_headers(admin_token))
        assert res.status_code in [401, 403]

    def test_admin_blocked_from_doctor_me(self, client, admin_token):
        res = client.get("/api/doctor/me", headers=auth_headers(admin_token))
        assert res.status_code in [401, 403]

    # ── No token at all ───────────────────────────────────────────────────
    def test_unauthenticated_blocked_from_all_routes(self, client):
        """All protected routes reject requests with no token"""
        routes = [
            "/api/patients/me",
            "/api/patients/me/fhir",
            "/api/appointments/mine",
            "/api/doctor/me",
            "/api/doctor/patients",
            "/api/admin/kpis",
            "/api/admin/patients",
            "/api/admin/doctors",
            "/api/admin/appointments",
        ]
        for route in routes:
            res = client.get(route)
            assert res.status_code in [401, 403], \
                f"Route {route} should reject unauthenticated request but returned {res.status_code}"

    # ── Invalid token ─────────────────────────────────────────────────────
    def test_invalid_token_rejected(self, client):
        """A fake/expired token is rejected"""
        fake_headers = {"Authorization": "Bearer fake.token.here"}
        res = client.get("/api/patients/me", headers=fake_headers)
        assert res.status_code in [401, 403]

    def test_malformed_auth_header_rejected(self, client):
        """Malformed Authorization header is rejected"""
        bad_headers = {"Authorization": "NotBearer sometoken"}
        res = client.get("/api/patients/me", headers=bad_headers)
        assert res.status_code in [401, 403]
