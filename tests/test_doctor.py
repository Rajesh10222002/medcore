def test_doctor_can_get_profile(client, doctor_token, auth_header):
    res = client.get("/api/doctor/me", headers=auth_header(doctor_token))
    assert res.status_code == 200
    assert "specialization" in res.get_json()


def test_doctor_can_get_analytics(client, doctor_token, auth_header):
    res = client.get("/api/doctor/analytics", headers=auth_header(doctor_token))
    assert res.status_code == 200
    body = res.get_json()
    assert isinstance(body["monthly_patients"], list) and len(body["monthly_patients"]) == 6
    assert isinstance(body["by_status"], list)
    assert isinstance(body["total_this_month"], int)
    assert isinstance(body["total_last_month"], int)


def test_doctor_analytics_requires_doctor_role(client, patient_token, admin_token, auth_header):
    res = client.get("/api/doctor/analytics", headers=auth_header(patient_token))
    assert res.status_code == 403
    res = client.get("/api/doctor/analytics", headers=auth_header(admin_token))
    assert res.status_code == 403


def test_doctor_can_list_patients(client, doctor_token, auth_header):
    res = client.get("/api/doctor/patients", headers=auth_header(doctor_token))
    assert res.status_code == 200
    body = res.get_json()
    assert isinstance(body["items"], list)
    assert "total" in body and "stats" in body


def test_doctor_patients_search_filters_results(client, doctor_token, auth_header):
    res = client.get("/api/doctor/patients?search=zzzz_no_such_patient", headers=auth_header(doctor_token))
    body = res.get_json()
    assert body["items"] == []
    assert body["total"] == 0


def test_doctor_can_view_patient_detail(client, doctor_token, auth_header, test_patient):
    res = client.get(f"/api/doctor/patients/{test_patient['patient_id']}", headers=auth_header(doctor_token))
    assert res.status_code == 200
    body = res.get_json()
    assert body["patient_id"] == test_patient["patient_id"]
    assert "fhir" in body


def test_doctor_can_save_note(client, doctor_token, auth_header, test_patient):
    res = client.post(
        f"/api/doctor/notes/{test_patient['patient_id']}",
        json={"note_text": "CI test note: patient reports mild headache."},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 201
    assert "note_id" in res.get_json()


def test_doctor_can_add_vitals(client, doctor_token, auth_header, test_patient):
    res = client.post(
        f"/api/doctor/vitals/{test_patient['patient_id']}",
        json={"heart_rate": 72, "systolic_bp": 118, "diastolic_bp": 76},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 201
    assert "saved_vitals" in res.get_json()


def test_doctor_can_add_diagnosis(client, doctor_token, auth_header, test_patient):
    res = client.post(
        f"/api/doctor/diagnosis/{test_patient['patient_id']}",
        json={"display": "CI Test Diagnosis", "code": "Z99"},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 201


def test_doctor_add_diagnosis_requires_display(client, doctor_token, auth_header, test_patient):
    res = client.post(
        f"/api/doctor/diagnosis/{test_patient['patient_id']}",
        json={},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 400


def test_doctor_can_add_medication(client, doctor_token, auth_header, test_patient):
    res = client.post(
        f"/api/doctor/medication/{test_patient['patient_id']}",
        json={"name": "CI Test Med", "dosage": "500mg", "frequency": "OD"},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 201


def test_doctor_can_add_allergy(client, doctor_token, auth_header, test_patient):
    res = client.post(
        f"/api/doctor/allergy/{test_patient['patient_id']}",
        json={"name": "CI Test Allergen", "severity": "mild"},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 201


def test_doctor_can_set_and_get_blood_group(client, doctor_token, auth_header, test_patient):
    set_res = client.post(
        f"/api/doctor/blood-group/{test_patient['patient_id']}",
        json={"blood_group": "O+"},
        headers=auth_header(doctor_token),
    )
    assert set_res.status_code == 201
    assert set_res.get_json()["blood_group"] == "O+"

    get_res = client.get(
        f"/api/doctor/blood-group/{test_patient['patient_id']}",
        headers=auth_header(doctor_token),
    )
    assert get_res.status_code == 200
    assert get_res.get_json()["blood_group"] == "O+"


def test_doctor_set_blood_group_rejects_invalid_value(client, doctor_token, auth_header, test_patient):
    res = client.post(
        f"/api/doctor/blood-group/{test_patient['patient_id']}",
        json={"blood_group": "XX"},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 400
