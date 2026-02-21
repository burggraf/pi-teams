import fs from "node:fs";
import path from "node:path";
import { InboxMessage } from "./models";
import { withLock } from "./lock";
import { inboxPath } from "./paths";

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
