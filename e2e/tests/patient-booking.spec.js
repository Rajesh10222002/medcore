import { test, expect } from "@playwright/test";
import { login, DEMO } from "./helpers.js";

test("patient can book an appointment end-to-end", async ({ page }) => {
  await login(page, DEMO.patient, "/patient");

  await page.goto("/patient/appointments");
  await page.getByRole("button", { name: "Book Appointment" }).first().click();

  // Step 1: doctor — pick the first card in the list. Scoped to
  // ".cursor-pointer" (DoctorCard's own class) rather than just
  // "text=/Dr\. /", since an upcoming-appointment card elsewhere on
  // this same page can already show a booked doctor's name from an
  // earlier run and would otherwise be matched first in DOM order.
  const doctorCard = page.locator("div.cursor-pointer", { hasText: "Dr. " }).first();
  await expect(doctorCard).toBeVisible();
  await doctorCard.click();

  // Step 2: date — first non-disabled weekday button. The day-of-month
  // and month-abbreviation are separate <span>s inside the same button
  // with no whitespace between them (e.g. "17Aug"), so match on the
  // grid structure rather than the button's text content.
  await expect(page.getByText("Select a date")).toBeVisible();
  const dateGrid = page.locator("div.grid-cols-7").last();
  let dateButton = dateGrid.locator("button:not([disabled])").first();
  await dateButton.click();

  // Step 3: time — first available (non-disabled) slot
  await expect(page.getByText("Pick a time")).toBeVisible();
  // "Doctor is on leave" can appear for an unlucky date choice — back out
  // and retry the next date once rather than fail the whole flow on it.
  if (await page.getByText("Doctor is on leave").isVisible().catch(() => false)) {
    await page.getByText("Choose Another Date").click();
    dateButton = dateGrid.locator("button:not([disabled])").nth(1);
    await dateButton.click();
  }
  const slotButton = page.locator("div.grid-cols-4 button:not([disabled])").first();
  await expect(slotButton).toBeVisible({ timeout: 10_000 });
  await slotButton.click();

  // Step 4: confirm — fill reason, submit
  await expect(page.getByText("Appointment Summary")).toBeVisible();
  await page.getByPlaceholder("Briefly describe your symptoms or reason for the visit...").fill(
    "Playwright E2E test booking — routine checkup"
  );
  await page.getByRole("button", { name: /confirm appointment/i }).click();

  await expect(page.getByText("Appointment booked!")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Booked with Dr\./)).toBeVisible();
});
