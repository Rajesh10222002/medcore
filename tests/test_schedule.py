import datetime


def test_calendar_returns_31_days(client, doctor_token, auth_header):
    res = client.get("/api/doctor/schedule/calendar", headers=auth_header(doctor_token))
    assert res.status_code == 200
    assert len(res.get_json()) == 31


def test_leaves_returns_list(client, doctor_token, auth_header):
    res = client.get("/api/doctor/schedule/leaves", headers=auth_header(doctor_token))
    assert res.status_code == 200
    assert isinstance(res.get_json(), list)


def test_day_detail_returns_expected_shape(client, doctor_token, auth_header):
    today = datetime.date.today().isoformat()
    res = client.get(f"/api/doctor/schedule/day/{today}", headers=auth_header(doctor_token))
    assert res.status_code == 200
    data = res.get_json()
    assert "appointments" in data
    assert "blocks" in data


def test_add_leave_requires_leave_date(client, doctor_token, auth_header):
    res = client.post("/api/doctor/schedule/leave", json={}, headers=auth_header(doctor_token))
    assert res.status_code == 400


def test_add_leave_rejects_past_date(client, doctor_token, auth_header):
    past_date = (datetime.date.today() - datetime.timedelta(days=5)).isoformat()
    res = client.post(
        "/api/doctor/schedule/leave",
        json={"leave_date": past_date, "block_type": "full_day"},
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 400


def test_add_and_delete_full_day_leave(client, doctor_token, auth_header):
    headers = auth_header(doctor_token)
    future_date = (datetime.date.today() + datetime.timedelta(days=200)).isoformat()

    add_res = client.post(
        "/api/doctor/schedule/leave",
        json={"leave_date": future_date, "block_type": "full_day", "reason": "CI test leave"},
        headers=headers,
    )
    assert add_res.status_code == 201
    leave_id = add_res.get_json()["leave_id"]

    leaves = client.get("/api/doctor/schedule/leaves", headers=headers).get_json()
    assert any(l["leave_id"] == leave_id for l in leaves)

    del_res = client.delete(f"/api/doctor/schedule/leave/{leave_id}", headers=headers)
    assert del_res.status_code == 200

    leaves_after = client.get("/api/doctor/schedule/leaves", headers=headers).get_json()
    assert not any(l["leave_id"] == leave_id for l in leaves_after)


def test_add_hourly_leave_requires_end_after_start(client, doctor_token, auth_header):
    future_date = (datetime.date.today() + datetime.timedelta(days=201)).isoformat()
    res = client.post(
        "/api/doctor/schedule/leave",
        json={
            "leave_date":  future_date,
            "block_type":  "hourly",
            "block_start": "14:00",
            "block_end":   "13:00",
        },
        headers=auth_header(doctor_token),
    )
    assert res.status_code == 400
