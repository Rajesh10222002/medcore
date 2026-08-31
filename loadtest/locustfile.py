"""
MedCore AI — Locust load test (KB Section 17: 50 virtual users, <2s target)

Scope, deliberately: read-heavy, non-AI, non-mutating endpoints only.

Two things this test does NOT cover, on purpose:
  1. AI routes (/ai/*, NL query) — ai_client.py's own comments document
     Ollama/Gemini calls taking 10-45s+ (that's why app.py runs
     threaded=True). Mixing those into a "<2s" SLA would either force
     an artificially generous target for the whole app, or fail on
     endpoints that were never expected to be fast. Their latency
     profile is a separate, already-documented characteristic — not
     what this load test is measuring.
  2. Booking/write endpoints (POST /appointments, notes, vitals, etc.)
     — repeatedly writing under 50 concurrent users would exhaust
     appointment slots and clutter the demo accounts (same tradeoff
     noted in e2e/README.md for Playwright), and failures from "ran
     out of slots" would look like performance failures when they're
     not. Read endpoints alone already exercise the DB + JWT auth path
     under load, which is what "response time under concurrency" is
     really asking about here.

Run:
    pip install locust
    locust -f loadtest/locustfile.py --host http://localhost:5000

Headless, matching the KB target exactly:
    locust -f loadtest/locustfile.py --host http://localhost:5000 \
        --users 50 --spawn-rate 5 --run-time 2m --headless \
        --html loadtest/report.html
"""
import random
from locust import HttpUser, task, between


def _login(client, email, password):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    body = res.json()
    return body.get("token", ""), body


class PatientUser(HttpUser):
    weight = 5  # patients are the largest share of real traffic
    wait_time = between(1, 3)

    def on_start(self):
        token, _ = _login(self.client, "patient@medcore.ai", "admin123")
        self.headers = {"Authorization": f"Bearer {token}"}

    @task(3)
    def view_dashboard_data(self):
        self.client.get("/api/patients/me", headers=self.headers, name="/patients/me")
        self.client.get("/api/appointments/mine", headers=self.headers, name="/appointments/mine")

    @task(2)
    def view_clinical_history(self):
        self.client.get("/api/patients/me/fhir", headers=self.headers, name="/patients/me/fhir")

    @task(1)
    def browse_doctors(self):
        self.client.get("/api/doctors", headers=self.headers, name="/doctors")

    @task(1)
    def view_referrals(self):
        self.client.get("/api/patients/me/referrals", headers=self.headers, name="/patients/me/referrals")


class DoctorUser(HttpUser):
    weight = 3
    wait_time = between(1, 3)

    def on_start(self):
        token, _ = _login(self.client, "doctor@medcore.ai", "admin123")
        self.headers = {"Authorization": f"Bearer {token}"}
        res = self.client.get("/api/doctor/patients?per_page=50", headers=self.headers,
                               name="/doctor/patients")
        items = res.json().get("items", []) if res.status_code == 200 else []
        self.patient_ids = [p["patient_id"] for p in items] or [None]

    @task(3)
    def view_patients_list(self):
        self.client.get("/api/doctor/patients?per_page=50", headers=self.headers,
                         name="/doctor/patients")

    @task(2)
    def view_patient_detail(self):
        pid = random.choice(self.patient_ids)
        if pid:
            self.client.get(f"/api/doctor/patients/{pid}", headers=self.headers,
                             name="/doctor/patients/:id")

    @task(1)
    def view_analytics(self):
        self.client.get("/api/doctor/analytics", headers=self.headers, name="/doctor/analytics")

    @task(1)
    def view_schedule(self):
        self.client.get("/api/doctor/schedule/calendar", headers=self.headers,
                         name="/doctor/schedule/calendar")


class AdminUser(HttpUser):
    weight = 2
    wait_time = between(1, 3)

    def on_start(self):
        token, _ = _login(self.client, "admin@medcore.ai", "admin123")
        self.headers = {"Authorization": f"Bearer {token}"}

    @task(3)
    def view_kpis(self):
        self.client.get("/api/admin/kpis", headers=self.headers, name="/admin/kpis")

    @task(2)
    def view_patients(self):
        self.client.get("/api/admin/patients", headers=self.headers, name="/admin/patients")

    @task(2)
    def view_doctors(self):
        self.client.get("/api/admin/doctors", headers=self.headers, name="/admin/doctors")

    @task(1)
    def view_appointments(self):
        self.client.get("/api/admin/appointments", headers=self.headers, name="/admin/appointments")
