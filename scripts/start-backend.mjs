import next from "next";
import { createServer } from "node:http";
if (process.env.APP_SERVICE !== "backend") throw new Error("Use this entry point only for APP_SERVICE=backend");
const hostname = "127.0.0.1", port = Number(process.env.BACKEND_PORT || 3101);
const app = next({ dev: false, dir: process.cwd(), hostname, port });
await app.prepare();
const server = createServer(app.getRequestHandler());
server.listen(port, hostname, () => console.log(`HelpDesk backend ready on ${hostname}:${port}`));
process.on("SIGTERM", () => server.close(() => { app.close(); process.exit(0); }));
