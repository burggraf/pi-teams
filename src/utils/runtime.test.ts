import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { writeRuntimeStatus, readRuntimeStatus } from "./runtime";
import { runtimeStatusPath, teamDir } from "./paths";

describe("runtime status", () => {
  const teamName = `runtime-test-${Date.now()}`;
  const agentName = "worker-1";

  beforeEach(() => {
    const dir = teamDir(teamName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    const dir = teamDir(teamName);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes and reads status", async () => {
    await writeRuntimeStatus(teamName, agentName, {
      pid: 123,
      startedAt: 1000,
      ready: false,
    });

    const runtime = await readRuntimeStatus(teamName, agentName);
    expect(runtime).not.toBeNull();
    expect(runtime?.teamName).toBe(teamName);
    expect(runtime?.agentName).toBe(agentName);
    expect(runtime?.pid).toBe(123);
    expect(runtime?.ready).toBe(false);
  });

  it("merges updates instead of overwriting status", async () => {
    await writeRuntimeStatus(teamName, agentName, {
      pid: 123,
      startedAt: 1000,
      ready: false,
    });

    await writeRuntimeStatus(teamName, agentName, {
      lastHeartbeatAt: 2000,
      ready: true,
    });

    const runtime = await readRuntimeStatus(teamName, agentName);
    expect(runtime?.pid).toBe(123);
    expect(runtime?.startedAt).toBe(1000);
    expect(runtime?.lastHeartbeatAt).toBe(2000);
    expect(runtime?.ready).toBe(true);
  });

  it("returns null when status does not exist", async () => {
    const missing = await readRuntimeStatus(teamName, "missing-agent");
    expect(missing).toBeNull();
  });

  it("stores status in team runtime directory", async () => {
    await writeRuntimeStatus(teamName, agentName, { ready: true });
    const p = runtimeStatusPath(teamName, agentName);
    expect(path.basename(path.dirname(p))).toBe("runtime");
    expect(fs.existsSync(p)).toBe(true);
  });
});
