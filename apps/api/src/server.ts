import { app } from "./app.js";
import { env } from "./config/env.js";
import { closeQueues } from "./jobs/queues.js";
import { prisma } from "./lib/prisma.js";

const port = env.PORT ?? env.API_PORT;
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`SupportPilot API listening on port ${port}`);
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
