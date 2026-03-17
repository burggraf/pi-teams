import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  writeRuntimeStatus,
  readRuntimeStatus,
  deleteRuntimeStatus,
  cleanupStaleRuntimeFiles,
  createRuntimeError,
  HEARTBEAT_STALE_MS,
  STARTUP_STALL_MS,
  RUNTIME_STALE_MS,
} from "./runtime";
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

  describe("deleteRuntimeStatus", () => {
    it("deletes existing runtime status", async () => {
      await writeRuntimeStatus(teamName, agentName, { ready: true });
      const deleted = await deleteRuntimeStatus(teamName, agentName);
      expect(deleted).toBe(true);

      const runtime = await readRuntimeStatus(teamName, agentName);
      expect(runtime).toBeNull();
    });

    it("returns false when status does not exist", async () => {
      const deleted = await deleteRuntimeStatus(teamName, "nonexistent");
      expect(deleted).toBe(false);
    });
  });

  describe("cleanupStaleRuntimeFiles", () => {
    it("removes stale runtime files with old heartbeats", async () => {
      const staleTime = Date.now() - RUNTIME_STALE_MS - 1000;
      await writeRuntimeStatus(teamName, "stale-agent", {
        startedAt: staleTime,
        lastHeartbeatAt: staleTime,
        ready: true,
      });

      const cleaned = await cleanupStaleRuntimeFiles(teamName);
      expect(cleaned).toBe(1);

      const runtime = await readRuntimeStatus(teamName, "stale-agent");
      expect(runtime).toBeNull();
    });

    it("preserves runtime files with recent heartbeats", async () => {
      await writeRuntimeStatus(teamName, agentName, {
        startedAt: Date.now() - RUNTIME_STALE_MS - 1000,
        lastHeartbeatAt: Date.now(),
        ready: true,
      });

      const cleaned = await cleanupStaleRuntimeFiles(teamName);
      expect(cleaned).toBe(0);

      const runtime = await readRuntimeStatus(teamName, agentName);
      expect(runtime).not.toBeNull();
    });

    it("removes corrupted files", async () => {
      const runtimeDir = path.join(teamDir(teamName), "runtime");
      if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
      fs.writeFileSync(path.join(runtimeDir, "corrupted.json"), "not valid json");

      const cleaned = await cleanupStaleRuntimeFiles(teamName);
      expect(cleaned).toBe(1);
    });

    it("returns 0 when no runtime directory exists", async () => {
      const cleaned = await cleanupStaleRuntimeFiles("nonexistent-team");
      expect(cleaned).toBe(0);
    });
  });

  describe("createRuntimeError", () => {
    it("creates structured error from Error object", () => {
      const error = new Error("Test error");
      const runtimeError = createRuntimeError(error);
      expect(runtimeError.message).toBe("Test error");
      expect(runtimeError.timestamp).toBeGreaterThan(0);
    });

    it("creates structured error from string", () => {
      const runtimeError = createRuntimeError("String error");
      expect(runtimeError.message).toBe("String error");
      expect(runtimeError.timestamp).toBeGreaterThan(0);
    });

    it("creates structured error from unknown type", () => {
      const runtimeError = createRuntimeError({ weird: "object" });
      expect(runtimeError.message).toBe("[object Object]");
      expect(runtimeError.timestamp).toBeGreaterThan(0);
    });
  });

  describe("constants", () => {
    it("exports HEARTBEAT_STALE_MS with correct value", () => {
      expect(HEARTBEAT_STALE_MS).toBe(90000);
    });

    it("exports STARTUP_STALL_MS with correct value", () => {
      expect(STARTUP_STALL_MS).toBe(60000);
    });

    it("exports RUNTIME_STALE_MS with correct value", () => {
      expect(RUNTIME_STALE_MS).toBe(300000);
    });
  });
});