import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { withLock } from "./lock";

describe("withLock", () => {
  const testDir = path.join(os.tmpdir(), "pi-lock-test-" + Date.now());
  const lockPath = path.join(testDir, "test");
  const lockFile = `${lockPath}.lock`;

  beforeEach(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it("should successfully acquire and release the lock", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const result = await withLock(lockPath, fn);

    expect(result).toBe("result");
    expect(fn).toHaveBeenCalled();
    expect(fs.existsSync(lockFile)).toBe(false);
  });

  it("should fail to acquire lock if already held", async () => {
    // Manually create lock file
    fs.writeFileSync(lockFile, "9999");

    const fn = vi.fn().mockResolvedValue("result");
    
    // Test with only 2 retries to speed up the failure
    await expect(withLock(lockPath, fn, 2)).rejects.toThrow("Could not acquire lock");
    expect(fn).not.toHaveBeenCalled();
  });

  it("should release lock even if function fails", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("failure"));

    await expect(withLock(lockPath, fn)).rejects.toThrow("failure");
    expect(fs.existsSync(lockFile)).toBe(false);
  });
});
