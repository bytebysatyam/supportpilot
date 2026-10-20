import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  getDashboardSummary,
  getStaffDirectory,
} from "../dashboard/dashboard.service.js";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate, authorize("ADMIN", "SUPPORT_AGENT"));
dashboardRouter.get("/summary", async (req, res) =>
  res.json(await getDashboardSummary(req.auth!.userId)),
);
dashboardRouter.get("/staff", authorize("ADMIN"), async (_req, res) =>
  res.json(await getStaffDirectory()),
);
