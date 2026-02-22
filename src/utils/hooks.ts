import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Runs a hook script asynchronously if it exists.
 * Hooks are located in .pi/hooks/{hookName}.sh relative to the CWD.
 *
 * @param teamName The name of the team.
 * @param hookName The name of the hook to run (e.g., 'task_completed').
 * @param payload The payload to pass to the hook script as the first argument.
 * @returns true if the hook doesn't exist or executes successfully; false otherwise.
 */
export async function runHook(teamName: string, hookName: string, payload: any): Promise<boolean> {
  const hookPath = path.join(process.cwd(), ".pi", "hooks", `${hookName}.sh`);

  if (!fs.existsSync(hookPath)) {
    return true;
  }

  try {
    const payloadStr = JSON.stringify(payload);
    // Use execFile: More secure (no shell interpolation) and asynchronous
    await execFileAsync(hookPath, [payloadStr], {
      env: { ...process.env, PI_TEAM: teamName },
    });
    return true;
  } catch (error) {
    console.error(`Hook ${hookName} failed:`, error);
    return false;
  }
}
