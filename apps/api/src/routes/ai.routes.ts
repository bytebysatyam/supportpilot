import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { aiRunSchema } from "../ai/ai.schemas.js";
import {
  listTicketAiAnalyses,
  runTicketAiAnalysis,
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
    const result = await runTicketAiAnalysis(
      {
        userId: req.auth!.userId,
        role: req.auth!.role,
      },
      parsedId.data,
      parsedBody.data.type,
    );

    return res.status(201).json(result);
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

    if (error.message === "AI_PROVIDER_DISABLED") {
      return res.status(503).json({
        error: {
          code: "AI_PROVIDER_DISABLED",
          message: "AI automation is not configured.",
        },
      });
    }

    if (error.message.startsWith("AI_PROVIDER_")) {
      return res.status(502).json({
        error: {
          code: "AI_PROVIDER_ERROR",
          message: "The configured AI provider could not complete the request.",
        },
      });
    }

    return res.status(422).json({
      error: {
        code: "AI_OUTPUT_INVALID",
        message: "The AI response did not match the expected structured format.",
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
