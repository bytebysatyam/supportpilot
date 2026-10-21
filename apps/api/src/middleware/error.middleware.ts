import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

const knownErrors: Record<string, [number, string]> = {
  EMAIL_ALREADY_EXISTS: [409, "An account already exists for this email."],
  INVALID_CREDENTIALS: [401, "Email or password is incorrect."],
  ACCOUNT_NOT_ACTIVE: [403, "This account is not active."],
  INVALID_REFRESH_TOKEN: [
    401,
    "Your session has expired. Please sign in again.",
  ],
  USER_NOT_FOUND: [401, "Your account is unavailable."],
  UNAUTHENTICATED: [401, "Please sign in to continue."],
  INVALID_ACCESS_TOKEN: [401, "Your access token is invalid or expired."],
  FORBIDDEN: [403, "You do not have permission for this action."],
  CUSTOMER_ONLY_OPERATION: [403, "Only customers can create support tickets."],
  TICKET_NOT_FOUND: [404, "Ticket not found."],
  INVALID_ASSIGNEE: [400, "Choose an active support agent."],
  INVALID_STATUS_TRANSITION: [409, "That status change is not allowed."],
  CUSTOMERS_CANNOT_CREATE_INTERNAL_NOTES: [
    403,
    "Internal notes are restricted to staff.",
  ],
  AI_PROVIDER_DISABLED: [503, "AI is not configured for this workspace."],
  AI_QUEUE_UNAVAILABLE: [503, "AI could not be queued. Please try again."],
};

export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  res.setHeader("x-request-id", requestId);
  const startedAt = Date.now();
  res.on("finish", () => {
    console.info(
      JSON.stringify({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      }),
    );
  });
  next();
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) return next(error);
  const requestId = res.getHeader("x-request-id");
  const known = error instanceof Error ? knownErrors[error.message] : undefined;
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the submitted fields and try again.",
        details: error.flatten().fieldErrors,
        requestId,
      },
    });
    return;
  }
  if (known && error instanceof Error) {
    res
      .status(known[0])
      .json({ error: { code: error.message, message: known[1], requestId } });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
        requestId,
      },
    });
    return;
  }
  if (
    error instanceof Error &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body is too large.",
        requestId,
      },
    });
    return;
  }
  const unavailable =
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1001", "P1002", "P1008", "P1017"].includes(error.code));
  // Deliberately omit raw DB/provider errors, which may contain connection details.
  console.error(
    JSON.stringify({
      requestId,
      event: "request_failed",
      errorType: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  res.status(unavailable ? 503 : 500).json({
    error: {
      code: unavailable ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
      message: unavailable
        ? "The database is unavailable. Please try again shortly."
        : "Something went wrong. Please try again.",
      requestId,
    },
  });
};
