"""Authenticated organizer actions, committed transactionally."""
import hmac
import os
import secrets

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Group, Match, Team
from app.schemas.requests import Control, GroupSave, KnockoutEdit, Login
from app.services.bracket import propagate
from app.services.matches import control, log

router = APIRouter(prefix="/api/admin", tags=["admin"])
SESSION_AGE = 60 * 60 * 12


def signer():
    key = os.getenv("SECRET_KEY")
    if not key:
        raise HTTPException(503, "Configura SECRET_KEY en el servidor")
    return URLSafeTimedSerializer(key, salt="salesianos-admin-v1")


def read_session(salesianos_session: str | None = Cookie(default=None)):
    if not salesianos_session:
        raise HTTPException(401, "Inicia sesión como administrador")
    try:
        return signer().loads(salesianos_session, max_age=SESSION_AGE)
    except (BadSignature, SignatureExpired):
        raise HTTPException(401, "La sesión venció")


def require_admin(session=Depends(read_session), x_csrf_token: str | None = Header(default=None)):
    if not x_csrf_token or not hmac.compare_digest(x_csrf_token, session.get("csrf", "")):
        raise HTTPException(403, "Falta la protección de la sesión")
    return session


@router.get("/session")
def session_status(salesianos_session: str | None = Cookie(default=None)):
    try:
        data = read_session(salesianos_session)
        return {"authenticated": True, "csrf": data["csrf"]}
    except HTTPException:
        return {"authenticated": False}


@router.post("/login")
def login(body: Login, response: Response):
    password = os.getenv("ADMIN_PASSWORD")
    if not password:
        raise HTTPException(503, "Configura ADMIN_PASSWORD en el servidor")
    if not hmac.compare_digest(body.password, password):
        raise HTTPException(401, "Contraseña incorrecta")
    csrf = secrets.token_urlsafe(32)
    response.set_cookie("salesianos_session", signer().dumps({"csrf": csrf}),
                        max_age=SESSION_AGE, httponly=True, samesite="lax",
                        secure=os.getenv("COOKIE_SECURE") == "true", path="/")
    return {"authenticated": True, "csrf": csrf}


@router.post("/logout")
def logout(response: Response, _=Depends(require_admin)):
    response.delete_cookie("salesianos_session", path="/")
    return {"authenticated": False}


def apply_fields(match, edit):
    for field in ("home_id", "away_id", "home_score", "away_score", "scheduled_at", "court", "duration_minutes"):
        setattr(match, field, getattr(edit, field))
    if match.status == "final" and match.home_score is not None and match.away_score is not None:
        if match.home_score != match.away_score and match.decision != "manual":
            match.winner_id = match.home_id if match.home_score > match.away_score else match.away_id
            match.decision = "score"
        elif match.home_score == match.away_score and match.decision == "score":
            match.winner_id = None; match.decision = "draw"


@router.put("/groups/{group_id}", dependencies=[Depends(require_admin)])
def save_group(group_id: str, body: GroupSave, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(404, "Grupo no encontrado")
    if group.revision != body.revision:
        raise HTTPException(409, "Este grupo cambió en otra sesión. Recarga antes de guardar")
    matches = {m.id: m for m in db.scalars(select(Match).where(Match.group_id == group_id))}
    allowed_teams = set(db.scalars(select(Team.id).where(Team.group_id == group_id)).all())
    if len(body.matches) != len(matches) or {m.id for m in body.matches} != set(matches):
        raise HTTPException(422, "Envía todos los partidos del grupo una sola vez")
    for edit in body.matches:
        if edit.home_id not in allowed_teams or edit.away_id not in allowed_teams or edit.home_id == edit.away_id:
            raise HTTPException(422, f"Revisa los rivales del partido {edit.id}")
        match = matches[edit.id]
        previous = {"home": match.home_id, "away": match.away_id,
                    "score": [match.home_score, match.away_score]}
        apply_fields(match, edit)
        log(db, match, "group_update", {"before": previous, "after": edit.model_dump(mode="json")})
    changed = db.execute(update(Group).where(Group.id == group_id, Group.revision == body.revision)
                         .values(revision=Group.revision + 1))
    if changed.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "Este grupo cambió en otra sesión. Recarga antes de guardar")
    db.commit()
    return {"saved": True, "revision": body.revision + 1}


@router.put("/knockout/{match_id}", dependencies=[Depends(require_admin)])
def save_knockout(match_id: str, edit: KnockoutEdit, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if not match or match.group_id is not None or match.id != edit.id:
        raise HTTPException(404, "Partido de llave no encontrado")
    team_ids = set(db.scalars(select(Team.id)).all())
    if (edit.home_id and edit.home_id not in team_ids) or (edit.away_id and edit.away_id not in team_ids):
        raise HTTPException(422, "Equipo desconocido")
    if edit.home_id and edit.home_id == edit.away_id:
        raise HTTPException(422, "Elige dos equipos distintos")
    apply_fields(match, edit)
    match.home_penalties = edit.home_penalties
    match.away_penalties = edit.away_penalties
    log(db, match, "knockout_update", edit.model_dump(mode="json"))
    if match.status == "final":
        propagate(db, match)
    db.commit()
    return {"saved": True}


@router.post("/matches/{match_id}/control", dependencies=[Depends(require_admin)])
def control_match(match_id: str, body: Control, db: Session = Depends(get_db)):
    match = db.get(Match, match_id)
    if not match:
        raise HTTPException(404, "Partido no encontrado")
    control(db, match, body.action, body.winner_id, body.decision)
    if match.group_id:
        db.get(Group, match.group_id).revision += 1
    db.commit()
    return {"saved": True}
