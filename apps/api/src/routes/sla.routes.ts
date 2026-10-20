import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  getTicketSla,
  refreshOpenTicketBreaches,
} from "../sla/sla.service.js";

export const slaRouter = Router();

slaRouter.use(authenticate);

slaRouter.get("/tickets/:ticketId", async (req, res) => {
  const parsedId = z.string().cuid().safeParse(req.params.ticketId);

  if (!parsedId.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid ticket id.",
      },
    });
  }

  if (req.auth!.role === "CUSTOMER") {
    const owned = await prisma.ticket.findFirst({
      where: {
        id: parsedId.data,
        customerId: req.auth!.userId,
      },
      select: { id: true },
    });

    if (!owned) {
      return res.status(404).json({
        error: {
          code: "TICKET_NOT_FOUND",
          message: "Ticket not found.",
        },
      });
    }
  }

  try {
    const result = await getTicketSla(parsedId.data);
    if (req.auth!.role === "CUSTOMER") {
      return res.json({ ticketId: result.ticketId, priority: result.priority, status: result.status, firstResponse: result.firstResponse, resolution: result.resolution });
    }
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "TICKET_NOT_FOUND") {
      return res.status(404).json({
        error: {
          code: "TICKET_NOT_FOUND",
          message: "Ticket not found.",
        },
      });
    }

    throw error;
  }
});

slaRouter.post(
  "/refresh-breaches",
  authorize("ADMIN", "SUPPORT_AGENT"),
  async (_req, res) => {
    return res.status(200).json(await refreshOpenTicketBreaches());
  },
);
