import { describe, expect, it } from "vitest";
import { bearerOk } from "../lib/auth";
import { loadConfig } from "../lib/config";

const env = {
  API_TOKEN: "a".repeat(32),
  NTFY_TOPIC: "t".repeat(16),
  VERCEL_PROJECT_PRODUCTION_URL: "rmt-open-tracker.vercel.app",
};

describe("loadConfig", () => {
  it("derives the base url from the Vercel system variable", () => {
    expect(loadConfig(env).baseUrl).toBe("https://rmt-open-tracker.vercel.app");
  });

  it("prefers an explicit base url and trims the trailing slash", () => {
    expect(loadConfig({ ...env, TRACKER_BASE_URL: "https://t.example.com/" }).baseUrl).toBe(
      "https://t.example.com",
    );
  });

  it.each([
    [{ ...env, TRACKER_BASE_URL: "http://t.example.com" }],
    [{ ...env, API_TOKEN: "short" }],
    [{ ...env, NTFY_TOPIC: "guessable" }],
    [{ ...env, API_TOKEN: undefined }],
    [{ API_TOKEN: env.API_TOKEN, NTFY_TOPIC: env.NTFY_TOPIC }],
  ])("rejects invalid env %#", (bad) => {
    expect(() => loadConfig(bad)).toThrow();
  });
});

describe("bearerOk", () => {
  it("accepts only the exact bearer token", () => {
    expect(bearerOk("Bearer secret-value", "secret-value")).toBe(true);
    expect(bearerOk("Bearer secret-valuf", "secret-value")).toBe(false);
    expect(bearerOk("Bearer short", "secret-value")).toBe(false);
    expect(bearerOk("secret-value", "secret-value")).toBe(false);
    expect(bearerOk(undefined, "secret-value")).toBe(false);
  });
});
