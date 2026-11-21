"""Derive official standings from completed matches only."""
def table(team_names, matches, win_points=3, draw_points=1):
    rows = {team_id: dict(id=team_id, name=name, pj=0, g=0, e=0, p=0,
                          gf=0, gc=0, dg=0, pts=0) for team_id, name in team_names.items()}
    for match in matches:
        if match.status != "final" or match.home_id not in rows or match.away_id not in rows:
            continue
        if match.home_score is None or match.away_score is None:
            continue
        a, b = rows[match.home_id], rows[match.away_id]
        a["pj"] += 1; b["pj"] += 1
        a["gf"] += match.home_score; a["gc"] += match.away_score
        b["gf"] += match.away_score; b["gc"] += match.home_score
        if match.home_score > match.away_score:
            a["g"] += 1; b["p"] += 1; a["pts"] += win_points
        elif match.home_score < match.away_score:
            b["g"] += 1; a["p"] += 1; b["pts"] += win_points
        else:
            a["e"] += 1; b["e"] += 1
            a["pts"] += draw_points; b["pts"] += draw_points
    for row in rows.values():
        row["dg"] = row["gf"] - row["gc"]
    # Equal rows remain a provisional order until the organizer defines a tie rule.
    return sorted(rows.values(), key=lambda x: (-x["pts"], -x["dg"], -x["gf"], x["name"]))


def live_points(match, win_points=3, draw_points=1):
    if match.home_score is None or match.away_score is None:
        return {"home": 0, "away": 0}
    if match.home_score > match.away_score:
        return {"home": win_points, "away": 0}
    if match.home_score < match.away_score:
        return {"home": 0, "away": win_points}
    return {"home": draw_points, "away": draw_points}
