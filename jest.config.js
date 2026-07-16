const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

// Ensure DATABASE_URL is set before any test files load
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://dummy:5432/test";
process.env.NODE_ENV = "test";

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  setupFiles: [],
};