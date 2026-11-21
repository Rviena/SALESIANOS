"""One end-to-end API check of the organizer-to-spectator flow."""
import importlib

from fastapi.testclient import TestClient


def test_group_live_finish_and_knockout(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("ADMIN_PASSWORD", "test-password")
    monkeypatch.setenv("SECRET_KEY", "unit-test-key-only")

    import app.core.database as database
    importlib.reload(database)
    import app.models.entities as entities
    database.Base.metadata.create_all(database.engine)
    from app.seed import seed
    assert seed() is True
    assert seed() is False  # Seed never overwrites live data.

    from app.main import app
    client = TestClient(app)
    public = client.get("/api/state").json()
    assert len(public["groups"]) == 9
    assert sum(len(g["matches"]) for g in public["groups"]) == 45
    group = public["groups"][0]
    match = group["matches"][0]
    assert all(row["pts"] == 0 for row in group["table"])

    signed_in = client.post("/api/admin/login", json={"password": "test-password"})
    assert signed_in.status_code == 200
    csrf = signed_in.json()["csrf"]
    headers = {"X-CSRF-Token": csrf}
    assert client.post(f"/api/admin/matches/{match['id']}/control", json={"action": "start"}).status_code == 403

    drafts = [dict(id=m["id"], home_id=m["home_id"], away_id=m["away_id"],
                   home_score=2 if m["id"] == match["id"] else None,
                   away_score=1 if m["id"] == match["id"] else None,
                   scheduled_at=m["scheduled_at"], court=m["court"],
                   duration_minutes=m["duration_minutes"]) for m in group["matches"]]
    saved = client.put(f"/api/admin/groups/{group['id']}", json={"revision": 0, "matches": drafts}, headers=headers)
    assert saved.status_code == 200, saved.text
    assert all(row["pts"] == 0 for row in client.get("/api/state").json()["groups"][0]["table"])

    started = client.post(f"/api/admin/matches/{match['id']}/control", json={"action": "start"}, headers=headers)
    assert started.status_code == 200, started.text
    live = client.get("/api/state").json()["groups"][0]["matches"][0]
    assert live["status"] == "live" and live["running"]
    assert live["live_points"] == {"home": 3, "away": 0}
    half = client.post(f"/api/admin/matches/{match['id']}/control", json={"action": "halftime"}, headers=headers)
    assert half.status_code == 200
    assert not client.get("/api/state").json()["groups"][0]["matches"][0]["running"]
    ended = client.post(f"/api/admin/matches/{match['id']}/control", json={"action": "finish"}, headers=headers)
    assert ended.status_code == 200, ended.text
    table = client.get("/api/state").json()["groups"][0]["table"]
    assert table[0]["id"] == match["home_id"] and table[0]["pts"] == 3
    assert table[0]["dg"] == 1

    # A tied elimination match can go directly to penalties, no extra-time prerequisite.
    ko = client.get("/api/state").json()["knockout"][0]
    edit = dict(id=ko["id"], home_id=match["home_id"], away_id=match["away_id"],
                home_score=1, away_score=1, home_penalties=4, away_penalties=3,
                scheduled_at=None, court="A", duration_minutes=20)
    assert client.put(f"/api/admin/knockout/{ko['id']}", json=edit, headers=headers).status_code == 200
    assert client.post(f"/api/admin/matches/{ko['id']}/control", json={"action": "penalties"}, headers=headers).status_code == 409
    assert client.post(f"/api/admin/matches/{ko['id']}/control", json={"action": "start"}, headers=headers).status_code == 200
    assert client.post(f"/api/admin/matches/{ko['id']}/control", json={"action": "penalties"}, headers=headers).status_code == 200
    finalized = client.post(f"/api/admin/matches/{ko['id']}/control", json={"action": "finish", "decision": "penalties"}, headers=headers)
    assert finalized.status_code == 200, finalized.text
    bracket = client.get("/api/state").json()["knockout"]
    assert next(m for m in bracket if m["id"] == "quarter-1")["home_id"] == match["home_id"]
