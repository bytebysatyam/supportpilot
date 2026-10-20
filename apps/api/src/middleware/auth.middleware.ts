import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { verifyAccessToken } from "../auth/token.js";
import { prisma } from "../lib/prisma.js";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "A valid Bearer access token is required.",
      },
    });
  }

  let payload;
  try {
    payload = verifyAccessToken(authorization.slice("Bearer ".length));
  } catch {
    throw new Error("INVALID_ACCESS_TOKEN");
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") throw new Error("ACCOUNT_NOT_ACTIVE");

  req.auth = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  next();
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
        },
      });
    }

    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to perform this action.",
        },
      });
    }

    next();
  };
}
