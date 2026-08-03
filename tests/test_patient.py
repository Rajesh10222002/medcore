def test_patient_can_get_profile(client, patient_token, auth_header):
    res = client.get("/api/patients/me", headers=auth_header(patient_token))
    assert res.status_code == 200
    assert "first_name" in res.get_json()


def test_patient_profile_email_correct(client, patient_token, auth_header):
    res = client.get("/api/patients/me", headers=auth_header(patient_token))
    assert res.get_json()["email"] == "patient@medcore.ai"


def test_patient_can_get_appointments(client, patient_token, auth_header):
    res = client.get("/api/appointments/mine", headers=auth_header(patient_token))
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


def test_patient_can_get_doctors(client, patient_token, auth_header):
    res = client.get("/api/doctors", headers=auth_header(patient_token))
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


def test_patient_can_get_fhir_record(client, patient_token, auth_header):
    res = client.get("/api/patients/me/fhir", headers=auth_header(patient_token))
    assert res.status_code == 200
    body = res.get_json()
    for key in ("conditions", "medications", "observations", "allergies", "blood_group"):
        assert key in body
