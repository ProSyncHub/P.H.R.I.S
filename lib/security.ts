import { z } from "zod";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const analysisUploadSchema = z.object({
  employeeId: z.string().min(1),
  reportDate: z.string().min(1),
  eodText: z.string().min(20, "Manual EOD must include meaningful detail.")
});

export function assertAllowedUpload(file: File) {
  const allowed = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ];
  const lowerName = file.name.toLowerCase();
  const validName = lowerName.endsWith(".csv") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");

  if (!validName || (file.type && !allowed.includes(file.type))) {
    throw new Error("Only CSV, XLS, and XLSX files are supported.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Upload exceeds the 8 MB file size limit.");
  }
}

export function sanitizeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 1000);
}
