# MedCore AI — Playwright E2E

3 flow scenarios (Section 17 of the KB): patient booking, doctor notes, admin analytics.

## Run

```
cd e2e
npm install
npx playwright install chromium   # first time only
npx playwright test
```

`playwright.config.js` auto-starts both the Flask backend (`py app.py`) and
the Vite dev server (`npm run dev`) via `webServer` — no need to start them
yourself first, though it'll reuse them if already running.

## What each test does

- **patient-booking.spec.js** — logs in as `patient@medcore.ai`, runs the
  full 4-step booking modal (doctor → date → time → confirm), asserts the
  success toast and confirmation screen.
- **doctor-notes.spec.js** — logs in as `doctor@medcore.ai`, picks a
  patient, fills a note via a quick template, saves it, asserts the
  success toast. Does **not** exercise Smart Extract's AI call (Ollama/
  Gemini) — that's covered by `backend/tests/test_ai_guard.py` instead,
  so this suite stays deterministic without a live AI provider.
- **admin-analytics.spec.js** — logs in as `admin@medcore.ai`, asserts the
  KPI cards render live numbers and both charts (bar + pie) render as SVG.
  Doesn't submit an NL query for the same AI-dependency reason above.

## Known tradeoff: these write real rows to the demo accounts

Unlike `backend/tests/conftest.py`'s pytest suite (which signs up a
throwaway patient per run), these tests log in as the actual demo
accounts (`patient@medcore.ai`, `doctor@medcore.ai`) shown during
reviews — a real booking modal and a real note-save only make sense
against a real, populated account with existing doctors/appointments/
patients to choose from.

Consequence: every run adds one appointment ("Playwright E2E test
booking...") and one clinical note to the demo accounts. This is
harmless functionally, but running the suite repeatedly before a live
review will visibly clutter the demo patient's appointment list. Re-run
`backend/Seed_data.py` beforehand if you want a clean demo state — it
wipes and re-seeds everything, including whatever this suite added.
