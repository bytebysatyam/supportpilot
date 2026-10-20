import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.API_PORT, () => {
  console.log(`SupportPilot API listening on http://localhost:${env.API_PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully.`);

  server.close((error) => {
    if (error) {
      console.error("Failed to close HTTP server:", error);
      process.exit(1);
    }

    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
