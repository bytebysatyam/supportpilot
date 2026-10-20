import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { aiRunSchema } from "../ai/ai.schemas.js";
import {
  listTicketAiAnalyses,
  requestTicketAiAnalysis,
} from "../ai/ai.service.js";

export const aiRouter = Router();

aiRouter.use(authenticate);
aiRouter.use(authorize("ADMIN", "SUPPORT_AGENT"));

const ticketIdSchema = z.string().cuid();

aiRouter.post("/tickets/:ticketId/analyze", async (req, res) => {
  const parsedId = ticketIdSchema.safeParse(req.params.ticketId);
  const parsedBody = aiRunSchema.safeParse(req.body);

  if (!parsedId.success || !parsedBody.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid AI analysis request.",
      },
    });
  }

  try {
    const result = await requestTicketAiAnalysis(
      {
        userId: req.auth!.userId,
        role: req.auth!.role,
      },
      parsedId.data,
      parsedBody.data.type,
    );

    return res.status(202).json(result);
  } catch (error) {
    if (!(error instanceof Error)) throw error;

    if (error.message === "TICKET_NOT_FOUND") {
      return res.status(404).json({
        error: {
          code: "TICKET_NOT_FOUND",
          message: "Ticket not found.",
        },
      });
    }

    return res.status(503).json({
      error: {
        code: "AI_QUEUE_UNAVAILABLE",
        message: "The AI job could not be queued. Please try again.",
      },
    });
  }
});

aiRouter.get("/tickets/:ticketId/analyses", async (req, res) => {
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
      await listTicketAiAnalyses(
        {
          userId: req.auth!.userId,
          role: req.auth!.role,
        },
        parsedId.data,
      ),
    );
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
