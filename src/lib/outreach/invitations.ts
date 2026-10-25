import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type ResponseChoice = "interested" | "declined";
export type Invitation = {
  token: string; companyId: string; companyName: string; to: string; subject: string;
  createdAt: string; sentAt: string | null; response: ResponseChoice | null; respondedAt: string | null;
  simulated: true;
};
export function responseCounts(invitations: Invitation[]) {
  const counts = { interested: 0, declined: 0, pending: 0 };
  for (const invitation of invitations) {
    if (invitation.sentAt) counts[invitation.response ?? "pending"]++;
  }
  return counts;
}
export function newInvitation(companyId: string, companyName: string): Invitation {
  return { token: randomBytes(32).toString("hex"), companyId, companyName, to: "", subject: "", createdAt: new Date().toISOString(), sentAt: null, response: null, respondedAt: null, simulated: true };
}
export function applyResponse(invitation: Invitation, choice: ResponseChoice): Invitation {
  if (!invitation.sentAt) throw new Error("This demo invitation has not been sent yet.");
  if (choice !== "interested" && choice !== "declined") throw new Error("Invalid response.");
  // Repeated confirmations do not inflate counts or change the original timestamp.
  if (invitation.response === choice) return invitation;
  return { ...invitation, response: choice, respondedAt: new Date().toISOString() };
}

const file = path.join(process.cwd(), ".data", "invitations.json");
const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const key = "velho:invitations";
let queue: Promise<unknown> = Promise.resolve();
async function redis<T>(command: string[]): Promise<T> {
  const result = await fetch(redisUrl!, { method: "POST", headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" }, body: JSON.stringify(command), cache: "no-store" });
  if (!result.ok) throw new Error("Could not save invitation data.");
  const data = await result.json();
  if (data.error) throw new Error("Invitation storage failed.");
  return data.result as T;
}
async function readLocal(): Promise<Invitation[]> {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
export async function readInvitations(): Promise<Invitation[]> {
  if (redisUrl && redisToken) return (await redis<string[]>(["HVALS", key])).map((row) => JSON.parse(row));
  await queue;
  return readLocal();
}
export async function findInvitation(token: string): Promise<Invitation | undefined> {
  if (!/^[a-f0-9]{64}$/.test(token)) return undefined;
  if (redisUrl && redisToken) {
    const value = await redis<string | null>(["HGET", key, token]);
    return value ? JSON.parse(value) : undefined;
  }
  return (await readInvitations()).find((entry) => entry.token === token);
}
export async function saveInvitation(invitation: Invitation): Promise<void> {
  if (redisUrl && redisToken) { await redis(["HSET", key, invitation.token, JSON.stringify(invitation)]); return; }
  const work = queue.then(async () => {
    const entries = await readLocal();
    const updated = [invitation, ...entries.filter((entry) => entry.token !== invitation.token)];
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(updated, null, 2));
    await rename(`${file}.tmp`, file);
  });
  queue = work.catch(() => {});
  await work;
}
