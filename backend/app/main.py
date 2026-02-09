from __future__ import annotations

from datetime import timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .data import EDUCATION, EVENTS, NEWS, OFFICIALS
from .schemas import CreateEventInput, EducationTopic, Event, NewsArticle, Official

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/api/news", response_model=list[NewsArticle])
def get_news(
    q: str | None = None,
    limit: int = Query(default=25, ge=1, le=200),
    officialId: str | None = None,  # camelCase for the frontend
):
    items = NEWS

    if officialId:
        items = [
            a
            for a in items
            if a.related_official_ids and any(x == officialId for x in a.related_official_ids)
        ]

    if q:
        needle = q.strip().lower()
        items = [
            a
            for a in items
            if needle in a.title.lower()
            or (a.summary and needle in a.summary.lower())
            or (a.tags and any(needle in t.lower() for t in a.tags))
        ]

    items = sorted(items, key=lambda a: a.published_at, reverse=True)
    return items[:limit]


@app.get("/api/events", response_model=list[Event])
def get_events(
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
):
    items = EVENTS
    if q:
        needle = q.strip().lower()
        items = [
            e
            for e in items
            if needle in e.title.lower()
            or (e.location_name and needle in e.location_name.lower())
            or (e.address and needle in e.address.lower())
            or (e.description and needle in e.description.lower())
        ]

    items = sorted(items, key=lambda e: e.starts_at)
    return items[:limit]


@app.post("/api/events", response_model=Event, status_code=201)
def post_event(payload: CreateEventInput):
    # Normalize to an aware datetime for consistent ISO serialization
    starts = payload.starts_at
    if starts.tzinfo is None:
        starts = starts.replace(tzinfo=timezone.utc)

    created = Event(
        id=str(uuid4()),
        title=payload.title.strip(),
        starts_at=starts,
        location_name=(payload.location_name.strip() if payload.location_name else None),
        address=(payload.address.strip() if payload.address else None),
        description=(payload.description.strip() if payload.description else None),
        link=(payload.link.strip() if payload.link else None),
        created_by="community",
    )
    EVENTS.insert(0, created)
    return created


@app.get("/api/officials", response_model=list[Official])
def get_officials(
    q: str | None = None,
    level: str | None = None,
    areaServed: str | None = None,  # camelCase for the frontend
    limit: int = Query(default=200, ge=1, le=1000),
):
    items = OFFICIALS

    if level:
        lv = level.strip().lower()
        items = [o for o in items if (o.level or "").lower() == lv]

    if areaServed:
        needle = areaServed.strip().lower()
        items = [o for o in items if needle in o.area_served.lower()]

    if q:
        needle = q.strip().lower()
        items = [
            o
            for o in items
            if needle in o.name.lower()
            or needle in o.role_title.lower()
            or needle in o.area_served.lower()
        ]

    items = sorted(items, key=lambda o: (o.level or "", o.name))
    return items[:limit]


@app.get("/api/officials/{official_id}", response_model=Official)
def get_official(official_id: str):
    for o in OFFICIALS:
        if o.id == official_id:
            return o
    raise HTTPException(status_code=404, detail="Official not found")


@app.get("/api/education", response_model=list[EducationTopic])
def get_education():
    return EDUCATION

