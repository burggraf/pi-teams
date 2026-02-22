import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createTask, listTasks } from "./tasks";
import * as paths from "./paths";

const testDir = path.join(os.tmpdir(), "pi-tasks-race-test-" + Date.now());

describe("Tasks Race Condition Bug", () => {
  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    
    vi.spyOn(paths, "taskDir").mockReturnValue(testDir);
    vi.spyOn(paths, "configPath").mockReturnValue(path.join(testDir, "config.json"));
    fs.writeFileSync(path.join(testDir, "config.json"), JSON.stringify({ name: "test-team" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it("should potentially fail to create unique IDs under high concurrency (Demonstrating Bug 1)", async () => {
    const numTasks = 20;
    const promises = [];
    
    for (let i = 0; i < numTasks; i++) {
      promises.push(createTask("test-team", `Task ${i}`, `Desc ${i}`));
    }
    
    const results = await Promise.all(promises);
    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    
    // If Bug 1 exists (getTaskId outside the lock but actually it is inside the lock in createTask),
    // this test might still pass because createTask locks the directory.
    // WAIT: I noticed createTask uses withLock(lockPath, ...) where lockPath = dir.
    // Let's re-verify createTask in src/utils/tasks.ts
    
    expect(uniqueIds.size).toBe(numTasks);
  });
});
