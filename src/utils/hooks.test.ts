import fs from "node:fs";
import path from "node:path";
import { runHook } from "./hooks";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

describe("runHook", () => {
  const hooksDir = path.join(process.cwd(), ".pi", "team-hooks");

  beforeAll(() => {
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Optional: Clean up created scripts
    const files = ["success_hook.sh", "fail_hook.sh"];
    files.forEach(f => {
      const p = path.join(hooksDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  });

  it("should return true if hook script does not exist", async () => {
    const result = await runHook("test_team", "non_existent_hook", { data: "test" });
    expect(result).toBe(true);
  });

  it("should return true if hook script succeeds", async () => {
    const hookName = "success_hook";
    const scriptPath = path.join(hooksDir, `${hookName}.sh`);
    
    // Create a simple script that exits with 0
    fs.writeFileSync(scriptPath, "#!/bin/bash\nexit 0", { mode: 0o755 });

    const result = await runHook("test_team", hookName, { data: "test" });
    expect(result).toBe(true);
  });

  it("should return false if hook script fails", async () => {
    const hookName = "fail_hook";
    const scriptPath = path.join(hooksDir, `${hookName}.sh`);
    
    // Create a simple script that exits with 1
    fs.writeFileSync(scriptPath, "#!/bin/bash\nexit 1", { mode: 0o755 });

    // Mock console.error to avoid noise in test output
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runHook("test_team", hookName, { data: "test" });
    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });

  it("should pass the payload to the hook script", async () => {
    const hookName = "payload_hook";
    const scriptPath = path.join(hooksDir, `${hookName}.sh`);
    const outputFile = path.join(hooksDir, "payload_output.txt");

    // Create a script that writes its first argument to a file
    fs.writeFileSync(scriptPath, `#!/bin/bash\necho "$1" > "${outputFile}"`, { mode: 0o755 });

    const payload = { key: "value", "special'char": true };
    const result = await runHook("test_team", hookName, payload);

    expect(result).toBe(true);
    const output = fs.readFileSync(outputFile, "utf-8").trim();
    expect(JSON.parse(output)).toEqual(payload);

    // Clean up
    fs.unlinkSync(scriptPath);
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
  });
});
