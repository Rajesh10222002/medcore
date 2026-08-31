# MedCore AI — Locust load test (KB Section 17)

Target from the proposal: 50 virtual users, <2s response time.

## Run

```
cd loadtest
python -m venv .venv                       # isolated on purpose — see note below
./.venv/Scripts/python.exe -m pip install -r requirements.txt
```

Start the backend separately (`cd backend && py app.py`), then:

```
./.venv/Scripts/python.exe -m locust -f locustfile.py --host http://localhost:5000 \
    --users 50 --spawn-rate 5 --run-time 2m --headless --html report.html --csv results
```

Or run interactively (web UI at http://localhost:8089) by omitting `--headless`.

**Why an isolated venv, not the global/project Python**: installing
`locust` globally the first time silently upgraded the system's `pytest`
from the project's pinned `8.1.1` to `9.1.1` (a transitive dependency
bump), which could have broken `backend/tests/`. Reverted and moved
Locust into `loadtest/.venv` instead — never install load-test tooling
into the same interpreter the pytest suite runs from.

## Scope — read-only, non-AI endpoints only

Deliberately excludes:
1. **AI routes** (`/ai/*`, NL query) — `ai_client.py` documents Ollama/
   Gemini calls taking 10-45s+; mixing those into a 2s SLA would either
   misrepresent the rest of the app or need a separate, much larger
   target. Not measured here.
2. **Write endpoints** (booking, notes, vitals) — would exhaust
   appointment slots and clutter the demo accounts under 50 concurrent
   users, and "ran out of slots" isn't a performance failure.

Covered: login, and the core read paths across all 3 portals (patient
profile/appointments/FHIR history, doctor patient list/detail/analytics/
schedule, admin KPIs/patients/doctors/appointments).

## Result (run 2026-08-17, 50 users, spawn rate 5, 2 minutes, localhost)

**0 failures across 452 requests** — but the <2s target was missed by
every single endpoint, including the cheapest ones:

| Endpoint | Median | 95th %ile | Max |
|---|---|---|---|
| `/doctors` (lightest — static list) | 2.4s | 2.5s | 2.5s |
| `/patients/me` | 2.4s | 2.6s | 2.9s |
| `POST /auth/login` | 2.7s | 2.9s | 3.0s |
| `/admin/kpis` (heaviest — aggregation query) | 2.9s | 3.3s | 3.4s |
| **Aggregated, all endpoints** | **2.6s** | **3.1s** | **3.4s** |

Full breakdown in `results_stats.csv` / `report.html` (both gitignored —
regenerate by re-running).

### Why it's flat ~2.4-3.4s regardless of endpoint — this is the real finding

A genuinely overloaded server shows growing spread between cheap and
expensive endpoints as queueing bites. Here every endpoint — from a
static specialty list to `/admin/kpis`'s aggregation query — sits in
the *same* narrow 2.3-3.4s band, and even `POST /auth/login` (one
bcrypt check, one row lookup) is just as slow as the heaviest read.
That pattern points to a **fixed per-request tax, not query cost**:

`backend/db.py`'s `get_db()` opens a brand-new `psycopg2.connect()` —
a fresh TCP + TLS handshake to Neon's `ap-southeast-1` pooler over the
public internet — **on every single request**, with no connection
reuse or pooling at the application layer. That handshake cost is paid
once per request regardless of what the request actually does, which
is exactly the flat latency floor seen above. It's also why even the
6-user smoke test earlier in this session showed the same ~2.4s floor
before concurrency was even a factor.

