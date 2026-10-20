import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { aiRunSchema } from "../ai/ai.schemas.js";
import { env } from "../config/env.js";
import {
  listTicketAiAnalyses,
  requestTicketAiAnalysis,
} from "../ai/ai.service.js";

export const aiRouter = Router();
aiRouter.use(authenticate, authorize("ADMIN", "SUPPORT_AGENT"));
aiRouter.get("/capabilities", (_req, res) =>
  res.json({
    enabled: env.AI_PROVIDER !== "disabled",
    provider: env.AI_PROVIDER,
  }),
);

aiRouter.post("/tickets/:ticketId/analyze", async (req, res) => {
  const id = z.string().cuid().safeParse(req.params.ticketId);
  const body = aiRunSchema.safeParse(req.body);
  if (!id.success || !body.success)
    return res
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid analysis request.",
        },
      });
  return res
    .status(202)
    .json(
      await requestTicketAiAnalysis(
        { userId: req.auth!.userId, role: req.auth!.role },
        id.data,
        body.data.type,
      ),
    );
});
aiRouter.get("/tickets/:ticketId/analyses", async (req, res) => {
  const id = z.string().cuid().safeParse(req.params.ticketId);
  if (!id.success)
    return res
      .status(400)
      .json({
        error: { code: "VALIDATION_ERROR", message: "Invalid ticket id." },
      });
  return res.json(
    await listTicketAiAnalyses(
      { userId: req.auth!.userId, role: req.auth!.role },
      id.data,
    ),
  );
});
