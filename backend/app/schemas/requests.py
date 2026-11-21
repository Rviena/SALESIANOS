"""Explicit API inputs prevent accidental writes to server-owned fields."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class MatchEdit(BaseModel):
    id: str
    home_id: str | None = None
    away_id: str | None = None
    home_score: int | None = Field(default=None, ge=0, le=999)
    away_score: int | None = Field(default=None, ge=0, le=999)
    scheduled_at: datetime | None = None
    court: str | None = Field(default=None, max_length=40)
    duration_minutes: int = Field(ge=1, le=300)


class GroupSave(BaseModel):
    revision: int
    matches: list[MatchEdit]


class KnockoutEdit(MatchEdit):
    home_penalties: int | None = Field(default=None, ge=0, le=99)
    away_penalties: int | None = Field(default=None, ge=0, le=99)


class Control(BaseModel):
    action: Literal["start", "halftime", "resume", "extra", "penalties", "finish", "reopen"]
    winner_id: str | None = None
    decision: Literal["score", "extra", "penalties", "manual"] | None = None


class Login(BaseModel):
    password: str
