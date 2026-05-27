"""Backend tests for Remix: Srdce pro Michaelku."""
import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # fallback to frontend/.env
    from pathlib import Path
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip()
BASE_URL = BASE_URL.rstrip("/")

API = f"{BASE_URL}/api"

# tiny 1x1 PNG data URL
PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})


@pytest.fixture(scope="module")
def pair():
    r = session.post(f"{API}/pair/create", json={"owner_name": "TEST_Owner", "partner_name": "TEST_Michaelka"})
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Health ----------
def test_health():
    r = session.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "service" in data


# ---------- Pair ----------
def test_pair_create_fields(pair):
    assert "id" in pair and "code" in pair
    assert len(pair["code"]) == 6
    assert re.match(r"^[A-Z0-9]{6}$", pair["code"])
    assert pair["owner_token"]
    assert pair["partner_token"] is None
    assert pair["anniversary"] == "2026-04-03"


def test_pair_join_valid(pair):
    r = session.post(f"{API}/pair/join", json={"code": pair["code"], "joiner_name": "TEST_Joiner"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["partner_token"] is not None
    assert data["id"] == pair["id"]
    pair["partner_token"] = data["partner_token"]


def test_pair_join_invalid():
    r = session.post(f"{API}/pair/join", json={"code": "ZZZZZZ", "joiner_name": "x"})
    assert r.status_code == 404


def test_pair_get_by_owner_token(pair):
    r = session.get(f"{API}/pair/{pair['owner_token']}")
    assert r.status_code == 200
    assert r.json()["id"] == pair["id"]


def test_pair_get_by_partner_token(pair):
    r = session.get(f"{API}/pair/{pair['partner_token']}")
    assert r.status_code == 200
    assert r.json()["id"] == pair["id"]


def test_pair_get_invalid_token():
    r = session.get(f"{API}/pair/nonexistent-token-xyz")
    assert r.status_code == 404


# ---------- Messages ----------
def test_messages_crud(pair):
    # create
    r = session.post(f"{API}/messages", json={
        "pair_id": pair["id"],
        "sender_token": pair["owner_token"],
        "sender_name": "TEST_Owner",
        "text": "Ahoj lásko ❤",
    })
    assert r.status_code == 200, r.text
    msg = r.json()
    assert msg["text"] == "Ahoj lásko ❤"
    assert msg["pinned"] is False
    msg_id = msg["id"]

    # list
    r = session.get(f"{API}/messages/{pair['id']}")
    assert r.status_code == 200
    assert any(m["id"] == msg_id for m in r.json())

    # patch pin
    r = session.patch(f"{API}/messages/{msg_id}", json={"pinned": True})
    assert r.status_code == 200
    assert r.json()["pinned"] is True

    # patch reaction
    r = session.patch(f"{API}/messages/{msg_id}", json={"reaction": "❤"})
    assert r.status_code == 200
    assert r.json()["reaction"] == "❤"

    # delete
    r = session.delete(f"{API}/messages/{msg_id}")
    assert r.status_code == 200
    assert r.json()["deleted"] == 1


def test_messages_patch_not_found():
    r = session.patch(f"{API}/messages/no-such-id", json={"pinned": True})
    assert r.status_code == 404


# ---------- Time Capsule (unlock_date) ----------
def test_message_without_unlock_date_is_null(pair):
    """Backward compat: omitted unlock_date returns null in response."""
    r = session.post(f"{API}/messages", json={
        "pair_id": pair["id"],
        "sender_token": pair["owner_token"],
        "sender_name": "TEST_Owner",
        "text": "TEST_no_capsule",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "unlock_date" in data
    assert data["unlock_date"] is None
    session.delete(f"{API}/messages/{data['id']}")


def test_message_with_unlock_date_persisted(pair):
    """POST with unlock_date stores it and GET list includes the field."""
    unlock = "2027-01-15"
    r = session.post(f"{API}/messages", json={
        "pair_id": pair["id"],
        "sender_token": pair["owner_token"],
        "sender_name": "TEST_Owner",
        "text": "TEST_capsule_message",
        "unlock_date": unlock,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["unlock_date"] == unlock
    msg_id = data["id"]

    # Verify via GET list
    r = session.get(f"{API}/messages/{pair['id']}")
    assert r.status_code == 200
    found = [m for m in r.json() if m["id"] == msg_id]
    assert found, "Created capsule message not found in list"
    assert found[0]["unlock_date"] == unlock
    # all returned messages should have unlock_date field (even null for old ones)
    for m in r.json():
        assert "unlock_date" in m
    session.delete(f"{API}/messages/{msg_id}")


def test_message_with_explicit_null_unlock_date(pair):
    """Explicit null unlock_date is accepted."""
    r = session.post(f"{API}/messages", json={
        "pair_id": pair["id"],
        "sender_token": pair["owner_token"],
        "sender_name": "TEST_Owner",
        "text": "TEST_null_capsule",
        "unlock_date": None,
    })
    assert r.status_code == 200, r.text
    assert r.json()["unlock_date"] is None
    session.delete(f"{API}/messages/{r.json()['id']}")


# ---------- Photos ----------
def test_photos_crud(pair):
    # invalid data url -> 400
    r = session.post(f"{API}/photos", json={
        "pair_id": pair["id"],
        "sender_token": pair["owner_token"],
        "data_url": "notanimage",
    })
    assert r.status_code == 400

    # valid
    r = session.post(f"{API}/photos", json={
        "pair_id": pair["id"],
        "sender_token": pair["owner_token"],
        "data_url": PNG_DATA_URL,
        "caption": "TEST_cap",
    })
    assert r.status_code == 200, r.text
    photo = r.json()
    pid = photo["id"]
    assert photo["caption"] == "TEST_cap"

    # list
    r = session.get(f"{API}/photos/{pair['id']}")
    assert r.status_code == 200
    assert any(p["id"] == pid for p in r.json())

    # delete
    r = session.delete(f"{API}/photos/{pid}")
    assert r.status_code == 200


# ---------- Events ----------
@pytest.mark.parametrize("etype", ["event", "anniversary", "reminder"])
def test_events_crud(pair, etype):
    r = session.post(f"{API}/events", json={
        "pair_id": pair["id"],
        "title": f"TEST_{etype}",
        "date": "2026-05-01",
        "note": "",
        "type": etype,
    })
    assert r.status_code == 200, r.text
    eid = r.json()["id"]

    r = session.get(f"{API}/events/{pair['id']}")
    assert r.status_code == 200
    found = [e for e in r.json() if e["id"] == eid]
    assert found and found[0]["type"] == etype

    r = session.delete(f"{API}/events/{eid}")
    assert r.status_code == 200


# ---------- Places ----------
def test_places_crud(pair):
    r = session.post(f"{API}/places", json={
        "pair_id": pair["id"],
        "title": "TEST_místo",
        "lat": 50.0755,
        "lng": 14.4378,
        "note": "Praha",
    })
    assert r.status_code == 200, r.text
    place = r.json()
    pid = place["id"]
    assert place["title"] == "TEST_místo"

    r = session.get(f"{API}/places/{pair['id']}")
    assert r.status_code == 200
    assert any(p["id"] == pid for p in r.json())

    r = session.delete(f"{API}/places/{pid}")
    assert r.status_code == 200


# ---------- AI ----------
CZECH_DIACRITICS = set("áéíóúýčďěňřšťůž" + "ÁÉÍÓÚÝČĎĚŇŘŠŤŮŽ")


def has_czech(text: str) -> bool:
    return any(c in CZECH_DIACRITICS for c in text)


@pytest.mark.parametrize("mood", ["tender", "playful"])
def test_ai_poem(pair, mood):
    r = session.post(f"{API}/ai/poem", json={
        "pair_id": pair["id"],
        "mood": mood,
        "partner_name": "Michaelka",
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "text" in data and len(data["text"]) > 10
    assert has_czech(data["text"]), f"No Czech diacritics in: {data['text']!r}"


def test_ai_quote():
    r = session.post(f"{API}/ai/quote", json={"partner_name": "Michaelka"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "quote" in data and data["quote"]
    # one line
    assert "\n" not in data["quote"]


def test_ai_message():
    r = session.post(f"{API}/ai/message", json={"partner_name": "Michaelka", "tone": "loving"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["text"] and len(data["text"]) > 5
    assert has_czech(data["text"])
