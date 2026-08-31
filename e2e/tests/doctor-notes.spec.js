import { test, expect } from "@playwright/test";
import { login, DEMO } from "./helpers.js";

test("doctor can write and save a clinical note", async ({ page }) => {
  await login(page, DEMO.doctor, "/doctor");

  await page.goto("/doctor/notes");

  // Select the first real patient in the dropdown (index 0 is the
  // "Choose a patient..." placeholder)
  const patientSelect = page.locator("select");
  await patientSelect.selectOption({ index: 1 });

  // Use a quick template instead of typing free text — deterministic,
  // and avoids depending on a fresh Ollama/Gemini round trip for this
  // assertion (Smart Extract is exercised separately by
  // backend/routes/ai.py's own test coverage, not re-tested here).
  await page.getByRole("button", { name: "Fever & Cough" }).click();
  await expect(page.locator("textarea")).not.toBeEmpty();

  await page.getByRole("button", { name: /save note/i }).click();

  await expect(page.getByText("Note saved to patient record.")).toBeVisible({ timeout: 10_000 });
});
