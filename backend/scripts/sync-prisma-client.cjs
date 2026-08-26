const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "../..");
const destination = path.join(workspaceRoot, "backend", "node_modules", ".prisma", "client");
const candidates = [
  path.join(workspaceRoot, "node_modules", ".prisma", "client"),
  destination,
];
const source = candidates.find((candidate) => fs.existsSync(candidate));

if (!source) {
  console.log("[prisma] no generated client found; a later prisma generate step will create it");
  process.exit(0);
}

if (path.resolve(source) === path.resolve(destination)) {
  console.log(`[prisma] generated client already exists at ${destination}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
console.log(`[prisma] synced generated client to ${destination}`);
