import { app } from "./app.js";
import { env } from "./config/env.js";
import { closeQueues } from "./jobs/queues.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.API_PORT, () => {
  console.log(`SupportPilot API listening on http://localhost:${env.API_PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down gracefully.`);

  server.close(async (error) => {
    if (error) {
      console.error("Failed to close HTTP server:", error);
      process.exit(1);
    }

    await Promise.allSettled([
      closeQueues(),
      prisma.$disconnect(),
    ]);

    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
