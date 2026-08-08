from db import get_db


def _login(client, email, password):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    return res.get_json().get("token", "")


def _delete_referral(referral_id):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM referrals WHERE referral_id = %s", (referral_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def test_create_referral_missing_fields_rejected(client, doctor_token, auth_header, test_patient):
    res = client.post(
        f"/api/doctor/patients/{test_patient['patient_id']}/referrals",
        json={},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 400


def test_create_referral_to_self_rejected(client, doctor_token, auth_header, test_patient, doctor_id):
    res = client.post(
        f"/api/doctor/patients/{test_patient['patient_id']}/referrals",
        json={"referred_to_doctor_id": doctor_id, "reason": "self-referral"},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 400


def test_create_referral_to_unknown_doctor_404(client, doctor_token, auth_header, test_patient):
    res = client.post(
        f"/api/doctor/patients/{test_patient['patient_id']}/referrals",
        json={"referred_to_doctor_id": 999999999, "reason": "unknown doctor"},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 404


def test_referral_full_workflow(client, doctor_token, auth_header, test_patient, doctor_id):
    doctor2_token = _login(client, "doctor2@medcore.ai", "admin123")
    doctor2_headers = auth_header(doctor2_token)
    doctor2_id = client.get("/api/doctor/me", headers=doctor2_headers).get_json()["doctor_id"]

    create_res = client.post(
        f"/api/doctor/patients/{test_patient['patient_id']}/referrals",
        json={"referred_to_doctor_id": doctor2_id, "reason": "CI test — suspected cardiac issue"},
        headers=auth_header(doctor_token),
    )
    assert create_res.status_code == 201
    referral_id = create_res.get_json()["referral_id"]
    assert create_res.get_json()["status"] == "pending"

    try:
        # Referred-to doctor sees it in incoming
        incoming_res = client.get("/api/doctor/referrals/incoming", headers=doctor2_headers)
        assert incoming_res.status_code == 200
        incoming_ids = [r["referral_id"] for r in incoming_res.get_json()]
        assert referral_id in incoming_ids

        # The referring doctor is NOT the one who sees it as incoming
        referring_incoming = client.get(
            "/api/doctor/referrals/incoming", headers=auth_header(doctor_token)
        ).get_json()
        assert referral_id not in [r["referral_id"] for r in referring_incoming]

        # Patient can see the referral
        patient_email = test_patient["email"]
        patient_login = _login(client, patient_email, "citest1234")
        patient_referrals = client.get(
            "/api/patients/me/referrals", headers=auth_header(patient_login)
        ).get_json()
        matching = next(r for r in patient_referrals if r["referral_id"] == referral_id)
        assert matching["status"] == "pending"
        assert matching["referred_to_doctor_id"] == doctor2_id

        # A doctor who isn't the referred-to doctor can't accept it
        wrong_accept = client.put(
            f"/api/doctor/referrals/{referral_id}/accept", headers=auth_header(doctor_token)
        )
        assert wrong_accept.status_code == 404

        # The referred-to doctor accepts it
        accept_res = client.put(
            f"/api/doctor/referrals/{referral_id}/accept", headers=doctor2_headers
        )
        assert accept_res.status_code == 200
        assert accept_res.get_json()["status"] == "accepted"

        # No longer shows up as a pending incoming referral
        incoming_after = client.get("/api/doctor/referrals/incoming", headers=doctor2_headers).get_json()
        assert referral_id not in [r["referral_id"] for r in incoming_after]
    finally:
        _delete_referral(referral_id)


def test_decline_referral(client, doctor_token, auth_header, test_patient, doctor_id):
    doctor2_token = _login(client, "doctor2@medcore.ai", "admin123")
    doctor2_id = client.get("/api/doctor/me", headers=auth_header(doctor2_token)).get_json()["doctor_id"]

    create_res = client.post(
        f"/api/doctor/patients/{test_patient['patient_id']}/referrals",
        json={"referred_to_doctor_id": doctor2_id, "reason": "CI test — decline flow"},
        headers=auth_header(doctor_token),
    )
    referral_id = create_res.get_json()["referral_id"]

    try:
        decline_res = client.put(
            f"/api/doctor/referrals/{referral_id}/decline", headers=auth_header(doctor2_token)
        )
        assert decline_res.status_code == 200
        assert decline_res.get_json()["status"] == "declined"
    finally:
        _delete_referral(referral_id)


def test_decline_referral_with_reason_visible_to_patient(client, doctor_token, auth_header, test_patient, doctor_id):
    doctor2_token = _login(client, "doctor2@medcore.ai", "admin123")
    doctor2_id = client.get("/api/doctor/me", headers=auth_header(doctor2_token)).get_json()["doctor_id"]

    create_res = client.post(
        f"/api/doctor/patients/{test_patient['patient_id']}/referrals",
        json={"referred_to_doctor_id": doctor2_id, "reason": "CI test — decline with reason"},
        headers=auth_header(doctor_token),
    )
    referral_id = create_res.get_json()["referral_id"]

    try:
        decline_res = client.put(
            f"/api/doctor/referrals/{referral_id}/decline",
            json={"decline_reason": "Fully booked this month"},
            headers=auth_header(doctor2_token),
        )
        assert decline_res.status_code == 200

        patient_referrals = client.get(
            "/api/patients/me/referrals", headers=auth_header(test_patient["token"])
        ).get_json()
        matching = next(r for r in patient_referrals if r["referral_id"] == referral_id)
        assert matching["status"] == "declined"
        assert matching["decline_reason"] == "Fully booked this month"
    finally:
        _delete_referral(referral_id)


def test_create_referral_requires_doctor_role(client, patient_token, admin_token, auth_header, test_patient):
    for token in (patient_token, admin_token):
        res = client.post(
            f"/api/doctor/patients/{test_patient['patient_id']}/referrals",
            json={"referred_to_doctor_id": 1, "reason": "x"},
            headers=auth_header(token),
        )
        assert res.status_code == 403
