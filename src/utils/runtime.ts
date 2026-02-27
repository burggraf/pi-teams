import fs from "node:fs";
import path from "node:path";
import { withLock } from "./lock";
import { runtimeStatusPath } from "./paths";

export interface AgentRuntimeStatus {
  teamName: string;
  agentName: string;
  pid?: number;
  startedAt?: number;
  lastHeartbeatAt?: number;
  lastInboxReadAt?: number;
  ready?: boolean;
  lastError?: string;
}

export async function writeRuntimeStatus(
  teamName: string,
  agentName: string,
  updates: Partial<AgentRuntimeStatus>
): Promise<AgentRuntimeStatus> {
  const p = runtimeStatusPath(teamName, agentName);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return await withLock(p, async () => {
    let current: AgentRuntimeStatus = {
      teamName,
      agentName,
    };

    if (fs.existsSync(p)) {
      current = JSON.parse(fs.readFileSync(p, "utf-8")) as AgentRuntimeStatus;
    }

    const next: AgentRuntimeStatus = {
      ...current,
      ...updates,
      teamName,
      agentName,
    };

    fs.writeFileSync(p, JSON.stringify(next, null, 2));
    return next;
  });
}

export async function readRuntimeStatus(
  teamName: string,
  agentName: string
): Promise<AgentRuntimeStatus | null> {
  const p = runtimeStatusPath(teamName, agentName);
  if (!fs.existsSync(p)) return null;

  return await withLock(p, async () => {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8")) as AgentRuntimeStatus;
  });
}
