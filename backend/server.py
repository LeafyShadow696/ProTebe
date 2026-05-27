"""
Remix: Srdce pro Michaelku — FastAPI backend.

Endpoints (all under /api):
  - GET    /api/                          health
  - POST   /api/pair/create               create new pair, returns pair code + owner token
  - POST   /api/pair/join                 join existing pair using code
  - GET    /api/pair/{token}              fetch pair info by token
  - GET    /api/messages/{pair_id}        list messages for pair
  - POST   /api/messages                  create message
  - PATCH  /api/messages/{id}             toggle pin / set reaction
  - DELETE /api/messages/{id}             delete message
  - GET    /api/photos/{pair_id}          list photos
  - POST   /api/photos                    upload photo (base64 data URL)
  - DELETE /api/photos/{id}               delete photo
  - GET    /api/events/{pair_id}          list calendar events
  - POST   /api/events                    create event
  - DELETE /api/events/{id}               delete event
  - GET    /api/places/{pair_id}          list shared places
  - POST   /api/places                    create place
  - DELETE /api/places/{id}               delete place
  - POST   /api/ai/poem                   generate AI Czech love poem
  - POST   /api/ai/quote                  generate short AI love quote
  - POST   /api/ai/message                generate AI message suggestion
"""

from __future__ import annotations

import os
import random
import string
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Pro Tebe 😍")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id() -> str:
    return str(uuid.uuid4())


def gen_code() -> str:
    """Friendly 6-char pair code (no ambiguous chars)."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(alphabet, k=6))


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class PairCreate(BaseModel):
    owner_name: str = Field(default="Já")
    partner_name: str = Field(default="Michaelka")
    anniversary: str = Field(default="2026-04-03")


class PairJoin(BaseModel):
    code: str
    joiner_name: str = Field(default="Michaelka")


class PairPatch(BaseModel):
    owner_name: Optional[str] = None
    partner_name: Optional[str] = None
    profile_photo_owner: Optional[str] = None  # data URL
    profile_photo_partner: Optional[str] = None


class AiDateIdeaIn(BaseModel):
    partner_name: str = "Michaelka"
    season: Optional[str] = None  # zima | jaro | léto | podzim
    time_of_day: Optional[str] = None  # ráno | dopoledne | odpoledne | večer | noc
    weather: Optional[str] = None  # free-text like "slunečno, 22°C"
    vibe: Optional[str] = "any"  # cozy | active | romantic | playful | any


class MessageIn(BaseModel):
    pair_id: str
    sender_token: str
    sender_name: str
    text: str
    voice_seconds: Optional[float] = None
    unlock_date: Optional[str] = None  # ISO date — if set, recipient sees it only after that time


class MessagePatch(BaseModel):
    pinned: Optional[bool] = None
    reaction: Optional[str] = None  # single emoji or null to clear


class PhotoIn(BaseModel):
    pair_id: str
    sender_token: str
    data_url: str
    caption: Optional[str] = ""


class EventIn(BaseModel):
    pair_id: str
    title: str
    date: str  # YYYY-MM-DD
    note: Optional[str] = ""
    type: str = "event"  # event | anniversary | reminder


class PlaceIn(BaseModel):
    pair_id: str
    title: str
    lat: float
    lng: float
    note: Optional[str] = ""


class AiPoemIn(BaseModel):
    pair_id: Optional[str] = None
    mood: Optional[str] = "tender"  # tender | playful | nostalgic | hopeful | passionate
    partner_name: str = "Michaelka"
    hint: Optional[str] = ""


class AiQuoteIn(BaseModel):
    partner_name: str = "Michaelka"
    mood: Optional[str] = None


class AiMessageIn(BaseModel):
    partner_name: str = "Michaelka"
    context: Optional[str] = ""
    tone: Optional[str] = "loving"  # loving | playful | reassuring | thankful


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def clean_doc(doc: dict) -> dict:
    """Drop Mongo's _id and return a plain dict."""
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def get_pair_by_token(token: str) -> Optional[dict]:
    pair = await db.pairs.find_one({"$or": [{"owner_token": token}, {"partner_token": token}]})
    return clean_doc(pair) if pair else None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/")
async def root():
    return {"ok": True, "service": "remix-michaelka", "time": now_iso()}


