/**
 * iTerm2 Terminal Adapter
 *
 * Implements the TerminalAdapter interface for iTerm2 terminal emulator.
 * Uses AppleScript for all operations.
 */

import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as paths from "../utils/paths";

/**
 * Context needed for iTerm2 spawning (tracks last pane for layout)
 */
export interface Iterm2SpawnContext {
  /** ID of the last spawned session, used for layout decisions */
  lastSessionId?: string;
}

export class Iterm2Adapter implements TerminalAdapter {
  readonly name = "iTerm2";
  private spawnContext: Iterm2SpawnContext = {};
  /** Cached iTerm2 session ID for this process (looked up from team config) */
  private cachedOwnSessionId: string | null | undefined = undefined;

  detect(): boolean {
    return process.env.TERM_PROGRAM === "iTerm.app" && !process.env.TMUX && !process.env.ZELLIJ;
  }

  /**
   * Helper to execute AppleScript via stdin to avoid escaping issues with -e
   */
  private runAppleScript(script: string): { stdout: string; stderr: string; status: number | null } {
    const result = spawnSync("osascript", ["-"], {
      input: script,
      encoding: "utf-8",
    });
    return {
      stdout: result.stdout?.toString() ?? "",
      stderr: result.stderr?.toString() ?? "",
      status: result.status,
    };
  }

