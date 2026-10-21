import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { hashPassword } from "./auth/password.js";
import { getSlaDeadlines } from "./sla/sla.policy.js";
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserRole,
} from "@prisma/client";

const accounts: { email: string; name: string; role: UserRole }[] = [
  { email: "admin@supportpilot.local", name: "Morgan Ellis", role: "ADMIN" },
  {
    email: "agent1@supportpilot.local",
    name: "Alex Rivera",
    role: "SUPPORT_AGENT",
  },
  {
    email: "agent2@supportpilot.local",
    name: "Samira Chen",
    role: "SUPPORT_AGENT",
  },
  {
    email: "customer1@supportpilot.local",
    name: "Jamie Brooks",
    role: "CUSTOMER",
  },
  {
    email: "customer2@supportpilot.local",
    name: "Riley Patel",
    role: "CUSTOMER",
  },
];

type Fixture = {
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  ageHours: number;
  agent: number | null;
  reply?: string;
};
const fixtures: Fixture[] = [
  {
    subject: "Charged twice for the monthly plan",
    description:
      "My account shows two payments for this month's subscription. Could you check the duplicate and explain the refund process?",
    category: "BILLING",
    priority: "HIGH",
    status: "IN_PROGRESS",
    ageHours: 27,
    agent: 1,
    reply:
      "Thanks for flagging this. We are reviewing the two payment references and will confirm the next steps here.",
  },
  {
    subject: "CSV export returns 500",
    description:
      "Exporting the full activity report fails with a 500 response. Small date ranges work, but the last 30 days does not.",
    category: "TECHNICAL",
    priority: "URGENT",
    status: "OPEN",
    ageHours: 2,
    agent: null,
  },
  {
    subject: "Unable to reset MFA",
    description:
      "I replaced my phone and can no longer sign in with my authenticator. I still have access to the registered email address.",
    category: "ACCOUNT",
    priority: "HIGH",
    status: "WAITING_ON_CUSTOMER",
    ageHours: 8,
    agent: 2,
    reply:
      "Please use the account recovery form from the sign-in screen. Do not send passwords or recovery codes in this ticket.",
  },
  {
    subject: "Unable to invite a teammate",
    description:
      "Inviting a colleague shows an expired invitation error immediately. The colleague has never used this workspace before.",
    category: "PRODUCT",
    priority: "MEDIUM",
    status: "RESOLVED",
    ageHours: 24,
    agent: 1,
    reply:
      "The earlier invitation was cancelled and a new invitation is now available. Please confirm your teammate can join.",
  },
  {
    subject: "Add Slack notification support",
    description:
      "Our support team would like a Slack notification when an urgent ticket is assigned. Is there a supported integration or roadmap item?",
    category: "FEATURE_REQUEST",
    priority: "LOW",
    status: "OPEN",
    ageHours: 1,
    agent: null,
  },
  {
    subject: "Invoice needs an updated billing address",
    description:
      "Our billing address changed before the latest invoice was generated. Can you explain how to update it for future invoices?",
    category: "BILLING",
    priority: "LOW",
    status: "CLOSED",
    ageHours: 48,
    agent: 2,
    reply:
      "The billing address can be changed in workspace settings. Future invoices will use the updated address.",
  },
  {
    subject: "Webhook deliveries are delayed",
    description:
      "The ticket.updated webhook is arriving several minutes late in our staging environment. We can provide timestamps for three affected events.",
    category: "TECHNICAL",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    ageHours: 3.7,
    agent: 2,
  },
  {
    subject: "How can I export a conversation?",
    description:
      "I need a copy of a support conversation for our internal incident review. What is the recommended way to export it?",
    category: "GENERAL",
    priority: "MEDIUM",
    status: "OPEN",
    ageHours: 0.3,
    agent: null,
  },
];

