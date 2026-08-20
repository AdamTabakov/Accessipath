"""Port of the Node community report vote tests."""

import time

REPORT_INPUT = {
    "type": "blocked_ramp",
    "description": "Ramp blocked by delivery crates.",
    "latitude": 43.6577,
    "longitude": -79.3802,
}


async def _auth_token(client):
    email = f"voter-{int(time.time() * 1000)}-{id(time)}@example.com"
    signup = client.post(
        "/api/auth/signup",
        json={"email": email, "name": "Voter", "password": "correct-horse-battery"},
    )
    assert signup.status_code == 201
    assert len(signup.json()["devCode"]) == 6
    verify = client.post("/api/auth/verify", json={"email": email, "code": signup.json()["devCode"]})
    assert verify.status_code == 200
    login = client.post("/api/auth/login", json={"email": email, "password": "correct-horse-battery"})
    assert login.status_code == 200
    return login.json()["token"]


class TestReportVotes:
    async def test_requires_auth_to_vote(self, client, store):
        report = await store.create_report(dict(REPORT_INPUT))
        res = client.post(f"/api/reports/{report.id}/vote", json={"direction": "up"})
        assert res.status_code == 401

    async def test_rejects_invalid_vote_direction(self, client, store):
        report = await store.create_report(dict(REPORT_INPUT))
        token = await _auth_token(client)
        res = client.post(
            f"/api/reports/{report.id}/vote",
            json={"direction": "sideways"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 400

    async def test_upvotes_once_and_toggles_off(self, client, store):
        report = await store.create_report(dict(REPORT_INPUT))
        token = await _auth_token(client)
        auth = {"Authorization": f"Bearer {token}"}
        up = client.post(f"/api/reports/{report.id}/vote", json={"direction": "up"}, headers=auth)
        assert up.status_code == 200
        assert up.json()["report"]["upvotes"] == 1
        assert up.json()["report"]["myVote"] == "up"

        off = client.post(f"/api/reports/{report.id}/vote", json={"direction": "up"}, headers=auth)
        assert off.json()["report"]["upvotes"] == 0
        assert off.json()["report"]["downvotes"] == 0
        assert off.json()["report"]["myVote"] is None

    async def test_changes_vote_from_up_to_down(self, client, store):
        report = await store.create_report(dict(REPORT_INPUT))
        token = await _auth_token(client)
        auth = {"Authorization": f"Bearer {token}"}
        client.post(f"/api/reports/{report.id}/vote", json={"direction": "up"}, headers=auth)
        down = client.post(f"/api/reports/{report.id}/vote", json={"direction": "down"}, headers=auth)
        assert down.json()["report"]["upvotes"] == 0
        assert down.json()["report"]["downvotes"] == 1
        assert down.json()["report"]["myVote"] == "down"

    async def test_exposes_my_vote_per_user(self, client, store):
        report = await store.create_report(dict(REPORT_INPUT))
        token = await _auth_token(client)
        auth = {"Authorization": f"Bearer {token}"}
        client.post(f"/api/reports/{report.id}/vote", json={"direction": "up"}, headers=auth)
        listed = client.get("/api/reports", headers=auth)
        assert listed.status_code == 200
        mine = next(r for r in listed.json()["reports"] if r["id"] == report.id)
        assert mine["myVote"] == "up"
        assert mine["upvotes"] == 1

    async def test_verifies_after_three_upvotes_at_two_to_one(self, store):
        report = await store.create_report(dict(REPORT_INPUT))
        await store.vote_report(report.id, "user-a", "up")
        await store.vote_report(report.id, "user-b", "up")
        await store.vote_report(report.id, "user-c", "up")
        updated = next(r for r in await store.get_reports() if r.id == report.id)
        assert updated.status == "verified"
        assert updated.verifiedAt is not None
        point = next(p for p in await store.get_all_accessibility_points() if p.id == f"point-{report.id}")
        assert point.confidence == 0.85
        assert point.verifiedAt is not None

    async def test_rejects_after_three_downvotes_and_hides_from_routing(self, store):
        report = await store.create_report(dict(REPORT_INPUT))
        await store.vote_report(report.id, "user-a", "down")
        await store.vote_report(report.id, "user-b", "down")
        await store.vote_report(report.id, "user-c", "down")
        updated = next(r for r in await store.get_reports() if r.id == report.id)
        assert updated.status == "rejected"
        points = await store.get_all_accessibility_points()
        assert all(p.id != f"point-{report.id}" for p in points)

    async def test_keeps_verified_when_votes_dip_below_threshold(self, store):
        report = await store.create_report(dict(REPORT_INPUT))
        for user in ("user-a", "user-b", "user-c"):
            await store.vote_report(report.id, user, "up")
        await store.vote_report(report.id, "user-d", "down")
        updated = next(r for r in await store.get_reports() if r.id == report.id)
        assert updated.status == "verified"