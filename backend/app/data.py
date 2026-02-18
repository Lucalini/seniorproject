from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .schemas import EducationTopic, NewsArticle, Official


def _utc_now() -> datetime:
    return datetime.now(tz=timezone.utc)


# NOTE: This is intentionally placeholder seed data.
# Replace with real ingestion + a database once you wire up sources.

OFFICIALS: list[Official] = [
    Official(
        id="slo-county-bos-d1",
        name="SLO County Supervisor (District 1)",
        role_title="County Supervisor",
        area_served="San Luis Obispo County · District 1",
        level="county",
        website="https://www.slocounty.ca.gov/",
    ),
    Official(
        id="slo-city-council",
        name="City of San Luis Obispo Council",
        role_title="City Council",
        area_served="City of San Luis Obispo",
        level="city",
        website="https://www.slocity.org/",
    ),
]

NEWS: list[NewsArticle] = [
    NewsArticle(
        id="example-1",
        title="Example: Local housing policy update (replace with real feed)",
        source="Prototype",
        url="https://www.slocounty.ca.gov/",
        published_at=_utc_now() - timedelta(hours=8),
        summary="This is placeholder content to validate your UI + API contract.",
        tags=["housing", "county"],
        related_official_ids=["slo-county-bos-d1"],
    ),
    NewsArticle(
        id="example-2",
        title="Example: City council agenda posted (replace with real feed)",
        source="Prototype",
        url="https://www.slocity.org/",
        published_at=_utc_now() - timedelta(days=1, hours=3),
        summary="Next step: ingest agendas/minutes and link them to events + officials.",
        tags=["city", "agenda"],
        related_official_ids=["slo-city-council"],
    ),
]

EDUCATION: list[EducationTopic] = [
    EducationTopic(
        id="how-local-government-works",
        title="How city & county government works",
        description="A quick mental model for what decisions get made where.",
        bullets=[
            "City councils: land use, local ordinances, budgets, city services.",
            "County supervisors: unincorporated areas, countywide services, public health.",
            "Planning commissions: recommendations on development + zoning.",
            "Special districts: water, fire, transit, etc. (often elected boards).",
        ],
    ),
    EducationTopic(
        id="how-to-create-change",
        title="Practical strategies to create change",
        description="Tactics that work even if you’re new to local politics.",
        bullets=[
            "Show up: comment at meetings (in-person or Zoom) and follow up in writing.",
            "Organize: petitions, phone banking, canvassing, mutual aid, coalitions.",
            "Track power: budgets, commissions, endorsements, and decision timelines.",
            "Make it easy: share summaries + links so others can act quickly.",
        ],
    ),
    EducationTopic(
        id="issues-and-topics",
        title="Issues & topics",
        description="This section can evolve into explainers for SLO-specific topics.",
        bullets=[
            "Housing & zoning",
            "Water, climate, and resilience",
            "Public safety & jail policy",
            "Transportation, biking, and transit",
            "Education and school boards",
        ],
    ),
]

