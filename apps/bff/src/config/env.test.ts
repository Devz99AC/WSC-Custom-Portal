import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies safe defaults when the environment is empty", () => {
    const env = loadEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(8080);
    expect(env.HOST).toBe("0.0.0.0");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("coerces PORT and rejects invalid values (surfacing the key, not the value)", () => {
    expect(loadEnv({ PORT: "3000" }).PORT).toBe(3000);
    expect(() => loadEnv({ PORT: "not-a-number" })).toThrow(/Invalid environment/);
  });
});