Two other contributors, smaller than the connection tax but real:
- Flask's **development server** (`py app.py`), not the `gunicorn` that's
  already in `requirements.txt` for the Azure deployment path — the dev
  server is explicitly not meant for concurrent load (`threaded=True`
  helps avoid single-thread stalls but doesn't add pooling).
- `/patients/me/fhir` and `/doctor/patients/:id` also call the public
  HAPI FHIR server per request (already a documented risk in the KB) —
  visible in the earlier 6-user smoke run at 8-9.5s, though they didn't
  get exercised in this particular 50-user run's task mix (see below).

### Known gap in this run

`/doctor/patients/:id` (detail view) logged **zero** requests in the
50-user run despite a nonzero task weight — it *did* fire successfully
in the 6-user smoke test (8.2s) and is covered separately by
`e2e/tests/doctor-notes.spec.js`'s live navigation, so the endpoint
itself isn't broken; the weighted random scheduler just didn't happen
to hit it enough times in this particular 2-minute window with only
~15 doctor-weighted VUs out of 50. Re-run with `--run-time 5m` or a
higher `doctor` weight if you want to confirm its number specifically.

## Follow-up: the connection-pooling fix, and what it actually did (2026-08-17)

`backend/db.py` was changed to a `psycopg2.pool.ThreadedConnectionPool`
wired through `flask.g` + `teardown_appcontext`, and every route's manual
`conn.close()` was removed (audited across all 7 route files) so the
pool actually gets connections back. Verified with `pytest tests/` —
118/118 still pass, exercising both the pooled path (real requests) and
the unpooled fallback (`get_db()` called outside a request context, e.g.
`tests/conftest.py`'s `_delete_patient`). This part worked as intended
and is a real improvement: the per-request TCP+TLS handshake cost is
genuinely gone.

**But the first re-run (`maxconn=20`) was worse, not better** — 361 of
583 requests failed with `psycopg2.pool.PoolError: connection pool
exhausted`. Root cause: each request holds its connection for the full
request duration (~2-2.5s baseline), and 50 concurrent users generating
requests every 1-3s need meaningfully more than 20 simultaneously
checked-out connections at peak, especially during Locust's spawn
ramp-up burst. (A first attempt at this comparison was also confounded
by Flask's debug auto-reloader — `FLASK_DEBUG=true` — restarting mid-run
and resetting every open connection at once; re-ran with
`FLASK_DEBUG=false` for a clean, single-process measurement before
concluding anything.)

**Raised `maxconn` to 60 and added retry-with-backoff** on
`PoolError` (10 retries, 0.3s apart) so a burst degrades to slower
rather than outright failing. Re-ran the identical test:

| Run | Failures | Aggregate median | Aggregate 95th %ile | Worst endpoint |
|---|---|---|---|---|
| Before pooling | 0 / 452 | 2.6s | 3.1s | 3.4s max (flat across all endpoints) |
| Pooled, `maxconn=20` | 361 / 583 (62%) | 2.1s | 7.2s | `/patients/me/fhir` 100% failed |
| Pooled, `maxconn=60` + retry | 8 / 414 (1.9%) | **3.5s** | **13s** | `/doctor/patients/:id` 68-95s |

**The <2s target is still not met, and the tuned pool's aggregate
numbers are worse than the original unpooled baseline.** That's a real
result, not a measurement artifact — don't round this off to "fixed."

### Why: pooling turned a decoupled problem into a shared-resource one

The 8 remaining failures are on `/patients/me/fhir` only, and the Flask
log shows no `PoolError` for them — these look like the already-documented
public HAPI FHIR server being slow/rejecting a burst of concurrent
identical requests (Section 8/18 of the KB already flags this as a known
risk), not a pooling regression.

The latency *increase*, though, is a pooling side-effect, and it's
structural, not a tuning miss: `patients.py::get_my_fhir` checks out a
pooled connection at the top of the function, then makes **4-6
sequential outbound HTTP calls to the public HAPI FHIR server** (each
with an 8-10s timeout) before that connection is ever returned to the
pool — the DB connection sits idle for the entire duration of those
external calls. `doctors.py::get_patient_detail`, `ai.py::copilot`, and
`ai.py::parse_note` do the same thing (confirmed by reading each — grep
`http_req\.(get|post)` in those files against where `get_db()` is
called). Before pooling, this was wasteful but harmless — each request
had its own throwaway connection, so one slow FHIR call never blocked
another request's ability to get a connection at all. Under a *shared,
capped* pool, those same slow calls now hold a scarce resource everyone
else needs, so a handful of FHIR-heavy requests can starve the whole
pool — which is exactly the shape of the regression above (one specific
endpoint timing out entirely, everything else measurably slower).

## Follow-up #2: fixed the 4 routes, re-measured — target still not met (2026-08-17)

Added `release_db()` to `db.py` (pops the connection off `flask.g` and
returns it to the pool immediately, distinct from `close_db()`'s
teardown-time return) and called it in all 4 identified routes right
after their DB work finishes and before their external HTTP calls:
`patients.py::get_my_fhir`, `doctors.py::get_patient_detail`,
`ai.py::copilot`, `ai.py::parse_note`. (`ai.py::get_patient_context` —
a separate shared helper used by `chat`/`health_summary`/
`patient_summary` — has the same shape but was out of scope for this
pass; noting it here rather than silently expanding scope.) Verified
with `pytest tests/` again — 118/118 pass. Restarted Flask
(`FLASK_DEBUG=false`, same clean conditions as the prior measurement)
and re-ran the identical 50-user, 2-minute test:

| Run | Failures | Aggregate median | Aggregate 95th %ile | Worst endpoint |
|---|---|---|---|---|
| Before pooling | 0 / 452 | 2.6s | 3.1s | 3.4s max (flat across all endpoints) |
| Pooled, `maxconn=20` | 361 / 583 (62%) | 2.1s | 7.2s | `/patients/me/fhir` 100% failed |
| Pooled, `maxconn=60` + retry | 8 / 414 (1.9%) | 3.5s | 13s | `/doctor/patients/:id` 68-95s |
| **+ release_db() in the 4 routes** | **4 / 366 (1.1%)** | **3.1s** | **11s** | `/doctor/patients/:id` 91-95s |

**Result: modest improvement, target still missed, and still worse in
aggregate than the original unpooled baseline.** Failures dropped
(8→4, all still on `/patients/me/fhir` — see below, not a pooling
issue), and median improved slightly (3.5s→3.1s), but 95th percentile
and worst-case tail are barely changed, and even `/doctors` — a plain
join with zero external calls — now shows a 9.8s max, something it
never did in the original unpooled run. Releasing connections earlier
helped other requests acquire one faster, but it doesn't make Neon
queries or HAPI FHIR calls themselves any faster, and it doesn't change
that this is still Flask's single-process development server, not
`gunicorn`. **Do not report this as fixed.**

The remaining 4 failures are still all on `/patients/me/fhir`, still
with no `PoolError` in the Flask log — consistent with the
already-documented public HAPI FHIR server rejecting/timing out under
a concurrent burst from the same client, not a pooling regression.

### Where this leaves it

Three real, separate things were found and are now documented, not just
one:
1. **Fixed**: the original per-request connection-establishment tax
   (pooling was the correct, sufficient fix for this specific symptom).
2. **Fixed**: routes holding a pooled connection idle across slow
   external HTTP calls (release_db() in the 4 routes; `get_patient_context`
   still has this shape and is a known, deliberately out-of-scope gap).
3. **Not fixed, and out of scope for a `db.py` change**: this app's
   baseline per-query latency to a remote Neon region (~2-2.5s even for
   a single request, per the very first 6-user smoke test) combined
   with the Flask development server's single-process concurrency model
   is the actual ceiling on the <2s target at 50 VUs. Closing that gap
   needs `gunicorn` (already in `requirements.txt` for Azure) with
   multiple workers, and/or a Neon region closer to wherever this
   deploys, and/or reducing the number of sequential external FHIR
   calls per request — none of which is "add a connection pool."

Stopping here as scoped. This is the honest state to carry into the
final QA report: two real bugs found and fixed with before/after
evidence, one real bottleneck identified and correctly ruled *out* of
this fix's scope rather than left unexplained.
