/**
 * iTerm2 Terminal Adapter
 *
 * Implements the TerminalAdapter interface for iTerm2 terminal emulator.
 * Uses AppleScript for all operations.
 */

import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";
import { spawnSync } from "node:child_process";

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
