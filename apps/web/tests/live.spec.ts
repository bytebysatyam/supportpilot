import {
  test,
  expect as baseExpect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";
import type {
  Session,
  TicketDetail,
  TicketList,
  TicketMessage,
  Assignment,
  StaffMember,
  DashboardSummary,
  SlaSnapshot,
} from "@supportpilot/types";

// Explicit opt-in: this suite creates synthetic records in the configured development API.
test.skip(
  process.env.SUPPORTPILOT_LIVE_E2E !== "1",
  "Requires an explicitly configured development API and seeded demo accounts.",
);
test.use({ trace: "off", video: "off" });
test.setTimeout(480_000);
const api = "http://localhost:4000/api/v1";
const password = "SupportPilot123!";
const expect = baseExpect.configure({ timeout: 30_000 });

async function call<T>(
  request: APIRequestContext,
  path: string,
  status: number,
  session?: Session,
  method = "GET",
  data?: object,
): Promise<T> {
  let response: APIResponse;
  try {
    response = await request.fetch(api + path, {
      method,
      data,
      timeout: path === "/sla/refresh-breaches" ? 120_000 : 30_000,
      headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
    });
  } catch {
    // Network errors may include request headers; keep bearer tokens private.
    throw new Error(`${method} ${path}: network unavailable or request timed out`);
  }
  // Do not include response bodies in failures: auth responses contain credentials.
  expect(response.status(), `${method} ${path}`).toBe(status);
  return status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
async function signIn(page: Page, email: string, destination: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(destination, { timeout: 30_000 });
}

test("live: real registration, customer request, staff handling and admin access", async ({
  page,
  browser,
  request,
}) => {
  const email = `qa-${Date.now()}@example.test`;
  const subject = `Live QA request ${Date.now()}`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Casey Live QA");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create customer account" }).click();
  await expect(page).toHaveURL(/\/customer\/tickets$/, { timeout: 30_000 });
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  await signIn(page, email, /\/customer\/tickets$/);
  await page.goto("/customer/tickets/new");
  await page.getByLabel("Subject", { exact: true }).fill(subject);
  await page
    .getByLabel("What happened?")
    .fill(
      "Synthetic end-to-end request: please verify my demo invoice export.",
    );
  await page.getByRole("button", { name: "Create request" }).click();
  await expect(page).toHaveURL(/\/customer\/tickets\/c\w+$/, {
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();
  const id = page.url().split("/").at(-1)!;
  await page
    .getByLabel("Reply", { exact: true })
    .fill("Customer follow-up from the real browser.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(
    page.getByText("Customer follow-up from the real browser.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30_000 });

  const login = (email: string) =>
    call<Session>(request, "/auth/login", 200, undefined, "POST", {
      email,
      password,
    });
  const customer = await login(email);
  expect(customer.user.role).toBe("CUSTOMER");
  const other = await login("customer2@supportpilot.local");
  const agent = await login("agent1@supportpilot.local");
  const agent2 = await login("agent2@supportpilot.local");
  const admin = await login("admin@supportpilot.local");
  await call(request, "/tickets", 401);
  await call(request, "/auth/login", 401, undefined, "POST", {
    email,
    password: "WrongPassword123!",
  });
  await call(request, "/auth/register", 409, undefined, "POST", {
    name: "Duplicate QA",
    email,
    password,
  });
  for (const suffix of ["", "/messages"])
    await call(request, `/tickets/${id}${suffix}`, 404, other);
  await call(request, `/sla/tickets/${id}`, 404, other);
  await call(request, `/tickets/${id}`, 403, customer, "PATCH", {
    priority: "URGENT",
  });
  await call(request, `/tickets/${id}/messages`, 403, customer, "POST", {
    body: "Forbidden internal note",
    isInternal: true,
  });
  await call(request, `/tickets/${id}/timeline`, 403, customer);
  await call(request, `/tickets/${id}/assignments`, 403, customer);
  await call(request, "/dashboard/summary", 403, customer);
  await call(request, "/dashboard/staff", 403, agent);
  const queue = await call<TicketList>(
    request,
    `/tickets?search=${encodeURIComponent(subject)}`,
    200,
    agent,
  );
  expect(queue.items.some((ticket) => ticket.id === id)).toBe(true);
  const before = await call<TicketDetail>(
    request,
    `/tickets/${id}`,
    200,
    agent,
  );
  await call(request, `/tickets/${id}`, 409, agent, "PATCH", {
    status: "RESOLVED",
  });
  await call(request, `/tickets/${id}/assignment`, 400, agent, "PUT", {
    agentId: customer.user.id,
  });
  for (const agentId of [agent.user.id, agent2.user.id, agent2.user.id])
    await call(request, `/tickets/${id}/assignment`, 200, agent, "PUT", {
      agentId,
    });
  const assignments = await call<Assignment[]>(
    request,
    `/tickets/${id}/assignments`,
    200,
    agent,
  );
  expect(assignments).toHaveLength(2);
  expect(assignments.filter((item) => item.unassignedAt === null)).toHaveLength(
    1,
  );
  const updated = await call<TicketDetail>(
    request,
    `/tickets/${id}`,
    200,
    agent,
    "PATCH",
    { status: "IN_PROGRESS", priority: "HIGH", category: "BILLING" },
  );
  expect(updated.firstResponseDueAt).toBe(before.firstResponseDueAt);
  expect(updated.resolutionDueAt).toBe(before.resolutionDueAt);
  const note = "Private QA note: synthetic billing triage only.";
  await call(request, `/tickets/${id}/messages`, 201, agent, "POST", {
    body: note,
    isInternal: true,
  });
  expect(
    (await call<TicketDetail>(request, `/tickets/${id}`, 200, agent))
      .firstRespondedAt,
  ).toBeNull();
  await call(request, `/tickets/${id}/messages`, 201, agent, "POST", {
    body: "Public QA reply: your demo invoice export is ready.",
    isInternal: false,
  });
  const messages = await call<TicketMessage[]>(
    request,
    `/tickets/${id}/messages`,
    200,
    customer,
  );
  expect(messages.every((message) => !message.isInternal)).toBe(true);
  expect(
    messages.some((message) => message.body.includes("Public QA reply")),
  ).toBe(true);
  expect(
    (
      await call<TicketMessage[]>(
        request,
        `/tickets/${id}/messages`,
        200,
        agent,
      )
    ).some((message) => message.body === note),
  ).toBe(true);
  const sla = await call<SlaSnapshot>(
    request,
    `/sla/tickets/${id}`,
    200,
    agent,
  );
  expect(sla.firstResponse.met).toBe(true);
  await page.reload();
  await expect(
    page.getByText("Public QA reply: your demo invoice export is ready.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(note, { exact: true })).toHaveCount(0);
  for (const status of [
    "WAITING_ON_CUSTOMER",
    "RESOLVED",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
  ])
    await call(request, `/tickets/${id}`, 200, agent, "PATCH", { status });
  await call(request, `/tickets/${id}`, 409, agent, "PATCH", {
    status: "IN_PROGRESS",
  });
  const capabilities = await call<{ enabled: boolean }>(
    request,
    "/ai/capabilities",
    200,
    agent,
  );
  expect(capabilities.enabled).toBe(false);
  await call(request, `/ai/tickets/${id}/analyze`, 503, agent, "POST", {
    type: "SUMMARY",
  });
  expect(await call(request, `/ai/tickets/${id}/analyses`, 200, agent)).toEqual(
    [],
  );
  await call(request, "/dashboard/summary", 200, agent);
  const staff = await call<StaffMember[]>(
    request,
    "/dashboard/staff",
    200,
    admin,
  );
  expect(staff.some((person) => person.id === agent.user.id)).toBe(true);
  const all = await call<TicketList>(request, "/tickets?limit=100", 200, agent);
  if (all.pagination.totalPages <= 1) {
    const summary = await call<DashboardSummary>(request, "/dashboard/summary", 200, agent);
    const active = all.items.filter(ticket => !["RESOLVED", "CLOSED"].includes(ticket.status));
    expect(summary.open).toBe(active.length);
    expect(summary.unassigned).toBe(active.filter(ticket => !ticket.assignedAgent).length);
    expect(summary.assignedToMe).toBe(active.filter(ticket => ticket.assignedAgent?.id === agent.user.id).length);
  }
  const rotated = await call<Session>(
    request,
    "/auth/refresh",
    200,
    undefined,
    "POST",
    { refreshToken: customer.refreshToken },
  );
  await call(request, "/auth/refresh", 401, undefined, "POST", {
    refreshToken: customer.refreshToken,
  });
  await call(request, "/auth/logout", 204, undefined, "POST", {
    refreshToken: rotated.refreshToken,
  });
  await call(request, "/auth/refresh", 401, undefined, "POST", {
    refreshToken: rotated.refreshToken,
  });

  const staffContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const staffPage = await staffContext.newPage();
  try {
    await signIn(staffPage, "agent1@supportpilot.local", /\/dashboard$/);
    await staffPage.goto(`/dashboard/tickets/${id}`);
    await expect(staffPage.getByRole("heading", { name: subject })).toBeVisible(
      { timeout: 30_000 },
    );
    await expect(staffPage.getByText(note, { exact: true })).toBeVisible();
    await staffPage.getByRole("button", { name: /sign out/i }).click();
    await expect(staffPage).toHaveURL(/\/login/, { timeout: 30_000 });
    await signIn(staffPage, "admin@supportpilot.local", /\/dashboard$/);
    await staffPage.goto("/dashboard/team");
    await expect(
      staffPage.getByText("Alex Rivera", { exact: true }),
    ).toBeVisible({ timeout: 30_000 });
  } finally {
    await staffContext.close();
  }
});

test("live: SLA breach scans are repeatable without Redis", async ({ request }) => {
  const agent = await call<Session>(request, "/auth/login", 200, undefined, "POST", {
    email: "agent1@supportpilot.local", password,
  });
  type Scan = { ticketsChecked: number; eventsCreated: number };
  const first = await call<Scan>(request, "/sla/refresh-breaches", 200, agent, "POST");
  expect(first.ticketsChecked).toBeGreaterThan(0);
  const repeated = await call<Scan>(request, "/sla/refresh-breaches", 200, agent, "POST");
  expect(repeated.eventsCreated).toBe(0);
});
