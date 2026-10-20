import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { z } from "zod";
import { errorHandler, requestContext } from "./error.middleware.js";

test("central errors are JSON, carry request IDs, and do not expose internal failures", async () => {
  const app = express();
  app.use(requestContext, express.json());
  app.get("/failure", () => {
    throw new Error("private-database-connection-detail");
  });
  app.post("/validate", (req, res) =>
    res.json(z.object({ name: z.string().min(2) }).parse(req.body)),
  );
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const error = await fetch(base + "/failure");
    assert.equal(error.status, 500);
    assert.ok(error.headers.get("x-request-id"));
    const body = await error.text();
    assert.ok(!body.includes("private-database"));
    assert.ok(!body.includes("stack"));
    const validation = await fetch(base + "/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    assert.equal(validation.status, 400);
    const invalidJson = await fetch(base + "/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(invalidJson.status, 400);
  } finally {
    server.close();
    await once(server, "close");
  }
});
