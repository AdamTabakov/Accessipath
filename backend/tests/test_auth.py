"""Port of the Node auth integration tests."""

import time


def _unique_email() -> str:
    return f"user-{int(time.time() * 1000)}-{id(time)}@example.com"


def _signup_payload(email: str, name: str = "Test User", password: str = "password123"):
    return {"email": email, "name": name, "password": password}


class TestAuth:
    def test_rejects_signup_with_short_password(self, client):
        res = client.post("/api/auth/signup", json=_signup_payload(_unique_email(), password="short"))
        assert res.status_code == 400

    def test_rejects_signup_with_invalid_email(self, client):
        res = client.post(
            "/api/auth/signup",
            json={"email": "not-an-email", "name": "Test User", "password": "longenough1"},
        )
        assert res.status_code == 400

    def test_signs_up_and_returns_dev_code_without_mailer_key(self, client):
        email = _unique_email()
        res = client.post(
            "/api/auth/signup",
            json={"email": email, "name": "Ada Lovelace", "password": "correct-horse-battery"},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["user"]["email"] == email
        assert body["user"]["verified"] is False
        assert "passwordHash" not in body["user"]
        assert len(body["devCode"]) == 6

    def test_resends_code_for_existing_unverified_account(self, client):
        email = _unique_email()
        client.post("/api/auth/signup", json=_signup_payload(email, name="One"))
        signup = client.post("/api/auth/signup", json=_signup_payload(email, name="Two"))
        assert signup.status_code == 200
        assert signup.json()["message"] == "Verification code sent."

    def test_verifies_email_with_correct_code(self, client):
        email = _unique_email()
        signup = client.post("/api/auth/signup", json=_signup_payload(email, name="Grace Hopper"))
        verify = client.post("/api/auth/verify", json={"email": email, "code": signup.json()["devCode"]})
        assert verify.status_code == 200
        assert verify.json()["user"]["verified"] is True

    def test_rejects_wrong_verification_code(self, client):
        email = _unique_email()
        client.post("/api/auth/signup", json=_signup_payload(email, name="Wrong Code"))
        verify = client.post("/api/auth/verify", json={"email": email, "code": "000000"})
        assert verify.status_code == 400

    def test_rejects_login_before_verification(self, client):
        email = _unique_email()
        client.post("/api/auth/signup", json=_signup_payload(email, name="Not Verified"))
        login = client.post("/api/auth/login", json={"email": email, "password": "password123"})
        assert login.status_code == 403

    def test_logs_in_with_wrong_password(self, client):
        email = _unique_email()
        signup = client.post("/api/auth/signup", json=_signup_payload(email, name="Ada"))
        client.post("/api/auth/verify", json={"email": email, "code": signup.json()["devCode"]})
        login = client.post("/api/auth/login", json={"email": email, "password": "wrong-password"})
        assert login.status_code == 401

    def test_logs_in_with_correct_password(self, client):
        email = _unique_email()
        signup = client.post("/api/auth/signup", json=_signup_payload(email, name="Ada"))
        client.post("/api/auth/verify", json={"email": email, "code": signup.json()["devCode"]})
        login = client.post("/api/auth/login", json={"email": email, "password": "password123"})
        assert login.status_code == 200
        assert login.json()["token"]
        assert login.json()["user"]["email"] == email

    def test_returns_current_user_for_valid_token(self, client):
        email = _unique_email()
        token = self._verified_token(client, email, "Grace")
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["user"]["email"] == email

    def test_rejects_me_without_token(self, client):
        assert client.get("/api/auth/me").status_code == 401

    def test_rejects_me_with_garbage_token(self, client):
        res = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.token"})
        assert res.status_code == 401

    def test_resend_invalidates_old_code(self, client):
        email = _unique_email()
        signup = client.post("/api/auth/signup", json=_signup_payload(email, name="Resend"))
        first_code = signup.json()["devCode"]
        resend = client.post("/api/auth/resend", json={"email": email})
        assert resend.status_code == 200
        assert len(resend.json()["devCode"]) == 6
        old_verify = client.post("/api/auth/verify", json={"email": email, "code": first_code})
        assert old_verify.status_code == 400

    def test_scopes_profile_to_signed_in_user(self, client):
        email = _unique_email()
        token = self._verified_token(client, email, "Prefs")

        put = client.put(
            "/api/profile",
            json={
                "mobilityProfile": "walker",
                "avoidStairs": True,
                "preferRamps": True,
                "preferElevators": False,
                "maxSlope": "steep",
                "preferSmoothSurface": True,
                "maxWalkDistanceMeters": 1500,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert put.status_code == 200
        assert put.json()["profile"]["mobilityProfile"] == "walker"

        anon = client.get("/api/profile")
        assert anon.status_code == 200
        assert anon.json()["profile"]["mobilityProfile"] == "wheelchair"

        authed = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})
        assert authed.status_code == 200
        assert authed.json()["profile"]["mobilityProfile"] == "walker"

    def test_requires_auth_for_recent_routes(self, client):
        anon_get = client.get("/api/routes/recent")
        assert anon_get.status_code == 401
        anon_post = client.post(
            "/api/routes/recent",
            json={
                "startLabel": "SLC",
                "startLatitude": 43.6577,
                "startLongitude": -79.3802,
                "endLabel": "ENG",
                "endLatitude": 43.658112,
                "endLongitude": -79.377632,
                "mode": "most_accessible",
            },
        )
        assert anon_post.status_code == 401

    def test_saves_and_lists_recent_routes_per_user(self, client):
        email = _unique_email()
        token = self._verified_token(client, email, "Routes")
        auth = {"Authorization": f"Bearer {token}"}

        empty = client.get("/api/routes/recent", headers=auth)
        assert empty.status_code == 200
        assert empty.json()["routes"] == []

        payload = {
            "startLabel": "Union Station",
            "startLatitude": 43.6453,
            "startLongitude": -79.3806,
            "endLabel": "CN Tower",
            "endLatitude": 43.6426,
            "endLongitude": -79.3871,
            "mode": "balanced",
        }
        post = client.post("/api/routes/recent", json=payload, headers=auth)
        assert post.status_code == 201
        assert post.json()["route"]["mode"] == "balanced"

        listed = client.get("/api/routes/recent", headers=auth)
        assert listed.status_code == 200
        assert len(listed.json()["routes"]) == 1
        assert listed.json()["routes"][0]["startLabel"] == "Union Station"
        assert listed.json()["routes"][0]["endLabel"] == "CN Tower"

        client.post("/api/routes/recent", json=payload, headers=auth)
        listed2 = client.get("/api/routes/recent", headers=auth)
        assert len(listed2.json()["routes"]) == 1

    @staticmethod
    def _verified_token(client, email: str, name: str) -> str:
        signup = client.post("/api/auth/signup", json=_signup_payload(email, name=name))
        assert signup.status_code == 201
        client.post("/api/auth/verify", json={"email": email, "code": signup.json()["devCode"]})
        login = client.post("/api/auth/login", json={"email": email, "password": "password123"})
        assert login.status_code == 200
        return login.json()["token"]