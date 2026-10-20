import { Router } from "express";
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

const ticketIdSchema = z.string().cuid();

function actorFromRequest(req: {
  auth?: {
    userId: string;
    role: "ADMIN" | "SUPPORT_AGENT" | "CUSTOMER";
  };
}) {
  return {
    userId: req.auth!.userId,
    role: req.auth!.role,
  };
}

function sendServiceError(res: any, error: unknown) {
  if (!(error instanceof Error)) {
    throw error;
  }

  const errors: Record<string, { status: number; message: string }> = {
    TICKET_NOT_FOUND: { status: 404, message: "Ticket not found." },
    FORBIDDEN: { status: 403, message: "You do not have permission for this ticket operation." },
    CUSTOMER_ONLY_OPERATION: { status: 403, message: "Only customers can create support tickets." },
    INVALID_ASSIGNEE: { status: 400, message: "The assignee must be an active support agent." },
    INVALID_STATUS_TRANSITION: { status: 409, message: "The requested ticket status transition is not allowed." },
    CUSTOMERS_CANNOT_CREATE_INTERNAL_NOTES: { status: 403, message: "Customers cannot create internal notes." },
  };

  const known = errors[error.message];
  if (!known) {
    throw error;
  }

  return res.status(known.status).json({
    error: {
      code: error.message,
      message: known.message,
    },
  });
}

ticketRouter.post("/", async (req, res) => {
  const parsed = createTicketSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid ticket data.",
        details: parsed.error.flatten().fieldErrors,
      },
    });
  }

  try {
    return res.status(201).json(
      await createTicket(actorFromRequest(req), parsed.data),
    );
  } catch (error) {
    return sendServiceError(res, error);
  }
});

ticketRouter.get("/", async (req, res) => {
  const parsed = listTicketsSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid ticket filters.",
        details: parsed.error.flatten().fieldErrors,
      },
    });
  }

  return res.status(200).json(
    await listTickets(actorFromRequest(req), parsed.data),
  );
});

ticketRouter.get("/:ticketId", async (req, res) => {
  const parsedId = ticketIdSchema.safeParse(req.params.ticketId);

  if (!parsedId.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid ticket id.",
      },
    });
  }

  try {
    return res.status(200).json(
      await getTicketById(actorFromRequest(req), parsedId.data),
    );
  } catch (error) {
    return sendServiceError(res, error);
  }
});

ticketRouter.patch("/:ticketId", async (req, res) => {
  const parsedId = ticketIdSchema.safeParse(req.params.ticketId);
  const parsedBody = updateTicketSchema.safeParse(req.body);

  if (!parsedId.success || !parsedBody.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid ticket update.",
        details: parsedBody.success ? undefined : parsedBody.error.flatten().fieldErrors,
      },
    });
  }

  try {
    return res.status(200).json(
      await updateTicket(actorFromRequest(req), parsedId.data, parsedBody.data),
    );
  } catch (error) {
    return sendServiceError(res, error);
  }
});

ticketRouter.put("/:ticketId/assignment", async (req, res) => {
  const parsedId = ticketIdSchema.safeParse(req.params.ticketId);
  const parsedBody = assignTicketSchema.safeParse(req.body);

  if (!parsedId.success || !parsedBody.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid assignment request.",
        details: parsedBody.success ? undefined : parsedBody.error.flatten().fieldErrors,
      },
    });
  }

  try {
    return res.status(200).json(
      await assignTicket(
        actorFromRequest(req),
        parsedId.data,
        parsedBody.data.agentId,
      ),
    );
  } catch (error) {
    return sendServiceError(res, error);
  }
});

ticketRouter.get("/:ticketId/assignments", async (req, res) => {
  const parsedId = ticketIdSchema.safeParse(req.params.ticketId);

  if (!parsedId.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid ticket id.",
      },
    });
  }

  try {
    return res.status(200).json(
      await getAssignmentHistory(actorFromRequest(req), parsedId.data),
    );
  } catch (error) {
    return sendServiceError(res, error);
  }
});


ticketRouter.post("/:ticketId/messages", async (req, res) => {
  const parsedId = ticketIdSchema.safeParse(req.params.ticketId);
  const parsedBody = createMessageSchema.safeParse(req.body);

  if (!parsedId.success || !parsedBody.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid message request.",
        details: parsedBody.success ? undefined : parsedBody.error.flatten().fieldErrors,
      },
    });
  }

  try {
    return res.status(201).json(
      await addTicketMessage(
        actorFromRequest(req),
        parsedId.data,
        parsedBody.data,
      ),
    );
  } catch (error) {
    return sendServiceError(res, error);
  }
});

ticketRouter.get("/:ticketId/messages", async (req, res) => {
  const parsedId = ticketIdSchema.safeParse(req.params.ticketId);

  if (!parsedId.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid ticket id.",
      },
    });
  }

  try {
    return res.status(200).json(
      await listTicketMessages(actorFromRequest(req), parsedId.data),
    );
  } catch (error) {
    return sendServiceError(res, error);
  }
});

ticketRouter.get("/:ticketId/timeline", async (req, res) => {
  const parsedId = ticketIdSchema.safeParse(req.params.ticketId);

  if (!parsedId.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid ticket id.",
      },
    });
  }

  try {
    return res.status(200).json(
      await getTicketTimeline(actorFromRequest(req), parsedId.data),
    );
  } catch (error) {
    return sendServiceError(res, error);
  }
});
