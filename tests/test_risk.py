from db import get_db


def _seed_prediction(patient_id, prediction_type, result, confidence):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO ai_predictions (patient_id, prediction_type, prediction_result, confidence_score)
            VALUES (%s, %s, %s, %s) RETURNING prediction_id
            """,
            (patient_id, prediction_type, result, confidence),
        )
        prediction_id = cur.fetchone()[0]
        conn.commit()
        return prediction_id
    finally:
        cur.close()
        conn.close()


def _delete_prediction(prediction_id):
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM ai_predictions WHERE prediction_id = %s", (prediction_id,))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def test_patient_risk_has_predictions_shape(client, test_patient, auth_header):
    # test_patient is a fresh signup, guaranteed no pre-existing predictions —
    # avoids colliding with the demo account's real ML training run output.
    prediction_id = _seed_prediction(test_patient["patient_id"], "readmission_random_forest", "1", 0.72)
    try:
        res = client.get("/api/patients/me/risk", headers=auth_header(test_patient["token"]))
        assert res.status_code == 200
        body = res.get_json()
        assert body["has_predictions"] is True
        assert body["readmission_risk"] == {"level": "High", "probability": 0.72}
        assert body["no_show_risk"] is None
        assert body["risk_tier"] is None
    finally:
        _delete_prediction(prediction_id)


def test_patient_risk_no_predictions_returns_false_not_error(client, test_patient, auth_header):
    # test_patient is a fresh signup — guaranteed no ai_predictions rows
    res = client.get("/api/patients/me/risk", headers=auth_header(test_patient["token"]))
    assert res.status_code == 200
    assert res.get_json() == {"has_predictions": False}


def test_patient_risk_requires_patient_role(client, doctor_token, admin_token, auth_header):
    for token in (doctor_token, admin_token):
        res = client.get("/api/patients/me/risk", headers=auth_header(token))
        assert res.status_code == 403


def test_doctor_can_view_patient_risk(client, doctor_token, auth_header, test_patient):
    prediction_id = _seed_prediction(test_patient["patient_id"], "patient_clustering_kmeans", "High Risk", None)
    try:
        res = client.get(
            f"/api/doctor/patients/{test_patient['patient_id']}/risk", headers=auth_header(doctor_token)
        )
        assert res.status_code == 200
        body = res.get_json()
        assert body["has_predictions"] is True
        assert body["risk_tier"] == "High Risk"
        assert body["readmission_risk"] is None
    finally:
        _delete_prediction(prediction_id)


def test_doctor_patient_risk_no_predictions_returns_false(client, doctor_token, auth_header, test_patient):
    res = client.get(
        f"/api/doctor/patients/{test_patient['patient_id']}/risk", headers=auth_header(doctor_token)
    )
    assert res.status_code == 200
    assert res.get_json() == {"has_predictions": False}


def test_doctor_patient_risk_requires_doctor_role(client, patient_token, admin_token, auth_header, test_patient):
    for token in (patient_token, admin_token):
        res = client.get(
            f"/api/doctor/patients/{test_patient['patient_id']}/risk", headers=auth_header(token)
        )
        assert res.status_code == 403
