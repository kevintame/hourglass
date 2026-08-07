export function formatMoney(minor: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export function parseMoney(value: FormDataEntryValue | null) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function calculateInvoiceAmounts(lines: Array<{ amount: number; taxable: boolean }>, taxBps: number) {
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const taxableSubtotal = lines.reduce((sum, line) => sum + (line.taxable ? line.amount : 0), 0);
  const taxAmount = Math.round(taxableSubtotal * taxBps / 10000);
  return { subtotal, taxableSubtotal, taxAmount, total: subtotal + taxAmount };
}

export function roundBillableMinutes(seconds: number) {
  if (seconds <= 0) return 0;
  return Math.ceil(seconds / 900) * 15;
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function formatDateTime(value: Date, timezone = "America/Denver") {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(value);
}
