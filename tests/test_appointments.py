"""
MedCore AI — Appointment route tests
Tests: GET /api/appointments/mine, POST /api/appointments,
       GET /api/appointments/slots, PUT /api/appointments/:id/cancel
"""
import pytest
from datetime import date, timedelta
from tests.conftest import auth_headers


class TestGetAppointments:
    """Tests for GET /api/appointments/mine"""

    def test_patient_can_get_appointments(self, client, patient_token):
        """Patient can fetch their appointments"""
        res = client.get(
            "/api/appointments/mine",
            headers=auth_headers(patient_token)
        )
        assert res.status_code == 200
        assert isinstance(res.get_json(), list)

    def test_appointments_have_required_fields(self, client, patient_token):
        """Each appointment contains expected fields"""
        res = client.get(
            "/api/appointments/mine",
            headers=auth_headers(patient_token)
        )
        data = res.get_json()
        if len(data) > 0:
            appt = data[0]
            assert "appointment_id"   in appt
            assert "appointment_date" in appt
            assert "status"           in appt
            assert "doctor_name"      in appt

    def test_doctor_cannot_access_patient_appointments(self, client, doctor_token):
        """Doctor cannot call patient appointments endpoint"""
        res = client.get(
            "/api/appointments/mine",
            headers=auth_headers(doctor_token)
        )
        assert res.status_code in [401, 403]

    def test_no_token_rejected(self, client):
        """Cannot get appointments without auth token"""
        res = client.get("/api/appointments/mine")
        assert res.status_code in [401, 403]


class TestGetSlots:
    """Tests for GET /api/appointments/slots"""

    def test_get_slots_returns_list(self, client, patient_token):
        """Slot check returns a list"""
        # Get a future weekday
        future_date = date.today() + timedelta(days=3)
        while future_date.weekday() >= 5:
            future_date += timedelta(days=1)

        res = client.get(
            f"/api/appointments/slots?doctor_id=1&date={future_date}",
            headers=auth_headers(patient_token)
        )
        assert res.status_code == 200
        data = res.get_json()
        assert "slots" in data or isinstance(data, list)

    def test_slots_have_required_fields(self, client, patient_token):
        """Each slot has label, available, and datetime fields"""
        future_date = date.today() + timedelta(days=3)
        while future_date.weekday() >= 5:
            future_date += timedelta(days=1)

        res = client.get(
            f"/api/appointments/slots?doctor_id=1&date={future_date}",
            headers=auth_headers(patient_token)
        )
        data = res.get_json()
        slots = data.get("slots", data) if isinstance(data, dict) else data
        if isinstance(slots, list) and len(slots) > 0:
            slot = slots[0]
            assert "label"     in slot
            assert "available" in slot

    def test_slots_missing_doctor_id(self, client, patient_token):
        """Slots request without doctor_id returns error"""
        future_date = date.today() + timedelta(days=3)
        res = client.get(
            f"/api/appointments/slots?date={future_date}",
            headers=auth_headers(patient_token)
        )
        assert res.status_code in [400, 422]


class TestBookAppointment:
    """Tests for POST /api/appointments"""

    def test_book_appointment_missing_fields(self, client, patient_token):
        """Booking without required fields is rejected"""
        res = client.post(
            "/api/appointments",
            json={"doctor_id": 1},  # missing appointment_date and reason
            headers=auth_headers(patient_token)
        )
        assert res.status_code in [400, 422]

    def test_book_without_token_rejected(self, client):
        """Cannot book appointment without token"""
        res = client.post(
            "/api/appointments",
            json={
                "doctor_id":        1,
                "appointment_date": "2026-08-01T10:00:00",
                "reason":           "test"
            }
        )
        assert res.status_code in [401, 403]

    def test_doctor_cannot_book_appointment(self, client, doctor_token):
        """Doctor cannot book appointments (patient-only route)"""
        res = client.post(
            "/api/appointments",
            json={
                "doctor_id":        1,
                "appointment_date": "2026-08-01T10:00:00",
                "reason":           "test"
            },
            headers=auth_headers(doctor_token)
        )
        assert res.status_code in [401, 403]


class TestCancelAppointment:
    """Tests for PUT /api/appointments/:id/cancel"""

    def test_cancel_nonexistent_appointment(self, client, patient_token):
        """Cancelling a non-existent appointment returns 404"""
        res = client.put(
            "/api/appointments/999999/cancel",
            headers=auth_headers(patient_token)
        )
        assert res.status_code in [404, 400]

    def test_cancel_without_token_rejected(self, client):
        """Cannot cancel without token"""
        res = client.put("/api/appointments/1/cancel")
        assert res.status_code in [401, 403]
