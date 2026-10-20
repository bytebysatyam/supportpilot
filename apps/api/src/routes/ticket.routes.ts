import { Router, type Request } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  assignTicketSchema,
  createTicketSchema,
  listTicketsSchema,
  updateTicketSchema,
} from "../tickets/ticket.schemas.js";
import { createMessageSchema } from "../tickets/message.schemas.js";
import {
  assignTicket,
  createTicket,
  getAssignmentHistory,
  getTicketById,
  listTickets,
  updateTicket,
} from "../tickets/ticket.service.js";
import {
  addTicketMessage,
  getTicketTimeline,
  listTicketMessages,
} from "../tickets/message.service.js";

export const ticketRouter = Router();
ticketRouter.use(authenticate);
const ticketId = (req: Request) => z.string().cuid().parse(req.params.ticketId);
const actor = (req: Request) => ({
  userId: req.auth!.userId,
  role: req.auth!.role,
});

ticketRouter.post("/", async (req, res) =>
  res
    .status(201)
    .json(await createTicket(actor(req), createTicketSchema.parse(req.body))),
);
ticketRouter.get("/", async (req, res) =>
  res.json(await listTickets(actor(req), listTicketsSchema.parse(req.query))),
);
ticketRouter.get("/:ticketId", async (req, res) =>
  res.json(await getTicketById(actor(req), ticketId(req))),
);
ticketRouter.patch("/:ticketId", async (req, res) =>
  res.json(
    await updateTicket(
      actor(req),
      ticketId(req),
      updateTicketSchema.parse(req.body),
    ),
  ),
);
ticketRouter.put("/:ticketId/assignment", async (req, res) =>
  res.json(
    await assignTicket(
      actor(req),
      ticketId(req),
      assignTicketSchema.parse(req.body).agentId,
    ),
  ),
);
ticketRouter.get("/:ticketId/assignments", async (req, res) =>
  res.json(await getAssignmentHistory(actor(req), ticketId(req))),
);
ticketRouter.get("/:ticketId/messages", async (req, res) =>
  res.json(await listTicketMessages(actor(req), ticketId(req))),
);
ticketRouter.post("/:ticketId/messages", async (req, res) =>
  res
    .status(201)
    .json(
      await addTicketMessage(
        actor(req),
        ticketId(req),
        createMessageSchema.parse(req.body),
      ),
    ),
);
ticketRouter.get("/:ticketId/timeline", async (req, res) =>
  res.json(await getTicketTimeline(actor(req), ticketId(req))),
);
