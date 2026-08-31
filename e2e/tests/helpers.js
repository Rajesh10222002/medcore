// Demo accounts seeded by backend/Seed_data.py — see zlocal KB Section 5.
export const DEMO = {
  patient: { email: "patient@medcore.ai", password: "admin123" },
  doctor:  { email: "doctor@medcore.ai",  password: "admin123" },
  admin:   { email: "admin@medcore.ai",   password: "admin123" },
};

export async function login(page, { email, password }, expectedPath) {
  await page.goto("/");
  await page.getByPlaceholder("your@email.com").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(`**${expectedPath}`);
}
