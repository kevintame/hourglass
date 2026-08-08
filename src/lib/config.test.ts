import { describe, expect, it } from "vitest";
import { servedOverHttps } from "./config";

describe("session cookie security", () => {
  it("does not mark cookies secure on a plain-HTTP LAN deployment", () => {
    expect(servedOverHttps("http://10.69.4.130:3000")).toBe(false);
    expect(servedOverHttps("http://localhost:3000")).toBe(false);
  });

  it("marks cookies secure once the app is served over TLS", () => {
    expect(servedOverHttps("https://hourglass.example.com")).toBe(true);
    expect(servedOverHttps("  https://hourglass.example.com/  ")).toBe(true);
  });

  it("falls back to insecure when the URL is missing or unparseable", () => {
    expect(servedOverHttps(undefined)).toBe(false);
    expect(servedOverHttps("")).toBe(false);
    expect(servedOverHttps("   ")).toBe(false);
    expect(servedOverHttps("10.69.4.130:3000")).toBe(false);
  });
});
