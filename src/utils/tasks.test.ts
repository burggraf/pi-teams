import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createTask, updateTask, readTask, listTasks } from "./tasks";
import * as paths from "./paths";
import * as teams from "./teams";

// Mock the paths to use a temporary directory
const testDir = path.join(os.tmpdir(), "pi-teams-test-" + Date.now());

describe("Tasks Utilities", () => {
  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    
    // Override paths to use testDir
    vi.spyOn(paths, "taskDir").mockReturnValue(testDir);
    vi.spyOn(paths, "configPath").mockReturnValue(path.join(testDir, "config.json"));
    
    // Create a dummy team config
    fs.writeFileSync(path.join(testDir, "config.json"), JSON.stringify({ name: "test-team" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it("should create a task successfully", async () => {
    const task = await createTask("test-team", "Test Subject", "Test Description");
    expect(task.id).toBe("1");
    expect(task.subject).toBe("Test Subject");
    expect(fs.existsSync(path.join(testDir, "1.json"))).toBe(true);
  });

  it("should update a task successfully", async () => {
    await createTask("test-team", "Test Subject", "Test Description");
    const updated = await updateTask("test-team", "1", { status: "in_progress" });
    expect(updated.status).toBe("in_progress");
    
    const taskData = JSON.parse(fs.readFileSync(path.join(testDir, "1.json"), "utf-8"));
    expect(taskData.status).toBe("in_progress");
  });

  it("should list tasks", async () => {
    await createTask("test-team", "Task 1", "Desc 1");
    await createTask("test-team", "Task 2", "Desc 2");
    const tasksList = await listTasks("test-team");
    expect(tasksList.length).toBe(2);
    expect(tasksList[0].id).toBe("1");
    expect(tasksList[1].id).toBe("2");
  });

  it("should have consistent lock paths (Fixed BUG 2)", async () => {
    // This test verifies that both updateTask and readTask now use the same lock path
    // Both should now lock `${taskId}.json.lock`
    
    await createTask("test-team", "Bug Test", "Testing lock consistency");
    const taskId = "1";
    
    const taskFile = path.join(testDir, `${taskId}.json`);
    const commonLockFile = `${taskFile}.lock`;
    
    // 1. Holding the common lock
    fs.writeFileSync(commonLockFile, "9999");
    
    // 2. Try updateTask, it should fail
    // Using small retries to speed up the test and avoid fake timer issues with native setTimeout
    await expect(updateTask("test-team", taskId, { status: "in_progress" }, 2)).rejects.toThrow("Could not acquire lock");

    // 3. Try readTask, it should fail too
    await expect(readTask("test-team", taskId, 2)).rejects.toThrow("Could not acquire lock");
    
    fs.unlinkSync(commonLockFile);
  });
});
