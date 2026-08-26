const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "../..");
const source = path.join(workspaceRoot, "node_modules", ".prisma", "client");
const destination = path.join(workspaceRoot, "backend", "node_modules", ".prisma", "client");

if (!fs.existsSync(source)) {
  throw new Error(`Generated Prisma client not found at ${source}`);
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
console.log(`[prisma] synced generated client to ${destination}`);
