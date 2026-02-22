import fs from "node:fs";
import path from "node:path";
import { InboxMessage } from "./models";
import { withLock } from "./lock";
import { inboxPath } from "./paths";
import { readConfig } from "./teams";

export function nowIso(): string {
  return new Date().toISOString();
}

export async function appendMessage(teamName: string, agentName: string, message: InboxMessage) {
  const p = inboxPath(teamName, agentName);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await withLock(p, async () => {
    let msgs: InboxMessage[] = [];
    if (fs.existsSync(p)) {
      msgs = JSON.parse(fs.readFileSync(p, "utf-8"));
    }
    msgs.push(message);
    fs.writeFileSync(p, JSON.stringify(msgs, null, 2));
  });
}

export async function readInbox(
  teamName: string,
  agentName: string,
  unreadOnly = false,
  markAsRead = true
): Promise<InboxMessage[]> {
  const p = inboxPath(teamName, agentName);
  if (!fs.existsSync(p)) return [];

  return await withLock(p, async () => {
    const allMsgs: InboxMessage[] = JSON.parse(fs.readFileSync(p, "utf-8"));
    let result = allMsgs;

    if (unreadOnly) {
      result = allMsgs.filter(m => !m.read);
    }

    if (markAsRead && result.length > 0) {
      for (const m of allMsgs) {
        if (result.includes(m)) {
          m.read = true;
        }
      }
      fs.writeFileSync(p, JSON.stringify(allMsgs, null, 2));
    }

    return result;
  });
}

export async function sendPlainMessage(
  teamName: string,
  fromName: string,
  toName: string,
  text: string,
  summary: string,
  color?: string
) {
  const msg: InboxMessage = {
    from: fromName,
    text,
    timestamp: nowIso(),
    read: false,
    summary,
    color,
  };
  await appendMessage(teamName, toName, msg);
}

/**
 * Broadcasts a message to all team members except the sender.
 * @param teamName The name of the team
 * @param fromName The name of the sender
 * @param text The message text
 * @param summary A short summary of the message
 * @param color An optional color for the message
 */
export async function broadcastMessage(
  teamName: string,
  fromName: string,
  text: string,
  summary: string,
  color?: string
) {
  const config = await readConfig(teamName);

  // Create an array of delivery promises for all members except the sender
  const deliveryPromises = config.members
    .filter((member) => member.name !== fromName)
    .map((member) => sendPlainMessage(teamName, fromName, member.name, text, summary, color));

  // Execute deliveries in parallel and wait for all to settle
  const results = await Promise.allSettled(deliveryPromises);

  // Log failures for diagnostics
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failures.length > 0) {
    console.error(`Broadcast partially failed: ${failures.length} messages could not be delivered.`);
    // Optionally log individual errors
    failures.forEach((f) => console.error(`- Delivery error:`, f.reason));
  }
}
