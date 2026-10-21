import { test, expect, type Page } from "@playwright/test";

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("sign-in and registration are readable and accessible across viewport sizes", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Sign in to your workspace" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(
    page.getByRole("heading", { name: "Get the support you need" }),
  ).toBeVisible();
  await page.getByLabel("Full name").focus();
  await expect(page.getByLabel("Full name")).toBeFocused();
  await expectNoOverflow(page);
});

test("protected workspaces redirect visitors to sign-in", async ({ page }) => {
  for (const route of [
    "/dashboard",
    "/customer/tickets",
    "/customer/tickets/new",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  }
});

test("sign-in renders service errors and lets the user retry", async ({
  page,
}) => {
  // This checks the UI error contract, not database-backed authentication.
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        },
      }),
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill("customer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("IncorrectPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Email or password is incorrect.",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expectNoOverflow(page);
});
