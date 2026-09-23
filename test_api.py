# test_api.py — API tests for VerseSpace
# Run with: pytest -v
#
# Order: smoke test, then happy-path creation, then the core bid rule
# (both sides), then validation / error cases.

import tempfile
import os
from pathlib import Path

import pytest

import app as app_module


@pytest.fixture
def client():
    # Fresh temporary database for each test (isolation)
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    app_module.DB_PATH = Path(db_path)
    app_module.init_db()
    with app_module.app.test_client() as test_client:
        yield test_client
    os.close(db_fd)
    os.unlink(db_path)


# ─── Helper functions (reduce repetition in tests) ───────────────────────────

def make_request(client, tone="warm", budget=40):
    # Creates a poem request, returns its id
    resp = client.post("/api/requests", json={
        "occasion": "Birthday",
        "tone": tone,
        "subject": "My friend",
        "detail": "Our trip to the coast",
        "budget": budget,
    })
    return resp


def make_poet(client, name="Test Poet"):
    # Registers a poet, returns the response
    resp = client.post("/api/poets", json={
        "name": name,
        "specialty": "Weddings",
        "sample": "A sample line",
        "rate": 30,
    })
    return resp


# ─── 1. Smoke test ───────────────────────────────────────────────────────────

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json()["ok"] is True


# ─── 2. Happy-path creation ──────────────────────────────────────────────────

def test_create_poet(client):
    response = make_poet(client, name="Test Poet")
    assert response.status_code == 201
    data = response.get_json()
    assert data["ok"] is True
    assert data["poet"]["name"] == "Test Poet"
    assert data["poet"]["id"] > 0


def test_create_request(client):
    response = make_request(client, tone="romantic")
    assert response.status_code == 201
    data = response.get_json()
    assert data["ok"] is True
    assert data["request"]["id"] > 0


def test_poet_can_bid_on_request(client):
    request_id = make_request(client).get_json()["request"]["id"]
    poet_id = make_poet(client).get_json()["poet"]["id"]
    response = client.post(f"/api/requests/{request_id}/bids", json={
        "poetId": poet_id,
        "amount": 40,
    })
    assert response.status_code == 201


# ─── 3. The core bid rule — BOTH sides ───────────────────────────────────────

def test_poet_cannot_bid_twice_on_same_request(client):
    # A poet may not bid twice on the SAME request
    request_id = make_request(client).get_json()["request"]["id"]
    poet_id = make_poet(client).get_json()["poet"]["id"]

    first = client.post(f"/api/requests/{request_id}/bids",
                        json={"poetId": poet_id, "amount": 40})
    assert first.status_code == 201

    second = client.post(f"/api/requests/{request_id}/bids",
                         json={"poetId": poet_id, "amount": 40})
    assert second.status_code == 409
    assert "already applied" in second.get_json()["error"]


def test_poet_can_bid_on_different_requests(client):
    # The SAME poet CAN bid on two DIFFERENT requests (rule is per-request)
    request_a = make_request(client).get_json()["request"]["id"]
    request_b = make_request(client).get_json()["request"]["id"]
    poet_id = make_poet(client).get_json()["poet"]["id"]

    bid_a = client.post(f"/api/requests/{request_a}/bids",
                       json={"poetId": poet_id, "amount": 40})
    assert bid_a.status_code == 201

    bid_b = client.post(f"/api/requests/{request_b}/bids",
                       json={"poetId": poet_id, "amount": 40})
    assert bid_b.status_code == 201   # allowed — different request


# ─── 4. Validation / error cases ─────────────────────────────────────────────

def test_invalid_tone_is_rejected(client):
    response = client.post("/api/requests", json={
        "occasion": "Birthday",
        "tone": "spicy",          # not in the allowlist
        "subject": "My friend",
        "detail": "A detail",
        "budget": 40,
    })
    assert response.status_code == 400


def test_missing_field_is_rejected(client):
    response = client.post("/api/requests", json={
        "tone": "warm",
        "subject": "My friend",
        "detail": "A detail",
        "budget": 40,
        # 'occasion' is missing on purpose
    })
    assert response.status_code == 400


def test_bid_below_minimum_is_rejected(client):
    request_id = make_request(client, budget=50).get_json()["request"]["id"]
    poet_id = make_poet(client).get_json()["poet"]["id"]
    response = client.post(f"/api/requests/{request_id}/bids", json={
        "poetId": poet_id,
        "amount": 10,             # below the request's budget of 50
    })
    assert response.status_code == 400


def test_bid_on_nonexistent_request_is_rejected(client):
    poet_id = make_poet(client).get_json()["poet"]["id"]
    response = client.post("/api/requests/9999/bids", json={
        "poetId": poet_id,
        "amount": 40,
    })
    assert response.status_code == 404


def test_bid_from_nonexistent_poet_is_rejected(client):
    request_id = make_request(client).get_json()["request"]["id"]
    response = client.post(f"/api/requests/{request_id}/bids", json={
        "poetId": 9999,           # no such poet
        "amount": 40,
    })
    assert response.status_code == 404
