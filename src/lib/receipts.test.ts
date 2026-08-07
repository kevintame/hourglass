import { describe, expect, it } from "vitest";
import { receiptFilePath, saveReceipt } from "./receipts";

describe("expense receipts", () => {
  it("rejects filenames that could escape the receipt directory", () => {
    expect(() => receiptFilePath("../receipt.pdf")).toThrow("Invalid receipt filename");
  });

  it("rejects unsupported content types", async () => {
    await expect(saveReceipt(new File(["receipt"], "receipt.txt", { type: "text/plain" }))).rejects.toThrow("PDF, PNG, or JPEG");
  });

  it("rejects malformed PDFs", async () => {
    await expect(saveReceipt(new File(["not a pdf"], "receipt.pdf", { type: "application/pdf" }))).rejects.toThrow("encrypted or invalid");
  });
});
