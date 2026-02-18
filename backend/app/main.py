from __future__ import annotations

from datetime import timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .data import EDUCATION, NEWS
from .geocoding import geocode_address
from .schemas import CreateEventInput, EducationTopic, Event, NewsArticle, Politician
from .supabase_repo import (
    create_event,
    get_politician,
    list_events,
    list_politicians,
)

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
    fromDate: str | None = None,
    toDate: str | None = None,
    organizerId: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius: float = Query(default=50_000, ge=1, description="Search radius in meters"),
):
    rows = list_events(
        q=q,
        from_date=fromDate,
        to_date=toDate,
        organizer_id=organizerId,
        lat=lat,
        lng=lng,
        radius_meters=radius,
        limit=limit,
    )
    return [Event.model_validate(r) for r in rows]


@app.post("/api/events", response_model=Event, status_code=201)
def post_event(payload: CreateEventInput):
    try:
        lat, lng = geocode_address(payload.address)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    dt = payload.event_datetime
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    row = create_event(
        title=payload.title.strip(),
        description=payload.description.strip(),
        event_datetime=dt.isoformat(),
        address=payload.address.strip(),
        latitude=lat,
        longitude=lng,
        image_path=payload.image_path.strip(),
        organizer_id=payload.organizer_id,
    )
    return Event.model_validate(row)


@app.get("/api/officials", response_model=list[Politician])
def get_officials(
    q: str | None = None,
    level: str | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
):
    # Supabase `politicians` table (id/name/image_object_id/bio/level/phone/email)
    items = list_politicians(q=q, level=level, limit=limit)
    # Pydantic will serialize `image_object_id` as `imageObjectId`
    return [Politician.model_validate(x) for x in items]


@app.get("/api/officials/{official_id}", response_model=Politician)
def get_official(official_id: str):
    row = get_politician(official_id)
    if not row:
        raise HTTPException(status_code=404, detail="Official not found")
    return Politician.model_validate(row)


@app.get("/api/education", response_model=list[EducationTopic])
def get_education():
    return EDUCATION

