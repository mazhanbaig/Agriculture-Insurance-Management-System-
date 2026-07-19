const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

// Ensure critical env vars are set before any test files load
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://dummy:5432/test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://dummy.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "dummy-anon-key";
process.env.NODE_ENV = "test";

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  setupFiles: [],
};