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
    id: str
    title: str
    starts_at: datetime = Field(..., alias="startsAt")
    location_name: str | None = Field(default=None, alias="locationName")
    address: str | None = None
    description: str | None = None
    link: str | None = None
    created_by: Literal["community", "imported"] | None = Field(default=None, alias="createdBy")


class CreateEventInput(ApiModel):
    title: str = Field(min_length=3, max_length=140)
    starts_at: datetime = Field(..., alias="startsAt")
    location_name: str | None = Field(default=None, alias="locationName", max_length=140)
    address: str | None = Field(default=None, max_length=240)
    description: str | None = Field(default=None, max_length=2000)
    link: str | None = Field(default=None, max_length=500)


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


class EducationTopic(ApiModel):
    id: str
    title: str
    description: str
    bullets: list[str]

