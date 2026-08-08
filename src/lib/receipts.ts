import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { uploadDirectory } from "./config";

export const MAX_RECEIPT_BYTES = 10_000_000;
export const RECEIPT_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

const extensionByType: Record<(typeof RECEIPT_MIME_TYPES)[number], string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export function receiptDirectory() {
  return path.join(uploadDirectory(), "receipts");
}

export function receiptFilePath(filename: string) {
  if (!/^[0-9a-f-]+\.(pdf|png|jpg)$/.test(filename)) throw new Error("Invalid receipt filename");
  return path.join(receiptDirectory(), filename);
}

export async function saveReceipt(file: File) {
  if (file.size <= 0 || file.size > MAX_RECEIPT_BYTES) throw new Error("Receipt must be 10 MB or smaller");
  if (!RECEIPT_MIME_TYPES.includes(file.type as (typeof RECEIPT_MIME_TYPES)[number])) throw new Error("Receipt must be a PDF, PNG, or JPEG");
  const mimeType = file.type as (typeof RECEIPT_MIME_TYPES)[number];
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const document = mimeType === "application/pdf" ? await PDFDocument.load(bytes) : await PDFDocument.create();
    if (mimeType === "application/pdf" && document.getPageCount() === 0) throw new Error("PDF has no pages");
    if (mimeType === "image/png") await document.embedPng(bytes);
    if (mimeType === "image/jpeg") await document.embedJpg(bytes);
  } catch {
    throw new Error(mimeType === "application/pdf" ? "Receipt PDF is encrypted or invalid" : "Receipt image is invalid");
  }
  const filename = `${randomUUID()}.${extensionByType[mimeType]}`;
  await mkdir(receiptDirectory(), { recursive: true });
  await writeFile(receiptFilePath(filename), bytes, { flag: "wx" });
  return { filename, originalName: file.name.slice(0, 255), mimeType };
}

export async function deleteReceipt(filename: string | null | undefined) {
  if (!filename) return;
  try { await unlink(receiptFilePath(filename)); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
