import { describe, expect, it } from "vitest";
import { roundBillableMinutes } from "./money";

describe("quarter-hour billing", () => {
  it("rounds each entry upward", () => {
    expect(roundBillableMinutes(1)).toBe(15);
    expect(roundBillableMinutes(900)).toBe(15);
    expect(roundBillableMinutes(901)).toBe(30);
    expect(roundBillableMinutes(3600)).toBe(60);
  });
  it("does not bill empty or negative durations", () => {
    expect(roundBillableMinutes(0)).toBe(0);
    expect(roundBillableMinutes(-5)).toBe(0);
  });
});
