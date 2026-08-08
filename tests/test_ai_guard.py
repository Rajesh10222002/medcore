"""
Ollama isn't available in the CI runner, so these only verify the auth/RBAC
guard on each AI endpoint (token_required / role_required run before any
Ollama call, so no live model is needed to exercise them).
"""
import pytest

AI_ENDPOINTS = [
    ("POST", "/api/ai/chat"),
    ("GET",  "/api/ai/suggested-questions"),
    ("POST", "/api/ai/copilot"),
    ("GET",  "/api/ai/health-summary"),
    ("POST", "/api/ai/explain-lab"),
    ("POST", "/api/ai/drug-interaction"),
    ("GET",  "/api/ai/patient-summary/1"),
    ("POST", "/api/ai/parse-note"),
    ("POST", "/api/admin/nl-query"),
    ("POST", "/api/ai/suggest-specialty"),
]


@pytest.mark.parametrize("method,url", AI_ENDPOINTS)
def test_ai_endpoint_blocks_missing_token(client, method, url):
    res = client.open(url, method=method, json={})
    assert res.status_code in (401, 403)


def test_copilot_blocks_patient_role(client, patient_token, auth_header):
    res = client.post("/api/ai/copilot", json={"symptoms": "cough"}, headers=auth_header(patient_token))
    assert res.status_code == 403


def test_health_summary_blocks_doctor_role(client, doctor_token, auth_header):
    res = client.get("/api/ai/health-summary", headers=auth_header(doctor_token))
    assert res.status_code == 403


def test_patient_summary_blocks_patient_role(client, patient_token, auth_header):
    res = client.get("/api/ai/patient-summary/1", headers=auth_header(patient_token))
    assert res.status_code == 403


def test_parse_note_blocks_patient_role(client, patient_token, auth_header):
    res = client.post("/api/ai/parse-note", json={"note_text": "test"}, headers=auth_header(patient_token))
    assert res.status_code == 403


def test_nl_query_blocks_non_admin(client, doctor_token, patient_token, auth_header):
    for token in (doctor_token, patient_token):
        res = client.post("/api/admin/nl-query", json={"question": "how many patients?"}, headers=auth_header(token))
        assert res.status_code == 403


def test_suggest_specialty_blocks_non_patient(client, doctor_token, admin_token, auth_header):
    for token in (doctor_token, admin_token):
        res = client.post("/api/ai/suggest-specialty", json={"symptoms": "cough"}, headers=auth_header(token))
        assert res.status_code == 403


def test_suggest_specialty_requires_symptoms(client, patient_token, auth_header):
    res = client.post("/api/ai/suggest-specialty", json={}, headers=auth_header(patient_token))
    assert res.status_code == 400
