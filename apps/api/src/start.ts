import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

// Optional Render single-service launcher. Each process gets the same injected environment.
const children = ["server.js", "workers/worker.js"].map((file) =>
  fork(fileURLToPath(new URL(file, import.meta.url)), [], {
    env: { ...process.env },
    stdio: "inherit",
  }),
);
let stopping = false;
let exitCode = 0;
let remaining = children.length;

function shutdown(code: number, signal: NodeJS.Signals = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children)
    if (child.exitCode === null && child.signalCode === null)
      child.kill(signal);
  const deadline = setTimeout(() => {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    process.exit(exitCode || 1);
  }, 60_000);
  deadline.unref();
}
for (const child of children) {
  child.on("error", () => {
    console.error(
      JSON.stringify({ event: "application_process_start_failed" }),
    );
    shutdown(1);
  });
  child.on("exit", () => {
    remaining--;
    if (!stopping) {
      console.error(JSON.stringify({ event: "application_process_exited" }));
      shutdown(1);
    }
    if (remaining === 0) process.exit(exitCode);
  });
}
process.on("SIGINT", () => shutdown(0, "SIGINT"));
process.on("SIGTERM", () => shutdown(0));
