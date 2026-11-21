"""Validate organizer actions and keep result, clock and bracket coherent."""
import json

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.entities import AuditLog, Match
from app.services.bracket import propagate
from app.services.clock import now, pause, run


def log(db: Session, match: Match, action: str, details: dict):
    db.add(AuditLog(match_id=match.id, actor="admin", action=action,
                    details=json.dumps(details, ensure_ascii=False, default=str), created_at=now()))


def control(db: Session, match: Match, action: str, winner_id=None, decision=None):
    current = match.status
    allowed = {
        "start": ("scheduled",),
        "halftime": ("live", "extra"),
        "resume": ("halftime", "penalties"),
        "extra": ("live", "halftime", "penalties"),
        "penalties": ("live", "halftime", "extra"),
        "finish": ("scheduled", "live", "halftime", "extra", "penalties"),
        "reopen": ("final",),
    }
    if current not in allowed[action]:
        raise HTTPException(409, f"No se puede usar {action} desde {current}")
    if action in ("halftime", "penalties", "finish", "reopen"):
        pause(match)
    if action == "start":
        match.status = "live"; match.segment = "regular"; run(match)
    elif action == "halftime":
        match.status = "halftime"
    elif action == "resume":
        match.status = "live"; run(match)
    elif action == "extra":
        match.status = "extra"; match.segment = "extra"; run(match)
    elif action == "penalties":
        match.status = "penalties"; match.segment = "penalties"
    elif action == "reopen":
        match.status = "scheduled"; match.winner_id = None; match.decision = None
        match.elapsed_seconds = 0; match.segment = "regular"
        if match.group_id is None:
            propagate(db, match)
    elif action == "finish":
        if match.home_score is None or match.away_score is None:
            raise HTTPException(422, "Ingresa ambos marcadores antes de finalizar")
        if winner_id and winner_id not in (match.home_id, match.away_id):
            raise HTTPException(422, "El ganador debe ser uno de los equipos del partido")
        if match.home_score != match.away_score:
            inferred = match.home_id if match.home_score > match.away_score else match.away_id
            if winner_id and winner_id != inferred and decision != "manual":
                raise HTTPException(422, "El ganador no coincide con el marcador")
            match.winner_id = winner_id or inferred
            match.decision = decision or ("manual" if winner_id and winner_id != inferred else "score")
        else:
            if decision == "penalties":
                if match.home_penalties is None or match.away_penalties is None or match.home_penalties == match.away_penalties:
                    raise HTTPException(422, "Ingresa un marcador de penales con ganador")
                inferred = match.home_id if match.home_penalties > match.away_penalties else match.away_id
                if winner_id and winner_id != inferred:
                    raise HTTPException(422, "El ganador no coincide con los penales")
                match.winner_id = inferred
                match.decision = "penalties"
            elif winner_id:
                match.winner_id = winner_id; match.decision = "manual"
            elif match.group_id is not None:
                match.winner_id = None; match.decision = "draw"
            else:
                raise HTTPException(422, "Elige un ganador, por penales o decisión directa")
        match.status = "final"
        if match.group_id is None:
            propagate(db, match)
    log(db, match, action, {"before": current, "after": match.status,
                            "winner_id": match.winner_id, "decision": match.decision})
