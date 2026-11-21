"""Source of truth: teams, scheduled matches, clock and audit trail.

Standings are projections calculated from finalized group matches. We never
persist an editable points table that could disagree with a score.
"""
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Tournament(Base):
    __tablename__ = "tournaments"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    competitions: Mapped[list["Competition"]] = relationship(back_populates="tournament")


class Competition(Base):
    __tablename__ = "competitions"
    id: Mapped[int] = mapped_column(primary_key=True)
    tournament_id: Mapped[int] = mapped_column(ForeignKey("tournaments.id"))
    discipline: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(80))
    win_points: Mapped[int] = mapped_column(Integer, default=3)
    draw_points: Mapped[int] = mapped_column(Integer, default=1)
    tournament: Mapped[Tournament] = relationship(back_populates="competitions")


class Promotion(Base):
    __tablename__ = "promotions"
    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    label: Mapped[str] = mapped_column(String(60))


class Group(Base):
    __tablename__ = "groups"
    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    competition_id: Mapped[int] = mapped_column(ForeignKey("competitions.id"))
    revision: Mapped[int] = mapped_column(Integer, default=0)
    teams: Mapped[list["Team"]] = relationship(back_populates="group")
    matches: Mapped[list["Match"]] = relationship(back_populates="group")


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    promotion_id: Mapped[str] = mapped_column(ForeignKey("promotions.id"))
    competition_id: Mapped[int] = mapped_column(ForeignKey("competitions.id"))
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id"))
    name: Mapped[str] = mapped_column(String(60))
    group: Mapped[Group] = relationship(back_populates="teams")
    __table_args__ = (UniqueConstraint("competition_id", "promotion_id"),)


class Match(Base):
    __tablename__ = "matches"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    competition_id: Mapped[int] = mapped_column(ForeignKey("competitions.id"))
    group_id: Mapped[str | None] = mapped_column(ForeignKey("groups.id"), nullable=True)
    stage: Mapped[str] = mapped_column(String(16))  # group, round16, quarter, semi, final
    position: Mapped[int] = mapped_column(Integer, default=0)
    home_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    away_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    court: Mapped[str | None] = mapped_column(String(40), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(String(16), default="scheduled")
    home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    home_penalties: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_penalties: Mapped[int | None] = mapped_column(Integer, nullable=True)
    winner_id: Mapped[str | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    decision: Mapped[str | None] = mapped_column(String(16), nullable=True)
    elapsed_seconds: Mapped[int] = mapped_column(Integer, default=0)
    running_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    segment: Mapped[str] = mapped_column(String(16), default="regular")
    group: Mapped[Group | None] = relationship(back_populates="matches")
    __table_args__ = (
        CheckConstraint("duration_minutes > 0 AND duration_minutes <= 300"),
        CheckConstraint("home_score IS NULL OR home_score >= 0"),
        CheckConstraint("away_score IS NULL OR away_score >= 0"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[str | None] = mapped_column(ForeignKey("matches.id"), nullable=True)
    actor: Mapped[str] = mapped_column(String(80), default="admin")
    action: Mapped[str] = mapped_column(String(60))
    details: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