  spawn(options: SpawnOptions): string {
    const envStr = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");

    const itermCmd = `cd '${options.cwd}' && ${envStr} ${options.command}`;
    const escapedCmd = itermCmd.replace(/"/g, '\\"');

    let script: string;

    if (!this.spawnContext.lastSessionId) {
      script = `tell application "iTerm2"
  tell current session of current window
    set newSession to split vertically with default profile
    tell newSession
      write text "${escapedCmd}"
      return id
    end tell
  end tell
end tell`;
    } else {
      script = `tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if id of aSession is "${this.spawnContext.lastSessionId}" then
          tell aSession
            set newSession to split horizontally with default profile
            tell newSession
              write text "${escapedCmd}"
              return id
            end tell
          end tell
        end if
      end repeat
    end repeat
  end repeat
end tell`;
    }

    const result = this.runAppleScript(script);

    if (result.status !== 0) {
      throw new Error(`osascript failed with status ${result.status}: ${result.stderr}`);
    }

    const sessionId = result.stdout.toString().trim();
    this.spawnContext.lastSessionId = sessionId;

    return `iterm_${sessionId}`;
  }

  kill(paneId: string): void {
    if (!paneId || !paneId.startsWith("iterm_") || paneId.startsWith("iterm_win_")) {
      return;
    }

    const itermId = paneId.replace("iterm_", "");
    const script = `tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if id of aSession is "${itermId}" then
          close aSession
          return "Closed"
        end if
      end repeat
    end repeat
  end repeat
end tell`;

    try {
      this.runAppleScript(script);
    } catch {
      // Ignore errors
    }
  }

  isAlive(paneId: string): boolean {
    if (!paneId || !paneId.startsWith("iterm_") || paneId.startsWith("iterm_win_")) {
      return false;
    }

    const itermId = paneId.replace("iterm_", "");
    const script = `tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if id of aSession is "${itermId}" then
          return "Alive"
        end if
      end repeat
    end repeat
  end repeat
end tell`;

    try {
      const result = this.runAppleScript(script);
      return result.stdout.includes("Alive");
    } catch {
      return false;
    }
  }

  setTitle(title: string): void {
    const escapedTitle = title.replace(/"/g, '\\"');

    // For teammate processes, find the specific session to avoid renaming
    // unrelated iTerm2 tabs. The session ID is stored in the team config.
    const sessionId = this.findOwnSessionId();
    if (sessionId) {
      const script = `tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if id of aSession is "${sessionId}" then
          set name of aSession to "${escapedTitle}"
          return "Found"
        end if
      end repeat
    end repeat
  end repeat
end tell`;
      try {
        this.runAppleScript(script);
      } catch {
        // Ignore errors
      }
      return;
    }

    // If we're a teammate but haven't found our session ID yet (race condition
    // during startup), skip the rename to avoid overwriting an unrelated tab.
    if (process.env.PI_AGENT_NAME) {
      return;
    }

    // Fallback for non-teammate processes (e.g., standalone pi sessions).
    const script = `tell application "iTerm2" to tell current session of current window
      set name to "${escapedTitle}"
    end tell`;
    try {
      this.runAppleScript(script);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Look up this process's iTerm2 session ID from the team config.
   * Teammates have PI_AGENT_NAME and PI_TEAM_NAME env vars, and the
   * team config stores the iTerm2 session ID in the tmuxPaneId field.
   * Caches the result once found to avoid repeated file reads.
   */
  private findOwnSessionId(): string | null {
    // Return cached value if we've already found it
    if (this.cachedOwnSessionId != null) return this.cachedOwnSessionId;

    const agentName = process.env.PI_AGENT_NAME;
    const teamName = process.env.PI_TEAM_NAME;
    if (!agentName || !teamName) return null;

    try {
      const configFile = paths.configPath(teamName);
      const config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      const member = config.members?.find((m: any) => m.name === agentName);
      if (
        member?.tmuxPaneId &&
        member.tmuxPaneId.startsWith("iterm_") &&
        !member.tmuxPaneId.startsWith("iterm_win_")
      ) {
        this.cachedOwnSessionId = member.tmuxPaneId.replace("iterm_", "");
        return this.cachedOwnSessionId;
      }
    } catch {
      // Config not yet available — will retry on next call
    }

    // Don't cache null — the config might not be written yet (timing)
    return null;
  }

  /**
   * iTerm2 supports spawning separate OS windows via AppleScript
   */
  supportsWindows(): boolean {
    return true;
  }

  /**
   * Spawn a new separate OS window with the given options.
   */
  spawnWindow(options: SpawnOptions): string {
    const envStr = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");

    const itermCmd = `cd '${options.cwd}' && ${envStr} ${options.command}`;
    const escapedCmd = itermCmd.replace(/"/g, '\\"');

    const windowTitle = options.teamName
      ? `${options.teamName}: ${options.name}`
      : options.name;

    const escapedTitle = windowTitle.replace(/"/g, '\\"');

    const script = `tell application "iTerm2"
  set newWindow to (create window with default profile)
  tell current session of newWindow
    -- Set the session name (tab title)
    set name to "${escapedTitle}"
    -- Set window title via escape sequence (OSC 2)
    -- We use double backslashes for AppleScript to emit a single backslash to the shell
    write text "printf '\\\\033]2;${escapedTitle}\\\\007'"
    -- Execute the command
    write text "cd '${options.cwd}' && ${escapedCmd}"
    return id of newWindow
  end tell
end tell`;

    const result = this.runAppleScript(script);

    if (result.status !== 0) {
      throw new Error(`osascript failed with status ${result.status}: ${result.stderr}`);
    }

    const windowId = result.stdout.toString().trim();
    return `iterm_win_${windowId}`;
  }

  /**
   * Set the title of a specific window.
   */
  setWindowTitle(windowId: string, title: string): void {
    if (!windowId || !windowId.startsWith("iterm_win_")) {
      return;
    }

    const itermId = windowId.replace("iterm_win_", "");
    const escapedTitle = title.replace(/"/g, '\\"');

    const script = `tell application "iTerm2"
  repeat with aWindow in windows
    if id of aWindow is "${itermId}" then
      tell current session of aWindow
        write text "printf '\\\\033]2;${escapedTitle}\\\\007'"
      end tell
      exit repeat
    end if
  end repeat
end tell`;

    try {
      this.runAppleScript(script);
    } catch {
      // Silently fail
    }
  }

  /**
   * Kill/terminate a window.
   */
  killWindow(windowId: string): void {
    if (!windowId || !windowId.startsWith("iterm_win_")) {
      return;
    }

    const itermId = windowId.replace("iterm_win_", "");
    const script = `tell application "iTerm2"
  repeat with aWindow in windows
    if id of aWindow is "${itermId}" then
      close aWindow
      return "Closed"
    end if
  end repeat
end tell`;

    try {
      this.runAppleScript(script);
    } catch {
      // Silently fail
    }
  }

  /**
   * Check if a window is still alive/active.
   */
  isWindowAlive(windowId: string): boolean {
    if (!windowId || !windowId.startsWith("iterm_win_")) {
      return false;
    }

    const itermId = windowId.replace("iterm_win_", "");
    const script = `tell application "iTerm2"
  repeat with aWindow in windows
    if id of aWindow is "${itermId}" then
      return "Alive"
    end if
  end repeat
end tell`;

    try {
      const result = this.runAppleScript(script);
      return result.stdout.includes("Alive");
    } catch {
      return false;
    }
  }

  /**
   * Set the spawn context (used to restore state when needed)
   */
  setSpawnContext(context: Iterm2SpawnContext): void {
    this.spawnContext = context;
  }

  /**
   * Get current spawn context (useful for persisting state)
   */
  getSpawnContext(): Iterm2SpawnContext {
    return { ...this.spawnContext };
  }
}
