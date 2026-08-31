import os
import time
import psycopg2
from psycopg2 import pool as psycopg2_pool
from dotenv import load_dotenv
from flask import g, has_app_context

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# maxconn=20 was the first attempt and was too low: re-running the 50-VU
# Locust test against it produced real psycopg2.pool.PoolError: connection
# pool exhausted failures (not a fluke — reproduced with the Flask
# reloader disabled too, so it wasn't a false alarm from that). Each
# request holds its connection for the full ~2-2.5s baseline Neon
# round-trip observed even before pooling existed (pooling removes the
# per-request handshake, it doesn't make Neon itself faster to reach),
# so 50 concurrent users generating requests every 1-3s need meaningfully
# more than 20 concurrently-checked-out connections at peak/burst — see
# loadtest/README.md for the before/20/60 comparison.
_pool = psycopg2_pool.ThreadedConnectionPool(minconn=2, maxconn=60, dsn=DATABASE_URL)

# psycopg2's pool raises immediately on exhaustion rather than blocking,
# which turns a brief burst (e.g. Locust's spawn ramp-up) into hard
# failures instead of a short wait. Retry with backoff for a few seconds
# before giving up, so a transient spike degrades to slower rather than
# broken.
_GETCONN_RETRIES = 10
_GETCONN_BACKOFF_SECONDS = 0.3


def _get_pooled_conn():
    for attempt in range(_GETCONN_RETRIES):
        try:
            return _pool.getconn()
        except psycopg2_pool.PoolError:
            if attempt == _GETCONN_RETRIES - 1:
                raise
            time.sleep(_GETCONN_BACKOFF_SECONDS)


def get_db():
    """
    Returns a database connection.

    Inside a Flask request: one pooled connection per request, cached
    on `flask.g` so repeated get_db() calls within the same request
    (e.g. patients.py's get_my_fhir) reuse it instead of checking out a
    second one. Returned to the pool automatically by close_db() via
    teardown_appcontext — routes must NOT call conn.close() themselves,
    since that closes the real socket before teardown can hand it back,
    which starves the pool over time rather than reusing it.

    Outside a request context (pytest, Seed_data.py-style scripts):
    returns a plain unpooled connection, same as before this change —
    those callers already close it themselves, and pooling only needs
    to cover the request-handling path Locust actually measured.

    If a route needs to do slow, DB-unrelated work after it's done with
    the database — the public HAPI FHIR calls in get_my_fhir(),
    get_patient_detail(), copilot(), and parse_note() are the known
    cases — call release_db() as soon as the DB work is finished, before
    that slow work starts. Holding a pooled connection idle across a
    multi-second external HTTP call starves the shared pool for every
    other concurrent request; this was measured directly (see
    loadtest/README.md's maxconn=60 run) rather than assumed. Calling
    get_db() again afterward, if more DB access is needed, transparently
    checks out a fresh connection from the pool.
    """
    if has_app_context():
        if "db_conn" not in g:
            g.db_conn = _get_pooled_conn()
        return g.db_conn
    return psycopg2.connect(DATABASE_URL)


def _return_conn_to_pool():
    conn = g.pop("db_conn", None)
    if conn is not None:
        _pool.putconn(conn)


def release_db():
    """Return the current request's pooled connection early — see get_db()'s
    docstring. Outside a request context this is a no-op (nothing cached
    on g to release; unpooled callers manage their own connection)."""
    if has_app_context():
        _return_conn_to_pool()


def close_db(exception=None):
    _return_conn_to_pool()


def init_app(app):
    app.teardown_appcontext(close_db)
