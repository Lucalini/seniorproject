from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field
from pydantic.config import ConfigDict


class ApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class NewsArticle(ApiModel):
    id: str
    title: str
    source: str
    url: str
    published_at: datetime = Field(..., alias="publishedAt")
    summary: str | None = None
    tags: list[str] | None = None
    related_official_ids: list[str] | None = Field(default=None, alias="relatedOfficialIds")


class Event(ApiModel):
    uuid: str
    organizer_id: str | None = Field(default=None, alias="organizerId")
    image_path: str = Field(..., alias="imagePath")
    title: str
    description: str
    event_datetime: datetime = Field(..., alias="datetime")
    address: str
    latitude: float | None = None
    longitude: float | None = None
    distance_meters: float | None = Field(default=None, alias="distanceMeters")


class CreateEventInput(ApiModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(max_length=2000)
    event_datetime: datetime = Field(..., alias="datetime")
    address: str = Field(max_length=500)
    image_path: str = Field(default="events/default.png", alias="imagePath")
    organizer_id: str | None = Field(default=None, alias="organizerId")


class Official(ApiModel):
    id: str
    name: str
    role_title: str = Field(..., alias="roleTitle")
    area_served: str = Field(..., alias="areaServed")
    level: Literal["city", "county", "state", "federal", "other"] | None = None
    office_address: str | None = Field(default=None, alias="officeAddress")
    phone: str | None = None
    email: str | None = None
    website: str | None = None


class Politician(ApiModel):
    id: str
    name: str
    image_object_id: str | None = Field(default=None, alias="imageObjectId")
    bio: str | None = None
    level: str | None = None
    phone: str | None = None
    email: str | None = None


class EducationTopic(ApiModel):
    id: str
    title: str
    description: str
    bullets: list[str]

