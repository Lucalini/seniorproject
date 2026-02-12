from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from supabase import Client, create_client

from .config import Settings


def _client() -> Client:
    # Re-read settings at call time so changes to backend/.env
    # take effect without relying on module import order/reload behavior.
    settings = Settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env",
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def list_politicians(*, q: str | None, level: str | None, limit: int) -> list[dict[str, Any]]:
    sb = _client()
    query = sb.table("politicians").select(
        "id,name,image_object_id,bio,level,phone,email"
    )

    if level:
        query = query.eq("level", level)

    if q:
        needle = f"%{q.strip()}%"
        # Simple name/bio search; can be upgraded to full-text later.
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

