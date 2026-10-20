import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

export const userRouter = Router();

userRouter.use(authenticate);

userRouter.get(
  "/support-agents",
  authorize("ADMIN", "SUPPORT_AGENT"),
  async (_req, res) => {
    const agents = await prisma.user.findMany({
      where: {
        role: "SUPPORT_AGENT",
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json(agents);
  },
);
