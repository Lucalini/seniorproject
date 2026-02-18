from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from supabase import Client, create_client

from .config import Settings


def _client() -> Client:
    settings = Settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env",
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# ── Politicians ──────────────────────────────────────────────


def list_politicians(*, q: str | None, level: str | None, limit: int) -> list[dict[str, Any]]:
    sb = _client()
    query = sb.table("politicians").select(
        "id,name,image_object_id,bio,level,phone,email"
    )

    if level:
        query = query.eq("level", level)

    if q:
        needle = f"%{q.strip()}%"
        query = query.or_(f"name.ilike.{needle},bio.ilike.{needle}")

    res = query.limit(limit).execute()
    return list(res.data or [])


def get_politician(politician_id: str) -> dict[str, Any] | None:
    sb = _client()
    res = (
        sb.table("politicians")
        .select("id,name,image_object_id,bio,level,phone,email")
        .eq("id", politician_id)
        .limit(1)
        .execute()
    )
    data = list(res.data or [])
    return data[0] if data else None


# ── Events ───────────────────────────────────────────────────


def list_events(
    *,
    q: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    organizer_id: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_meters: float = 50_000,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Fetch events via the ``search_events`` Postgres RPC.

    All filter parameters are optional; omitted params use the SQL
    defaults (i.e. no filtering on that dimension).
    """
    sb = _client()
    params: dict[str, Any] = {"lim": limit}

    if q:
        params["search_query"] = q.strip()
    if from_date:
        params["from_ts"] = from_date
    if to_date:
        params["to_ts"] = to_date
    if organizer_id:
        params["org_id"] = organizer_id
    if lat is not None and lng is not None:
        params["lat"] = lat
        params["lng"] = lng
        params["radius_meters"] = radius_meters

    res = sb.rpc("search_events", params).execute()
    return list(res.data or [])


def create_event(
    *,
    title: str,
    description: str,
    event_datetime: str,
    address: str,
    latitude: float,
    longitude: float,
    image_path: str = "events/default.png",
    organizer_id: str | None = None,
) -> dict[str, Any]:
    """Insert a new event via the ``create_event`` Postgres RPC.

    Returns the created row with lat/lng extracted from the geo column.
    """
    sb = _client()
    params: dict[str, Any] = {
        "p_title": title,
        "p_description": description,
        "p_datetime": event_datetime,
        "p_address": address,
        "p_latitude": latitude,
        "p_longitude": longitude,
        "p_image_path": image_path,
    }
    if organizer_id:
        params["p_organizer_id"] = organizer_id

    res = sb.rpc("create_event", params).execute()
    data = list(res.data or [])
    if not data:
        raise HTTPException(status_code=500, detail="Failed to create event")
    return data[0]

