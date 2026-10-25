// Lets the compiled tests resolve the app's "@/..." import alias (tsconfig `paths`) at runtime.
// Loaded with `node --require tests/resolve-alias.cjs`; maps "@/x" to "<outDir>/src/x".
/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS preload must use require */
const Module = require("node:module");
const path = require("node:path");

const srcRoot = path.join(__dirname, "..", "src");
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function resolveWithAlias(request, ...rest) {
  if (request.startsWith("@/")) {
    return originalResolve.call(this, path.join(srcRoot, request.slice(2)), ...rest);
  }
  return originalResolve.call(this, request, ...rest);
};