# ---------------------------------------------------------------------------
# Pair endpoints
# ---------------------------------------------------------------------------
@app.post("/api/pair/create")
async def pair_create(body: PairCreate):
    # Ensure code uniqueness.
    for _ in range(8):
        code = gen_code()
        if not await db.pairs.find_one({"code": code}):
            break
    pair = {
        "id": gen_id(),
        "code": code,
        "owner_token": gen_id(),
        "partner_token": None,
        "owner_name": body.owner_name,
        "partner_name": body.partner_name,
        "anniversary": body.anniversary,
        "created_at": now_iso(),
    }
    await db.pairs.insert_one(pair.copy())
    return clean_doc(pair)


@app.post("/api/pair/join")
async def pair_join(body: PairJoin):
    pair = await db.pairs.find_one({"code": body.code.upper().strip()})
    if not pair:
        raise HTTPException(status_code=404, detail="Pair code not found")
    if pair.get("partner_token"):
        # Re-issue existing token if already joined (idempotent).
        return clean_doc(pair)
    partner_token = gen_id()
    await db.pairs.update_one(
        {"id": pair["id"]},
        {"$set": {"partner_token": partner_token, "partner_name": body.joiner_name}},
    )
    pair["partner_token"] = partner_token
    pair["partner_name"] = body.joiner_name
    return clean_doc(pair)


@app.get("/api/pair/{token}")
async def pair_get(token: str):
    pair = await get_pair_by_token(token)
    if not pair:
        raise HTTPException(status_code=404, detail="Pair not found")
    return pair


@app.patch("/api/pair/{token}")
async def pair_patch(token: str, body: PairPatch):
    pair = await db.pairs.find_one(
        {"$or": [{"owner_token": token}, {"partner_token": token}]}
    )
    if not pair:
        raise HTTPException(status_code=404, detail="Pair not found")
    update = body.model_dump(exclude_none=True)
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.pairs.update_one({"id": pair["id"]}, {"$set": update})
    pair.update(update)
    return clean_doc(pair)


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------
@app.get("/api/messages/{pair_id}")
async def messages_list(pair_id: str):
    docs = await db.messages.find({"pair_id": pair_id}).sort("created_at", 1).to_list(1000)
    return [clean_doc(d) for d in docs]


