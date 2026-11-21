"""Read-only API used by spectators and the admin preview."""
from datetime import timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Competition, Group, Match, Team, Tournament
from app.services.clock import now, elapsed
from app.services.standings import live_points, table

router = APIRouter(prefix="/api", tags=["public"])


def match_out(m, names, competition):
    # SQLite stores UTC as a naive value; the PostgreSQL timestamp is aware.
    scheduled = m.scheduled_at
    if scheduled and scheduled.tzinfo is None:
        scheduled = scheduled.replace(tzinfo=timezone.utc)
    return {
        "id": m.id, "group_id": m.group_id, "stage": m.stage, "position": m.position,
        "home_id": m.home_id, "away_id": m.away_id,
        "home_name": names.get(m.home_id, "Por definir"),
        "away_name": names.get(m.away_id, "Por definir"),
        "scheduled_at": scheduled.isoformat() if scheduled else None,
        "court": m.court, "duration_minutes": m.duration_minutes,
        "status": m.status, "home_score": m.home_score, "away_score": m.away_score,
        "home_penalties": m.home_penalties, "away_penalties": m.away_penalties,
        "winner_id": m.winner_id, "decision": m.decision,
        "elapsed_seconds": elapsed(m), "running": m.running_since is not None,
        "segment": m.segment,
        "live_points": live_points(m, competition.win_points, competition.draw_points),
    }


@router.get("/state")
def state(db: Session = Depends(get_db)):
    tournament = db.scalar(select(Tournament).limit(1))
    competition = db.scalar(select(Competition).limit(1))
    groups = db.scalars(select(Group).order_by(Group.id)).all()
    teams = db.scalars(select(Team)).all()
    matches = db.scalars(select(Match).order_by(Match.position)).all()
    if not tournament or not competition:
        return {"ready": False, "groups": [], "knockout": [], "server_time": now().isoformat()}
    names = {t.id: t.name for t in teams}
    group_data = []
    for group in groups:
        members = [t for t in teams if t.group_id == group.id]
        games = sorted([m for m in matches if m.group_id == group.id],
                       key=lambda m: (m.scheduled_at or now(), m.id))
        group_data.append({
            "id": group.id, "revision": group.revision,
            "teams": [{"id": t.id, "name": t.name} for t in sorted(members, key=lambda t: t.name)],
            "table": table({t.id: t.name for t in members}, games,
                           competition.win_points, competition.draw_points),
            "matches": [match_out(m, names, competition) for m in games],
        })
    knockout = [match_out(m, names, competition) for m in matches if m.group_id is None]
    stage_order = {"round16": 0, "quarter": 1, "semi": 2, "final": 3}
    knockout.sort(key=lambda m: (stage_order.get(m["stage"], 9), m["position"]))
    return {"ready": True, "tournament": tournament.name,
            "discipline": competition.discipline, "category": competition.category,
            "server_time": now().isoformat(), "groups": group_data, "knockout": knockout,
            "teams": [{"id": t.id, "name": t.name, "group_id": t.group_id} for t in teams]}
