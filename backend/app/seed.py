"""Import the supplied 45-match fixture exactly once, then prepare empty rounds.

Run after `alembic upgrade head`. Re-running never overwrites live results.
The actual competition date is kept in one constant for easy correction.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.entities import Competition, Group, Match, Promotion, Team, Tournament

EVENT_DATE = "2026-11-21"
LOCAL_ZONE = ZoneInfo("America/Lima")
FIXTURE = Path(__file__).parent / "data" / "fixture.json"


def seed():
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    with SessionLocal.begin() as db:
        if db.scalar(select(Tournament.id).limit(1)) is not None:
            return False
        db.add(Tournament(id=1, name="Salesianos FEST 2026"))
        db.flush()
        db.add(Competition(id=1, tournament_id=1, discipline="Fulbito",
                           category="Interpromociones", win_points=3, draw_points=1))
        db.flush()
        db.add_all(Group(id=group["id"], competition_id=1, revision=0)
                   for group in fixture["groups"])
        db.flush()
        seen = set()
        for group in fixture["groups"]:
            for label in group["teams"]:
                if label not in seen:
                    db.add(Promotion(id=label, label=label)); seen.add(label)
        db.flush()
        for group in fixture["groups"]:
            for label in group["teams"]:
                db.add(Team(id=label, promotion_id=label, competition_id=1,
                            group_id=group["id"], name=label))
        db.flush()
        for group in fixture["groups"]:
            for match in group["matches"]:
                date = datetime.fromisoformat(f"{EVENT_DATE}T{match['start']}:00").replace(tzinfo=LOCAL_ZONE).astimezone(timezone.utc)
                db.add(Match(id=match["id"], competition_id=1, group_id=group["id"],
                             stage="group", home_id=match["home"], away_id=match["away"],
                             scheduled_at=date, court=match["court"], duration_minutes=30,
                             status="scheduled", position=0, elapsed_seconds=0, segment="regular"))
        for stage, count in (("round16", 8), ("quarter", 4), ("semi", 2), ("final", 1)):
            for pos in range(count):
                db.add(Match(id=f"{stage}-{pos+1}", competition_id=1, group_id=None,
                             stage=stage, position=pos, status="scheduled",
                             duration_minutes=30, elapsed_seconds=0, segment="regular"))
    return True


if __name__ == "__main__":
    print("Fixture inicial cargado" if seed() else "Fixture ya existente; no se modificó")
