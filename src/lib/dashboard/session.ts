import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const DASHBOARD_COOKIE = "velho-dashboard-session";
export const SESSION_SECONDS = 8 * 60 * 60;

export function validDashboardCredentials(username: unknown, password: unknown): boolean {
  return username === "admin" && password === "admin";
}

export function createDashboardSession(secret: string, now = Date.now()): string {
  const payload = `admin.${now + SESSION_SECONDS * 1000}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function validDashboardSession(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token || token.length > 200) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "admin" || !/^\d+$/.test(parts[1]) || !/^[a-f0-9]{32}$/.test(parts[2])) return false;
  const expires = Number(parts[1]);
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + SESSION_SECONDS * 1000) return false;
  const expected = createHmac("sha256", secret).update(parts.slice(0, 3).join(".")).digest("base64url");
  const signature = Buffer.from(parts[3]);
  return signature.length === expected.length && timingSafeEqual(signature, Buffer.from(expected));
}
