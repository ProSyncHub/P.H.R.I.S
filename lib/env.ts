const DEFAULT_APP_URL = "http://localhost:3000";

function normalizeUrl(value?: string) {
  const raw = value?.trim();
  if (!raw) return DEFAULT_APP_URL;

  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_APP_URL;
  }
}

export const appUrl = normalizeUrl(process.env.APP_URL ?? process.env.NEXTAUTH_URL);

export const seedAdminEmail = process.env.SEED_ADMIN_EMAIL?.trim() || "admin@prosync.local";
export const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || "Admin@12345";
