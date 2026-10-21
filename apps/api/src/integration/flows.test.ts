import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";

const testDatabase = process.env.SUPPORTPILOT_TEST_DATABASE_URL;

test(
  "PostgreSQL API flows: auth, ownership, lifecycle, SLA, AI persistence, metrics",
  {
    skip: testDatabase
      ? false
      : "Set SUPPORTPILOT_TEST_DATABASE_URL to a migrated local *_test database to run database integration tests.",
    timeout: 60000,
  },
  async (t) => {
    if (!testDatabase) return;
    const url = new URL(testDatabase);
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]", "postgres"].includes(url.hostname) &&
        url.pathname.endsWith("_test"),
      "Integration tests require a local database whose name ends in _test.",
    );
    process.env.DATABASE_URL = testDatabase;
    process.env.AI_PROVIDER = "disabled";
    const { app } = await import("../app.js");
    const { prisma } = await import("../lib/prisma.js");
    const { closeQueues } = await import("../jobs/queues.js");
    const { hashPassword } = await import("../auth/password.js");
    const { refreshOpenTicketBreaches } = await import("../sla/sla.service.js");
    const { processAiAnalysis } = await import("../ai/ai.worker.service.js");
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api/v1`;
    const prefix = `integration-${randomUUID()}`;
    const userIds: string[] = [];
    async function request(
      path: string,
      method = "GET",
      token?: string,
      body?: unknown,
    ) {
      return fetch(base + path, {
        method,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    }
    type Session = {
      accessToken: string;
      refreshToken: string;
      user: { id: string; role: string };
    };
    try {
      const customerEmail = `${prefix}-customer@example.test`;
      const registration = await request("/auth/register", "POST", undefined, {
        name: "Integration Customer",
        email: customerEmail,
        password: "IntegrationPass123!",
        role: "ADMIN",
      });
      assert.equal(registration.status, 201);
      const customer = (await registration.json()) as Session;
      userIds.push(customer.user.id);
      assert.equal(customer.user.role, "CUSTOMER");
      const otherResponse = await request("/auth/register", "POST", undefined, {
        name: "Other Customer",
        email: `${prefix}-other@example.test`,
        password: "IntegrationPass123!",
      });
      const other = (await otherResponse.json()) as Session;
      userIds.push(other.user.id);
      const passwordHash = await hashPassword("IntegrationPass123!");
      const agent = await prisma.user.create({
        data: {
          name: "Integration Agent",
          email: `${prefix}-agent@example.test`,
          passwordHash,
          role: "SUPPORT_AGENT",
        },
      });
      userIds.push(agent.id);
      const admin = await prisma.user.create({
        data: {
          name: "Integration Admin",
          email: `${prefix}-admin@example.test`,
          passwordHash,
          role: "ADMIN",
        },
      });
      userIds.push(admin.id);
      async function login(email: string) {
        const response = await request("/auth/login", "POST", undefined, {
          email,
          password: "IntegrationPass123!",
        });
        assert.equal(response.status, 200);
        return (await response.json()) as Session;
      }
      const staff = await login(agent.email);
      const administrator = await login(admin.email);
      const created = await request("/tickets", "POST", customer.accessToken, {
        subject: "CSV export returns 500",
        description:
          "A thirty-day activity export fails while a one-day export succeeds.",
      });
      assert.equal(created.status, 201);
      const ticket = (await created.json()) as {
        id: string;
        firstResponseDueAt: string;
        resolutionDueAt: string;
      };
      assert.equal(
        (await request(`/tickets/${ticket.id}`, "GET", other.accessToken))
          .status,
        404,
      );
      assert.equal(
        (
          await request(
            `/tickets/${ticket.id}/timeline`,
            "GET",
            customer.accessToken,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/tickets/${ticket.id}`,
            "PATCH",
            customer.accessToken,
            { priority: "URGENT" },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/tickets/${ticket.id}/messages`,
            "POST",
            customer.accessToken,
            { body: "An internal note", isInternal: true },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/tickets/${ticket.id}/messages`,
            "POST",
            staff.accessToken,
            { body: "Investigating export query limits.", isInternal: true },
          )
        ).status,
        201,
      );
      assert.equal(
        (await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }))
          .firstRespondedAt,
        null,
      );
      const visible = (await (
        await request(
          `/tickets/${ticket.id}/messages`,
          "GET",
          customer.accessToken,
        )
      ).json()) as { isInternal: boolean }[];
      assert.equal(visible.length, 0);
      await request(
        `/tickets/${ticket.id}/messages`,
        "POST",
        customer.accessToken,
        { body: "The report covers the last thirty days." },
      );
      await Promise.all(
        [1, 2].map(() =>
          request(`/tickets/${ticket.id}/messages`, "POST", staff.accessToken, {
            body: "Thanks, we are checking the affected date range.",
          }),
        ),
      );
      assert.ok(
        (await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }))
          .firstRespondedAt,
      );
      assert.equal(
        await prisma.sLAEvent.count({
          where: { ticketId: ticket.id, type: "FIRST_RESPONSE_MET" },
        }),
        1,
      );
      await Promise.all(
        [1, 2].map(() =>
          request(
            `/tickets/${ticket.id}/assignment`,
            "PUT",
            staff.accessToken,
            { agentId: agent.id },
          ),
        ),
      );
      assert.equal(
        await prisma.ticketAssignment.count({
          where: { ticketId: ticket.id, unassignedAt: null },
        }),
        1,
      );
      await request(
        `/tickets/${ticket.id}/assignment`,
        "PUT",
        staff.accessToken,
        { agentId: null },
      );
      assert.equal(
        await prisma.ticketAssignment.count({
          where: { ticketId: ticket.id, unassignedAt: null },
        }),
        0,
      );
      const updatedResponse = await request(
        `/tickets/${ticket.id}`,
        "PATCH",
        staff.accessToken,
        { priority: "URGENT", status: "IN_PROGRESS" },
      );
      assert.equal(updatedResponse.status, 200);
      const updated = (await updatedResponse.json()) as typeof ticket;
      assert.equal(updated.firstResponseDueAt, ticket.firstResponseDueAt);
      assert.equal(updated.resolutionDueAt, ticket.resolutionDueAt);
      assert.equal(
        (
          await request(`/tickets/${ticket.id}`, "PATCH", staff.accessToken, {
            status: "RESOLVED",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request(`/tickets/${ticket.id}`, "PATCH", staff.accessToken, {
            status: "IN_PROGRESS",
          })
        ).status,
        200,
      );
      assert.equal(
        (await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }))
          .resolvedAt,
        null,
      );
      const dueAt = new Date(Date.now() - 60000);
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { resolutionDueAt: dueAt },
      });
      await Promise.all([
        refreshOpenTicketBreaches(),
        refreshOpenTicketBreaches(),
      ]);
      assert.equal(
        await prisma.sLAEvent.count({
          where: { ticketId: ticket.id, type: "RESOLUTION_BREACHED" },
        }),
        1,
      );
      assert.equal(
        (await request("/dashboard/summary", "GET", customer.accessToken))
          .status,
        403,
      );
      const metrics = (await (
        await request("/dashboard/summary", "GET", staff.accessToken)
      ).json()) as { breached: number };
      assert.ok(metrics.breached >= 1);
      assert.equal(
        (await request("/dashboard/staff", "GET", staff.accessToken)).status,
        403,
      );
      assert.equal(
        (await request("/dashboard/staff", "GET", administrator.accessToken))
          .status,
        200,
      );
      assert.equal(
        (
          await request(
            `/ai/tickets/${ticket.id}/analyze`,
            "POST",
            staff.accessToken,
            { type: "SUMMARY" },
          )
        ).status,
        503,
      );
      assert.equal(
        await prisma.aIAnalysis.count({ where: { ticketId: ticket.id } }),
        0,
      );
      const analysis = await prisma.aIAnalysis.create({
        data: { ticketId: ticket.id, type: "SUMMARY" },
      });
      await assert.rejects(
        () =>
          processAiAnalysis({
            analysisId: analysis.id,
            ticketId: ticket.id,
            actorId: agent.id,
            type: "SUMMARY",
          }),
        /AI_PROVIDER_DISABLED/,
      );
      assert.equal(
        (
          await prisma.aIAnalysis.findUniqueOrThrow({
            where: { id: analysis.id },
          })
        ).status,
        "FAILED",
      );
      // Real PostgreSQL persistence with external Gemini HTTP mocked, never a paid/live inference call.
      const { env } = await import("../config/env.js");
      const originalProvider = env.AI_PROVIDER;
      const originalKey = env.GEMINI_API_KEY;
      const originalModel = env.GEMINI_MODEL;
      const originalFetch = globalThis.fetch;
      let rateLimited = true;
      const providerHttp = t.mock.method(
        globalThis,
        "fetch",
        async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
          if (
            String(input).startsWith(
              "https://generativelanguage.googleapis.com/",
            )
          ) {
            if (rateLimited)
              return Response.json(
                { error: { message: "synthetic provider limit" } },
                { status: 429 },
              );
            return Response.json({
              candidates: [
                {
                  finishReason: "STOP",
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          summary: "Synthetic Gemini summary",
                          keyPoints: ["Customer needs help."],
                        }),
                      },
                    ],
                  },
                },
              ],
            });
          }
          return originalFetch(input, init);
        },
      );
      try {
        env.AI_PROVIDER = "gemini";
        env.GEMINI_API_KEY = "synthetic-integration-key";
        const geminiAnalysis = await prisma.aIAnalysis.create({
          data: {
            ticketId: ticket.id,
            type: "SUMMARY",
            provider: "gemini",
            model: env.GEMINI_MODEL,
          },
        });
        const job = {
          analysisId: geminiAnalysis.id,
          ticketId: ticket.id,
          actorId: agent.id,
          type: "SUMMARY" as const,
        };
        await assert.rejects(
          () => processAiAnalysis(job, { finalAttempt: false }),
          /AI_PROVIDER_RATE_LIMITED/,
        );
        const retrying = await prisma.aIAnalysis.findUniqueOrThrow({
          where: { id: geminiAnalysis.id },
        });
        assert.equal(retrying.status, "PENDING");
        assert.equal(retrying.errorMessage, "AI_PROVIDER_RATE_LIMITED");
        assert.equal(retrying.completedAt, null);
        rateLimited = false;
        await processAiAnalysis(job);
        const completed = await prisma.aIAnalysis.findUniqueOrThrow({
          where: { id: geminiAnalysis.id },
        });
        assert.equal(completed.status, "COMPLETED");
        assert.equal(completed.provider, "gemini");
        assert.equal(completed.errorMessage, null);
        assert.deepEqual(completed.result, {
          summary: "Synthetic Gemini summary",
          keyPoints: ["Customer needs help."],
        });
      } finally {
        providerHttp.mock.restore();
        env.AI_PROVIDER = originalProvider;
        env.GEMINI_API_KEY = originalKey;
        env.GEMINI_MODEL = originalModel;
      }
      const rotations = await Promise.all(
        [1, 2].map(() =>
          request("/auth/refresh", "POST", undefined, {
            refreshToken: customer.refreshToken,
          }),
        ),
      );
      assert.deepEqual(
        rotations.map((response) => response.status).sort(),
        [200, 401],
      );
      const rotated = (await rotations
        .find((response) => response.status === 200)!
        .json()) as { refreshToken: string };
      assert.equal(
        await prisma.refreshToken.count({
          where: { tokenHash: rotated.refreshToken },
        }),
        0,
      );
      await request("/auth/logout", "POST", undefined, {
        refreshToken: rotated.refreshToken,
      });
      assert.equal(
        (
          await request("/auth/refresh", "POST", undefined, {
            refreshToken: rotated.refreshToken,
          })
        ).status,
        401,
      );
      await prisma.user.update({
        where: { id: agent.id },
        data: { status: "SUSPENDED" },
      });
      assert.equal(
        (await request("/tickets", "GET", staff.accessToken)).status,
        403,
      );
      assert.equal(
        (
          await request("/auth/login", "POST", undefined, {
            email: agent.email,
            password: "IntegrationPass123!",
          })
        ).status,
        403,
      );
    } finally {
      server.close();
      await once(server, "close");
      await prisma.ticket.deleteMany({
        where: { customerId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds }, email: { startsWith: prefix } },
      });
      await closeQueues();
      await prisma.$disconnect();
    }
  },
);
