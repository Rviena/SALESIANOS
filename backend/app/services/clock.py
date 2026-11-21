"""The server stores elapsed time, so closing a browser never resets a game."""
from datetime import datetime, timezone


def now():
    return datetime.now(timezone.utc)


def elapsed(match, at=None):
    total = match.elapsed_seconds or 0
    if match.running_since:
        started = match.running_since
        if started.tzinfo is None:  # SQLite drops timezone metadata.
            started = started.replace(tzinfo=timezone.utc)
        total += max(0, int(((at or now()) - started).total_seconds()))
    return total


def pause(match):
    match.elapsed_seconds = elapsed(match)
    match.running_since = None


def run(match):
    if match.running_since is None:
        match.running_since = now()
