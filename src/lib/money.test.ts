import { describe, expect, it } from "vitest";
import { calculateInvoiceAmounts, roundBillableMinutes } from "./money";

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

describe("invoice tax", () => {
  it("taxes only taxable lines while retaining every line in the subtotal", () => {
    expect(calculateInvoiceAmounts([
      { amount: 10_000, taxable: true },
      { amount: 2_500, taxable: false },
      { amount: 1_500, taxable: true },
    ], 825)).toEqual({ subtotal: 14_000, taxableSubtotal: 11_500, taxAmount: 949, total: 14_949 });
  });
});
