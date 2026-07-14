# MedCore AI — Test Suite

## Structure

```
tests/
├── conftest.py              # Shared fixtures and auth helpers
├── test_auth.py             # Login + Signup tests (13 tests)
├── test_patients.py         # Patient profile + FHIR tests (10 tests)
├── test_appointments.py     # Booking, slots, cancel tests (11 tests)
├── test_doctors.py          # Doctor profile + patient list tests (12 tests)
├── test_admin.py            # Admin KPIs + all lists tests (13 tests)
└── test_rbac.py             # Role boundary security tests (15 tests)
```

**Total: 74 tests across 6 files**

## Running locally

```bash
cd medcore
pip install -r requirements-test.txt
pytest tests/ -v
```

## Running with coverage

```bash
pytest tests/ --cov=backend --cov-report=term-missing -v
```

## GitHub Actions

CI runs automatically on every push to `master` or `main`.
Add these secrets in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Your Neon PostgreSQL connection string |
| `JWT_SECRET` | Your JWT secret key |
| `FHIR_BASE_URL` | https://hapi.fhir.org/baseR4 |
| `GEMINI_API_KEY` | Your Gemini API key |
