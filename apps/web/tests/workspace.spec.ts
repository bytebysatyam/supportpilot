import { test, expect, type Page } from "@playwright/test";

// Rendering contracts use synthetic fixtures. Real authorization and persistence
// are covered by the separate PostgreSQL integration suite.
const customer = {
  id: "ccustomer00000000000000001",
  name: "Jamie Brooks",
  email: "customer@example.test",
  role: "CUSTOMER",
};
const agent = {
  id: "cagent00000000000000000001",
  name: "Alex Rivera",
  email: "agent@example.test",
  role: "SUPPORT_AGENT",
};
const ticket = {
  id: "cticket0000000000000000001",
  ticketNumber: 1042,
  subject: "CSV export returns 500",
  description:
    "A thirty-day activity export fails while a one-day export succeeds.",
  status: "IN_PROGRESS",
  priority: "HIGH",
  category: "TECHNICAL",
  createdAt: "2026-01-01T10:00:00Z",
  updatedAt: "2026-01-01T10:30:00Z",
  customer,
  assignedAgent: agent,
  firstResponseDueAt: "2026-01-01T11:00:00Z",
  firstRespondedAt: "2026-01-01T10:20:00Z",
  resolutionDueAt: "2026-01-02T10:00:00Z",
  resolvedAt: null,
  closedAt: null,
  team: { id: "team-1", name: "Customer Operations" },
};
const messages = [
  {
    id: "message-1",
    body: "Thanks for the details. We are investigating the date-range limit.",
    isInternal: false,
    authorType: "AGENT",
    author: agent,
    createdAt: "2026-01-01T10:20:00Z",
  },
  {
    id: "message-2",
    body: "Check the staging query plan before replying.",
    isInternal: true,
    authorType: "AGENT",
    author: agent,
    createdAt: "2026-01-01T10:30:00Z",
  },
];

async function workspace(page: Page, staff: boolean) {
  const user = staff ? agent : customer;
  await page.addInitScript(
    (value) =>
      sessionStorage.setItem(
        "supportpilot.session",
        JSON.stringify({
          user: value,
          accessToken: "synthetic-ui-test-token",
          refreshToken: "synthetic-ui-test-refresh-token",
        }),
      ),
    user,
  );
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    let body: unknown;
    if (path === "/auth/me") body = user;
    else if (path === "/dashboard/summary")
      body = {
        open: 21,
        unassigned: 4,
        urgent: 2,
        breached: 1,
        atRisk: 3,
        assignedToMe: 7,
      };
    else if (path === "/tickets")
      body = {
        items: [ticket],
        pagination: { page: 1, totalPages: 1, total: 1, limit: 12 },
      };
    else if (path === `/tickets/${ticket.id}`) body = ticket;
    else if (path.endsWith("/messages"))
      body = staff
        ? messages
        : messages.filter((message) => !message.isInternal);
    else if (path === "/users/support-agents") body = [agent];
    else if (
      path.endsWith("/timeline") ||
      path.endsWith("/assignments") ||
      path.endsWith("/analyses")
    )
      body = [];
    else if (path === "/ai/capabilities") body = { enabled: false };
    else if (path.startsWith("/sla/tickets/"))
      body = {
        firstResponse: {
          dueAt: ticket.firstResponseDueAt,
          respondedAt: ticket.firstRespondedAt,
          closedWithoutReply: false,
          met: true,
          breached: false,
          atRisk: false,
        },
        resolution: {
          dueAt: ticket.resolutionDueAt,
          resolvedAt: null,
          met: false,
          breached: false,
          atRisk: false,
        },
      };
    else throw new Error(`Unexpected fixture request: ${path}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("staff queue renders aggregate metrics and ticket links without overflow", async ({
  page,
}, info) => {
  await workspace(page, true);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Support queue", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /CSV export returns 500/ }),
  ).toBeVisible();
  await expect(page.getByText("21", { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath("queue.png"), fullPage: true });
});

test("staff ticket exposes notes and properties while disabled AI has an explicit state", async ({
  page,
}) => {
  await workspace(page, true);
  await page.goto(`/dashboard/tickets/${ticket.id}`);
  await expect(
    page.getByRole("heading", { name: "Ticket properties" }),
  ).toBeVisible();
  await expect(
    page.getByText("Check the staging query plan before replying."),
  ).toBeVisible();
  await expect(
    page.getByText("AI not configured", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});

test("AI results remain structured, failures are readable, and drafts need human review", async ({
  page,
}) => {
  await workspace(page, true);
  const analyses = [
    {
      id: "ai-1",
      type: "CLASSIFICATION",
      status: "COMPLETED",
      result: {
        category: "TECHNICAL",
        confidence: 0.9,
        rationale: "Export error reported.",
      },
    },
    {
      id: "ai-2",
      type: "SUMMARY",
      status: "COMPLETED",
      result: {
        summary: "A large export fails.",
        keyPoints: ["Small exports work."],
      },
    },
    {
      id: "ai-3",
      type: "PRIORITY_SUGGESTION",
      status: "COMPLETED",
      result: {
        priority: "HIGH",
        confidence: 0.8,
        rationale: "Export workflow blocked.",
      },
    },
    {
      id: "ai-4",
      type: "DRAFT_RESPONSE",
      status: "COMPLETED",
      result: {
        response: "Could you share the export date range?",
        tone: "professional",
      },
    },
    {
      id: "ai-5",
      type: "SUMMARY",
      status: "FAILED",
      result: null,
      errorMessage: "AI_PROVIDER_RATE_LIMITED",
    },
    {
      id: "ai-6",
      type: "SUMMARY",
      status: "PENDING",
      result: null,
      errorMessage: "AI_PROVIDER_UNAVAILABLE",
    },
  ].map((item) => ({
    ...item,
    provider: "gemini",
    model: "gemini-3.5-flash-lite",
    createdAt: ticket.createdAt,
  }));
  await page.route("**/api/v1/ai/capabilities", (route) =>
    route.fulfill({ json: { enabled: true, provider: "gemini" } }),
  );
  await page.route(`**/api/v1/ai/tickets/${ticket.id}/analyses`, (route) =>
    route.fulfill({ json: analyses }),
  );
  let messagePosts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/messages"))
      messagePosts++;
  });
  await page.goto(`/dashboard/tickets/${ticket.id}`);
  await expect(
    page.getByText("Export error reported.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A large export fails.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply category" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply priority" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The AI provider is rate-limited. Wait a little before trying again.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Retry pending\. The AI provider is temporarily unavailable/,
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use in reply editor" }).click();
  await expect(page.getByLabel("Reply", { exact: true })).toHaveValue(
    "Could you share the export date range?",
  );
  expect(messagePosts).toBe(0);
  await noOverflow(page);
});

test("customer ticket renders public conversation without staff controls", async ({
  page,
}) => {
  await workspace(page, false);
  await page.goto(`/customer/tickets/${ticket.id}`);
  await expect(
    page.getByRole("heading", { name: ticket.subject }),
  ).toBeVisible();
  await expect(page.getByText(messages[0]!.body)).toBeVisible();
  await expect(page.getByText(messages[1]!.body)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Activity & ownership" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Ticket properties" }),
  ).toHaveCount(0);
  await noOverflow(page);
});