@app.post("/api/messages")
async def messages_create(body: MessageIn):
    msg = {
        "id": gen_id(),
        "pair_id": body.pair_id,
        "sender_token": body.sender_token,
        "sender_name": body.sender_name,
        "text": body.text,
        "voice_seconds": body.voice_seconds,
        "unlock_date": body.unlock_date,
        "pinned": False,
        "reaction": None,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(msg.copy())
    return clean_doc(msg)


@app.patch("/api/messages/{msg_id}")
async def messages_patch(msg_id: str, body: MessagePatch):
    update: dict[str, Any] = {}
    if body.pinned is not None:
        update["pinned"] = body.pinned
    if body.reaction is not None:
        update["reaction"] = body.reaction or None
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    result = await db.messages.update_one({"id": msg_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    doc = await db.messages.find_one({"id": msg_id})
    return clean_doc(doc)


@app.delete("/api/messages/{msg_id}")
async def messages_delete(msg_id: str):
    result = await db.messages.delete_one({"id": msg_id})
    return {"deleted": result.deleted_count}


# ---------------------------------------------------------------------------
# Photos (stored as base64 data URLs in Mongo — fine for personal scale)
# ---------------------------------------------------------------------------
@app.get("/api/photos/{pair_id}")
async def photos_list(pair_id: str):
    docs = await db.photos.find({"pair_id": pair_id}).sort("created_at", -1).to_list(500)
    return [clean_doc(d) for d in docs]


@app.post("/api/photos")
async def photos_create(body: PhotoIn):
    if not body.data_url.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Expected an image data URL")
    photo = {
        "id": gen_id(),
        "pair_id": body.pair_id,
        "sender_token": body.sender_token,
        "data_url": body.data_url,
        "caption": body.caption or "",
        "created_at": now_iso(),
    }
    await db.photos.insert_one(photo.copy())
    return clean_doc(photo)


@app.delete("/api/photos/{photo_id}")
async def photos_delete(photo_id: str):
    result = await db.photos.delete_one({"id": photo_id})
    return {"deleted": result.deleted_count}


# ---------------------------------------------------------------------------
# Calendar events
# ---------------------------------------------------------------------------
@app.get("/api/events/{pair_id}")
async def events_list(pair_id: str):
    docs = await db.events.find({"pair_id": pair_id}).sort("date", 1).to_list(1000)
    return [clean_doc(d) for d in docs]


@app.post("/api/events")
async def events_create(body: EventIn):
    event = {
        "id": gen_id(),
        "pair_id": body.pair_id,
        "title": body.title,
        "date": body.date,
        "note": body.note or "",
        "type": body.type,
        "created_at": now_iso(),
    }
    await db.events.insert_one(event.copy())
    return clean_doc(event)


@app.delete("/api/events/{event_id}")
async def events_delete(event_id: str):
    result = await db.events.delete_one({"id": event_id})
    return {"deleted": result.deleted_count}


# ---------------------------------------------------------------------------
# Places (Love Map)
# ---------------------------------------------------------------------------
@app.get("/api/places/{pair_id}")
async def places_list(pair_id: str):
    docs = await db.places.find({"pair_id": pair_id}).sort("created_at", -1).to_list(500)
    return [clean_doc(d) for d in docs]


@app.post("/api/places")
async def places_create(body: PlaceIn):
    place = {
        "id": gen_id(),
        "pair_id": body.pair_id,
        "title": body.title,
        "lat": body.lat,
        "lng": body.lng,
        "note": body.note or "",
        "created_at": now_iso(),
    }
    await db.places.insert_one(place.copy())
    return clean_doc(place)


@app.delete("/api/places/{place_id}")
async def places_delete(place_id: str):
    result = await db.places.delete_one({"id": place_id})
    return {"deleted": result.deleted_count}


# ---------------------------------------------------------------------------
# AI endpoints — Emergent LLM key, Claude Sonnet for warm Czech text
# ---------------------------------------------------------------------------
MOOD_DESCRIPTIONS_CZ = {
    "tender": "něžná, jemná a tichá jako večerní šepot",
    "playful": "hravá, lehce škádlivá, plná úsměvu",
    "nostalgic": "nostalgická, plná tichých vzpomínek",
    "hopeful": "naděje plná, světlá, dívající se vpřed",
    "passionate": "vášnivá, hluboká, intenzivní",
}


async def _ai_chat(system: str, prompt: str, *, session: str) -> str:
    """Helper that calls Emergent LLM (Claude Sonnet) and returns plain text."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    chat = (
        LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session,
            system_message=system,
        )
        .with_model("anthropic", "claude-sonnet-4-6")
    )
    response = await chat.send_message(UserMessage(text=prompt))
    return (response or "").strip()


@app.post("/api/ai/poem")
async def ai_poem(body: AiPoemIn):
    mood = MOOD_DESCRIPTIONS_CZ.get(body.mood or "tender", MOOD_DESCRIPTIONS_CZ["tender"])
    system = (
        "Jsi citlivý český básník. Píšeš krátké, originální milostné básně v moderní češtině "
        "s dokonalou diakritikou. Vyhýbáš se klišé, kýči, generickým obratům a opakování. "
        "Tvé básně jsou jemné, obrazné a osobní — působí jako šepot, ne jako pohlednice."
    )
    prompt = (
        f"Napiš krátkou milostnou báseň pro Michaelku.\n"
        f"Nálada: {mood}.\n"
        f"Délka: 4 až 8 veršů.\n"
        f"Formát: pouze báseň, bez nadpisu, bez uvozovek, bez komentáře.\n"
        f"{('Inspirace: ' + body.hint) if body.hint else ''}"
    )
    try:
        text = await _ai_chat(system, prompt, session=f"poem-{gen_id()[:8]}")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI selhalo: {exc}") from exc
    poem = {
        "id": gen_id(),
        "pair_id": body.pair_id,
        "mood": body.mood,
        "text": text,
        "created_at": now_iso(),
    }
    if body.pair_id:
        await db.poems.insert_one(poem.copy())
    return clean_doc(poem)


@app.post("/api/ai/quote")
async def ai_quote(body: AiQuoteIn):
    system = (
        "Jsi tichý český lyrik. Tvoříš velmi krátké, jednovětné nebo dvouvětné milostné citáty "
        "v moderní češtině s dokonalou diakritikou. Bez klišé, bez opakování, bez uvozovek."
    )
    prompt = (
        f"Vytvoř jednu krátkou (max. 18 slov) milostnou myšlenku pro {body.partner_name}. "
        "Bez nadpisu, bez podpisu, bez uvozovek. Pouze samotný citát na jednom řádku."
    )
    try:
        text = await _ai_chat(system, prompt, session=f"quote-{gen_id()[:8]}")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI selhalo: {exc}") from exc
    # Strip stray quotes/newlines just in case.
    text = text.strip().strip('"').strip("'").splitlines()[0] if text else ""
    return {"quote": text, "created_at": now_iso()}


@app.post("/api/ai/message")
async def ai_message(body: AiMessageIn):
    system = (
        "Jsi laskavý průvodce slovem. Pomáháš najít upřímnou krátkou zprávu pro milovanou osobu. "
        "Píšeš česky, s dokonalou diakritikou. Bez klišé, bez emoji, bez podpisu."
    )
    tone_map = {
        "loving": "vřelý a něžný",
        "playful": "hravý a lehce vtipný",
        "reassuring": "uklidňující a podporující",
        "thankful": "vděčný a tichý",
    }
    tone = tone_map.get(body.tone or "loving", tone_map["loving"])
    prompt = (
        f"Napiš jednu krátkou zprávu (1–3 věty) pro {body.partner_name}.\n"
        f"Tón: {tone}.\n"
        f"{('Kontext: ' + body.context) if body.context else ''}\n"
        "Vrať pouze samotný text zprávy, bez uvozovek a bez komentáře."
    )
    try:
        text = await _ai_chat(system, prompt, session=f"msg-{gen_id()[:8]}")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI selhalo: {exc}") from exc
    return {"text": text.strip(), "created_at": now_iso()}


@app.post("/api/ai/dateidea")
async def ai_dateidea(body: AiDateIdeaIn):
    """Generate 3 short creative 'co spolu dnes' date ideas in Czech."""
    system = (
        "Jsi kreativní český průvodce pro páry. Navrhuješ konkrétní, originální a hřejivé "
        "nápady, co dělat spolu — nikdy klišé jako 'kino + restaurace'. Mysli na atmosféru, "
        "smysly, hru, sdílené zážitky. Píšeš česky s dokonalou diakritikou."
    )
    vibe_map = {
        "cozy": "domácí, klidné, do tepla",
        "active": "pohybové, venku, energií nabité",
        "romantic": "romantické, jemné, intimní",
        "playful": "hravé, s úsměvem, s rozpustilostí",
        "any": "libovolné, podle nálady",
    }
    bits = []
    if body.season:
        bits.append(f"roční období: {body.season}")
    if body.time_of_day:
        bits.append(f"denní doba: {body.time_of_day}")
    if body.weather:
        bits.append(f"počasí: {body.weather}")
    bits.append(f"nálada: {vibe_map.get(body.vibe or 'any', vibe_map['any'])}")
    context = "; ".join(bits)

    prompt = (
        f"Navrhni 3 krátké nápady, co může dnes podniknout pár (já a {body.partner_name}).\n"
        f"Kontext: {context}.\n"
        "Každý nápad max. 14 slov, jedna věta. Bez číslování, bez odrážek, bez uvozovek.\n"
        "Vrať přesně 3 řádky, na každém jeden nápad."
    )
    try:
        text = await _ai_chat(system, prompt, session=f"date-{gen_id()[:8]}")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI selhalo: {exc}") from exc

    # Clean lines: drop empties, leading bullets/dashes/numbers.
    raw_lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    cleaned = []
    for ln in raw_lines:
        # Strip leading "1.", "- ", "• " etc.
        while ln and ln[0] in "-•*0123456789.) ":
            ln = ln[1:].lstrip()
        ln = ln.strip("\"'„""")
        if ln:
            cleaned.append(ln)
    ideas = cleaned[:3]
    return {"ideas": ideas, "created_at": now_iso()}
