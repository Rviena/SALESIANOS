"""A winner fills the next round's corresponding slot.

Octavos teams are assigned by the admin until qualification rules are agreed.
No assumptions about how nine groups produce sixteen qualifiers are embedded.
"""
from sqlalchemy import select

from app.models.entities import Match

STAGES = ("round16", "quarter", "semi", "final")


def propagate(db, match):
    if match.stage not in STAGES or match.stage == "final":
        return
    next_stage = STAGES[STAGES.index(match.stage) + 1]
    next_match = db.scalar(select(Match).where(Match.stage == next_stage,
                  Match.position == match.position // 2,
                  Match.competition_id == match.competition_id))
    if not next_match:
        return
    target = "home_id" if match.position % 2 == 0 else "away_id"
    old = getattr(next_match, target)
    if old != match.winner_id:
        setattr(next_match, target, match.winner_id)
        if next_match.status == "final":
            next_match.status = "scheduled"
            next_match.winner_id = None
            next_match.home_score = next_match.away_score = None
            next_match.home_penalties = next_match.away_penalties = None
            next_match.decision = None
            propagate(db, next_match)
