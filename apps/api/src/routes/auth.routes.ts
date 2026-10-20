import { Router } from "express";
import {
  getCurrentUser,
  login,
  registerCustomer,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../auth/auth.service.js";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
} from "../auth/auth.schemas.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid registration data.",
        details: parsed.error.flatten().fieldErrors,
      },
    });
  }

  try {
    const result = await registerCustomer(parsed.data);
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "An account already exists for this email.",
        },
      });
    }

    throw error;
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid login data.",
      },
    });
  }

  try {
    return res.status(200).json(await login(parsed.data));
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        },
      });
    }

    if (error instanceof Error && error.message === "ACCOUNT_NOT_ACTIVE") {
      return res.status(403).json({
        error: {
          code: "ACCOUNT_NOT_ACTIVE",
          message: "This account is not active.",
        },
      });
    }

    throw error;
  }
});

authRouter.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "A refresh token is required.",
      },
    });
  }

  try {
    return res.status(200).json(await rotateRefreshToken(parsed.data.refreshToken));
  } catch {
    return res.status(401).json({
      error: {
        code: "INVALID_REFRESH_TOKEN",
        message: "The refresh token is invalid, expired, or revoked.",
      },
    });
  }
});

authRouter.post("/logout", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);

  if (parsed.success) {
    await revokeRefreshToken(parsed.data.refreshToken);
  }

  return res.status(204).send();
});

authRouter.get("/me", authenticate, async (req, res) => {
  return res.status(200).json(await getCurrentUser(req.auth!.userId));
});
