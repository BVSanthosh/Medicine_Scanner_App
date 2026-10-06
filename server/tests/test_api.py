"""End-to-end tests through the real ASGI app."""

import pytest

GS = "\x1d"


class TestAuth:
    async def test_register_returns_a_usable_token(self, client):
        response = await client.post(
            "/auth/register",
            json={"name": "Jo", "email": "jo@example.com", "password": "correct-horse"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["token"]
        assert body["expiresIn"] > 0
        assert body["user"]["email"] == "jo@example.com"

        me = await client.get(
            "/auth/me", headers={"Authorization": f"Bearer {body['token']}"}
        )
        assert me.status_code == 200
        assert me.json()["email"] == "jo@example.com"

    async def test_duplicate_email_is_a_conflict_not_a_500(self, client):
        payload = {"name": "Jo", "email": "dup@example.com", "password": "correct-horse"}
        assert (await client.post("/auth/register", json=payload)).status_code == 201
        second = await client.post("/auth/register", json=payload)
        assert second.status_code == 409
        assert "already exists" in second.json()["detail"]

    async def test_email_is_case_insensitive(self, client):
        await client.post(
            "/auth/register",
            json={"name": "Jo", "email": "Case@Example.com", "password": "correct-horse"},
        )
        response = await client.post(
            "/auth/login",
            json={"email": "case@example.com", "password": "correct-horse"},
        )
        assert response.status_code == 200

    async def test_wrong_password_and_unknown_account_are_indistinguishable(self, client):
        await client.post(
            "/auth/register",
            json={"name": "Jo", "email": "real@example.com", "password": "correct-horse"},
        )
        wrong = await client.post(
            "/auth/login", json={"email": "real@example.com", "password": "nope"}
        )
        missing = await client.post(
            "/auth/login", json={"email": "ghost@example.com", "password": "nope"}
        )
        # Differing here would let an attacker enumerate registered accounts.
        assert wrong.status_code == missing.status_code == 401
        assert wrong.json()["detail"] == missing.json()["detail"]

    async def test_short_password_rejected(self, client):
        response = await client.post(
            "/auth/register",
            json={"name": "Jo", "email": "short@example.com", "password": "abc"},
        )
        assert response.status_code == 422

    async def test_password_is_never_returned(self, client):
        response = await client.post(
            "/auth/register",
            json={
                "name": "Jo",
                "email": "secret@example.com",
                "password": "correct-horse",
            },
        )
        assert "password" not in response.text.lower()

    async def test_google_login_not_configured(self, client):
        response = await client.post("/auth/google", json={"idToken": "x.y.z"})
        assert response.status_code == 501


class TestAuthorisation:
    @pytest.mark.parametrize(
        ("method", "path"),
        [
            ("post", "/scans/text"),
            ("post", "/scans/barcode"),
            ("post", "/scans/manual"),
            ("get", "/scans"),
            ("get", "/auth/me"),
        ],
    )
    async def test_endpoints_require_a_token(self, client, method, path):
        kwargs = {"json": {}} if method == "post" else {}
        response = await getattr(client, method)(path, **kwargs)
        assert response.status_code == 401

    async def test_garbage_token_rejected(self, client):
        response = await client.get(
            "/scans", headers={"Authorization": "Bearer not-a-jwt"}
        )
        assert response.status_code == 401

    async def test_history_is_scoped_to_the_caller(self, client, seeded):
        """The bug this replaces: /scan/medicines/{user_id} let anyone read
        anyone else's history by editing the URL."""
        first = await client.post(
            "/auth/register",
            json={"name": "A", "email": "a@example.com", "password": "correct-horse"},
        )
        token_a = first.json()["token"]
        await client.post(
            "/scans/manual",
            json={"fields": {"batchNumber": "49302"}},
            headers={"Authorization": f"Bearer {token_a}"},
        )

        second = await client.post(
            "/auth/register",
            json={"name": "B", "email": "b@example.com", "password": "correct-horse"},
        )
        token_b = second.json()["token"]

        history_b = await client.get(
            "/scans", headers={"Authorization": f"Bearer {token_b}"}
        )
        assert history_b.status_code == 200
        # B sees nothing, because B scanned nothing.
        assert history_b.json() == []

        history_a = await client.get(
            "/scans", headers={"Authorization": f"Bearer {token_a}"}
        )
        assert len(history_a.json()) == 1


class TestScanEndpoints:
    async def test_barcode_scan_resolves_and_verifies(self, auth_client, seeded):
        response = await auth_client.post(
            "/scans/barcode",
            json={
                "raw": f"010500015810305417261200{GS}10ABC-123",
                "symbology": "code128",
                "location": {"latitude": 12.97, "longitude": 77.59},
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "safe"
        assert body["title"] == "Safe for consumption"
        assert body["fields"]["batchNumber"] == "ABC-123"
        # Product details come from the register, not the pack.
        assert body["fields"]["name"] == "Panadol"
        assert body["fields"]["salt"] == "Paracetamol"
        assert body["gtin"] == "05000158103054"

    async def test_plain_ean13_has_no_batch_so_client_falls_back(
        self, auth_client, seeded
    ):
        response = await auth_client.post(
            "/scans/barcode", json={"raw": "5000158103054", "symbology": "ean13"}
        )
        body = response.json()
        assert body["status"] == "unknown"
        # Empty batchNumber is the signal the client uses to open the form.
        assert body["fields"]["batchNumber"] == ""
        # ...pre-filled with what we do know.
        assert body["fields"]["name"] == "Panadol"

    async def test_flagged_batch(self, auth_client, seeded):
        response = await auth_client.post(
            "/scans/manual", json={"fields": {"batchNumber": "FAKE-999"}}
        )
        body = response.json()
        assert body["status"] == "unsafe"
        assert body["title"] == "Do not consume"

    async def test_unlisted_batch_is_unknown_not_unsafe(self, auth_client, seeded):
        response = await auth_client.post(
            "/scans/manual", json={"fields": {"batchNumber": "ZZ-000"}}
        )
        body = response.json()
        assert body["status"] == "unknown"
        assert body["title"] == "Not on file"
        # Still has a batch number, so the client shows the result screen.
        assert body["fields"]["batchNumber"] == "ZZ-000"

    async def test_typed_label_matches_scanned_code(self, auth_client, seeded):
        typed = await auth_client.post(
            "/scans/manual", json={"fields": {"batchNumber": "B.NO. 49302"}}
        )
        scanned = await auth_client.post(
            "/scans/manual", json={"fields": {"batchNumber": "49302"}}
        )
        assert typed.json()["status"] == scanned.json()["status"] == "safe"
        assert typed.json()["fields"]["batchNumber"] == "49302"

    async def test_text_scan_extracts_and_verifies(self, auth_client, seeded):
        # No GEMINI_API_KEY in tests, so this exercises the rule-based fallback.
        response = await auth_client.post(
            "/scans/text",
            json={
                "rawText": "PANADOL\nParacetamol 500mg\nB.NO.  49302\nEXP.  12/2026",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["fields"]["batchNumber"] == "49302"
        assert body["status"] == "safe"

    async def test_scan_is_recorded_in_history(self, auth_client, seeded):
        await auth_client.post(
            "/scans/manual",
            json={
                "fields": {"batchNumber": "49302"},
                "location": {"latitude": 1.0, "longitude": 2.0},
            },
        )
        history = await auth_client.get("/scans")
        assert history.status_code == 200
        entries = history.json()
        assert len(entries) == 1
        assert entries[0]["batchNumber"] == "49302"
        assert entries[0]["status"] == "safe"
        assert entries[0]["name"] == "Panadol"
        assert entries[0]["scannedAt"]

    async def test_history_is_newest_first_and_paginated(self, auth_client, seeded):
        for batch in ("49302", "ABC-123", "FAKE-999"):
            await auth_client.post(
                "/scans/manual", json={"fields": {"batchNumber": batch}}
            )
        page = await auth_client.get("/scans", params={"limit": 2})
        assert len(page.json()) == 2
        assert page.json()[0]["batchNumber"] == "FAKE-999"

    async def test_oversized_payload_rejected(self, auth_client):
        response = await auth_client.post("/scans/text", json={"rawText": "x" * 50_000})
        assert response.status_code == 422

    async def test_unknown_field_rejected(self, auth_client):
        response = await auth_client.post(
            "/scans/manual",
            json={"fields": {"batchNumber": "49302"}, "batch_no": "oops"},
        )
        assert response.status_code == 422


class TestOps:
    async def test_health_is_liveness_only(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    async def test_errors_carry_a_request_id(self, client):
        response = await client.get("/scans")
        assert response.status_code == 401
        assert response.json()["requestId"]
        assert response.headers["X-Request-ID"]

    async def test_request_id_is_echoed_when_supplied(self, client):
        response = await client.get("/health", headers={"X-Request-ID": "trace-me"})
        assert response.headers["X-Request-ID"] == "trace-me"