async function seed() {
  const database = new URL(env.DATABASE_URL);
  const localDatabase = [
    "localhost",
    "127.0.0.1",
    "[::1]",
    "postgres",
  ].includes(database.hostname);
  const allowRemoteDevelopment = process.argv.includes(
    "--allow-remote-development",
  );
  if (
    env.NODE_ENV !== "development" ||
    (!localDatabase && !allowRemoteDevelopment)
  ) {
    throw new Error(
      "Seed requires development mode. Remote development databases also require --allow-remote-development.",
    );
  }
  if (!localDatabase)
    console.log(
      "Explicit remote development seed enabled; existing demo data is preserved.",
    );
  const passwordHash = await hashPassword("SupportPilot123!");
  const users = [];
  for (const account of accounts) {
    users.push(
      await prisma.user.upsert({
        where: { email: account.email },
        update: {},
        create: { ...account, passwordHash },
      }),
    );
  }
  const [admin, agent1, agent2, customer1, customer2] = users;
  if (!admin || !agent1 || !agent2 || !customer1 || !customer2)
    throw new Error("Seed accounts missing");
  const team = await prisma.team.upsert({
    where: { name: "Customer Operations" },
    update: {},
    create: {
      name: "Customer Operations",
      description: "Development support team",
    },
  });
  for (const agent of [agent1, agent2]) {
    await prisma.teamMembership.upsert({
      where: { teamId_userId: { teamId: team.id, userId: agent.id } },
      update: {},
      create: { teamId: team.id, userId: agent.id },
    });
  }
  for (const [index, fixture] of fixtures.entries()) {
    const id = `cspseed${String(index + 1).padStart(18, "0")}`;
    if (await prisma.ticket.findUnique({ where: { id }, select: { id: true } }))
      continue;
    const customer = index % 2 === 0 ? customer1 : customer2;
    const agent =
      fixture.agent === 1 ? agent1 : fixture.agent === 2 ? agent2 : null;
    const createdAt = new Date(Date.now() - fixture.ageHours * 3_600_000);
    const deadlines = getSlaDeadlines(fixture.priority, createdAt);
    const firstRespondedAt = fixture.reply
      ? new Date(createdAt.getTime() + 20 * 60_000)
      : null;
    const resolvedAt =
      fixture.status === "RESOLVED" || fixture.status === "CLOSED"
        ? new Date(createdAt.getTime() + 2 * 3_600_000)
        : null;
    await prisma.$transaction(
      async (tx) => {
        await tx.ticket.create({
          data: {
            id,
            customerId: customer.id,
            teamId: team.id,
            assignedAgentId: agent?.id,
            subject: fixture.subject,
            description: fixture.description,
            status: fixture.status,
            category: fixture.category,
            priority: fixture.priority,
            ...deadlines,
            firstRespondedAt,
            resolvedAt,
            closedAt: fixture.status === "CLOSED" ? resolvedAt : null,
            createdAt,
            updatedAt: resolvedAt ?? firstRespondedAt ?? createdAt,
          },
        });
        await tx.auditLog.create({
          data: {
            ticketId: id,
            actorId: customer.id,
            action: "TICKET_CREATED",
            createdAt,
            metadata: { subject: fixture.subject, seed: true },
          },
        });
        await tx.sLAEvent.createMany({
          data: [
            {
              ticketId: id,
              type: "FIRST_RESPONSE_DUE",
              dueAt: deadlines.firstResponseDueAt,
              occurredAt: createdAt,
            },
            {
              ticketId: id,
              type: "RESOLUTION_DUE",
              dueAt: deadlines.resolutionDueAt,
              occurredAt: createdAt,
            },
          ],
        });
        if (agent) {
          const assignedAt = new Date(createdAt.getTime() + 5 * 60_000);
          if (index === 0) {
            await tx.ticketAssignment.create({
              data: {
                ticketId: id,
                agentId: agent2.id,
                assignedById: admin.id,
                assignedAt: createdAt,
                unassignedAt: assignedAt,
              },
            });
            await tx.auditLog.create({
              data: {
                ticketId: id,
                actorId: admin.id,
                action: "ASSIGNED",
                createdAt,
                metadata: { agentId: agent2.id },
              },
            });
          }
          await tx.ticketAssignment.create({
            data: {
              ticketId: id,
              agentId: agent.id,
              assignedById: admin.id,
              assignedAt,
            },
          });
          await tx.auditLog.create({
            data: {
              ticketId: id,
              actorId: admin.id,
              action: "ASSIGNED",
              createdAt: assignedAt,
              metadata: {
                agentId: agent.id,
                previousAgentId: index === 0 ? agent2.id : null,
              },
            },
          });
          const note = await tx.ticketMessage.create({
            data: {
              ticketId: id,
              authorId: agent.id,
              authorType: "AGENT",
              body: "Review the account history before replying. Keep payment references out of the public conversation.",
              isInternal: true,
              createdAt: assignedAt,
            },
          });
          await tx.auditLog.create({
            data: {
              ticketId: id,
              actorId: agent.id,
              action: "MESSAGE_ADDED",
              createdAt: assignedAt,
              metadata: {
                messageId: note.id,
                isInternal: true,
                authorType: "AGENT",
              },
            },
          });
          if (fixture.reply && firstRespondedAt) {
            const reply = await tx.ticketMessage.create({
              data: {
                ticketId: id,
                authorId: agent.id,
                authorType: "AGENT",
                body: fixture.reply,
                createdAt: firstRespondedAt,
              },
            });
            await tx.auditLog.create({
              data: {
                ticketId: id,
                actorId: agent.id,
                action: "MESSAGE_ADDED",
                createdAt: firstRespondedAt,
                metadata: {
                  messageId: reply.id,
                  isInternal: false,
                  authorType: "AGENT",
                },
              },
            });
            await tx.sLAEvent.create({
              data: {
                ticketId: id,
                type:
                  firstRespondedAt <= deadlines.firstResponseDueAt
                    ? "FIRST_RESPONSE_MET"
                    : "FIRST_RESPONSE_BREACHED",
                dueAt: deadlines.firstResponseDueAt,
                occurredAt: firstRespondedAt,
              },
            });
          }
        }
        if (resolvedAt)
          await tx.sLAEvent.create({
            data: {
              ticketId: id,
              type:
                resolvedAt <= deadlines.resolutionDueAt
                  ? "RESOLUTION_MET"
                  : "RESOLUTION_BREACHED",
              dueAt: deadlines.resolutionDueAt,
              occurredAt: resolvedAt,
            },
          });
        if (fixture.status !== "OPEN") {
          const path: TicketStatus[] = ["OPEN", "IN_PROGRESS"];
          if (fixture.status === "WAITING_ON_CUSTOMER")
            path.push("WAITING_ON_CUSTOMER");
          if (fixture.status === "RESOLVED" || fixture.status === "CLOSED")
            path.push("RESOLVED");
          if (fixture.status === "CLOSED") path.push("CLOSED");
          for (let step = 1; step < path.length; step++) {
            const to = path[step];
            await tx.auditLog.create({
              data: {
                ticketId: id,
                actorId: agent?.id ?? admin.id,
                action: "STATUS_CHANGED",
                createdAt:
                  to === "RESOLVED" || to === "CLOSED"
                    ? resolvedAt!
                    : new Date(createdAt.getTime() + (6 + step) * 60_000),
                metadata: { from: path[step - 1]!, to: to!, seed: true },
              },
            });
          }
        }
      },
      { timeout: 30_000 },
    );
  }
  console.log(
    "Development seed complete. Existing demo records and passwords were preserved. See README for local accounts.",
  );
}

seed()
  .catch(() => {
    console.error(
      "Development seed failed. Check environment, database availability, and migrations.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
