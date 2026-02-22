import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { withLock } from "./lock";

describe("withLock race conditions", () => {
  const testDir = path.join(os.tmpdir(), "pi-lock-race-test-" + Date.now());
  const lockPath = path.join(testDir, "test");

  it("should handle race conditions during lock acquisition", async () => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

    const results: string[] = [];
    const p1 = withLock(lockPath, async () => {
      results.push("p1-start");
      await new Promise(resolve => setTimeout(resolve, 500));
      results.push("p1-end");
      return "p1";
    });

    const p2 = withLock(lockPath, async () => {
      results.push("p2-start");
      await new Promise(resolve => setTimeout(resolve, 100));
      results.push("p2-end");
      return "p2";
    });

    await Promise.all([p1, p2]);

    // Check that sections do not overlap
    expect(results).toEqual(["p1-start", "p1-end", "p2-start", "p2-end"]);

    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });
});
