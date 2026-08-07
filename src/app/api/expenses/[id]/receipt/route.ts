import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { receiptFilePath } from "@/lib/receipts";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const [expense] = await db.select({
    filename: expenses.receiptFilename,
    originalName: expenses.receiptOriginalName,
    mimeType: expenses.receiptMimeType,
  }).from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!expense?.filename || !expense.mimeType) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(receiptFilePath(expense.filename));
    const displayName = (expense.originalName || "receipt").replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
    return new Response(bytes, {
      headers: {
        "Content-Type": expense.mimeType,
        "Content-Disposition": `inline; filename="${displayName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Receipt file is unavailable", { status: 404 });
  }
}
