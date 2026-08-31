import { test, expect } from "@playwright/test";
import { login, DEMO } from "./helpers.js";

test("admin analytics dashboard loads KPIs and charts from live data", async ({ page }) => {
  await login(page, DEMO.admin, "/admin");

  await expect(page.getByText("Total Patients")).toBeVisible();
  await expect(page.getByText("Total Doctors")).toBeVisible();
  await expect(page.getByText("Total Appointments")).toBeVisible();

  // AnimatedNumber counts up from 0 — wait for it to settle above 0
  // rather than asserting on GET /admin/kpis directly, so this also
  // catches a rendering regression, not just an API regression.
  // ".stat-gradient-card" is the KpiCard wrapper — the label (span) and
  // the animated value (sibling <p>) live under it, not under a
  // shared immediate parent, so `.locator("..")` from the label is
  // one level too shallow.
  const patientsCard = page.locator(".stat-gradient-card", { hasText: "Total Patients" });
  await expect(patientsCard.getByText(/^[1-9]\d*$/)).toBeVisible({ timeout: 10_000 });

  // Recharts renders an <svg class="recharts-surface"> per chart —
  // daily trend bar chart + status pie chart = at least 2
  await expect(page.locator("svg.recharts-surface")).toHaveCount(2, { timeout: 10_000 });

  // NL Analytics input is present (not exercised here — depends on
  // Ollama/Gemini being reachable, covered by backend/tests/test_admin.py instead)
  await expect(page.getByPlaceholder("Ask about patients, appointments, doctors...")).toBeVisible();
});
