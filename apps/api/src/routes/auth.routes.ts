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
authRouter.post("/register", async (req, res) =>
  res.status(201).json(await registerCustomer(registerSchema.parse(req.body))),
);
authRouter.post("/login", async (req, res) =>
  res.json(await login(loginSchema.parse(req.body))),
);
authRouter.post("/refresh", async (req, res) =>
  res.json(
    await rotateRefreshToken(refreshSchema.parse(req.body).refreshToken),
  ),
);
authRouter.post("/logout", async (req, res) => {
  await revokeRefreshToken(refreshSchema.parse(req.body).refreshToken);
  return res.status(204).send();
});
authRouter.get("/me", authenticate, async (req, res) =>
  res.json(await getCurrentUser(req.auth!.userId)),
);
