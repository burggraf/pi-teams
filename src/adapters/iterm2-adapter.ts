/**
 * iTerm2 Terminal Adapter
 * 
 * Implements the TerminalAdapter interface for iTerm2 terminal emulator.
 * Uses AppleScript for all operations.
 */

import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";

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
    // iTerm2 is available if TERM_PROGRAM is iTerm.app and not in tmux/zellij
    return process.env.TERM_PROGRAM === "iTerm.app" && !process.env.TMUX && !process.env.ZELLIJ;
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
      // First teammate: split current session vertically (side-by-side)
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
      // Subsequent teammate: split the last teammate's session horizontally (stacking)
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

    const result = execCommand("osascript", ["-e", script]);
    
    if (result.status !== 0) {
      throw new Error(`osascript failed with status ${result.status}: ${result.stderr}`);
    }

    const sessionId = result.stdout.toString().trim();
    this.spawnContext.lastSessionId = sessionId;
    
    return `iterm_${sessionId}`;
  }

  kill(paneId: string): void {
    if (!paneId || !paneId.startsWith("iterm_")) {
      return; // Not an iTerm2 pane
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
      execCommand("osascript", ["-e", script]);
    } catch {
      // Ignore errors - session may already be closed
    }
  }

  isAlive(paneId: string): boolean {
    if (!paneId || !paneId.startsWith("iterm_")) {
      return false; // Not an iTerm2 pane
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
      const result = execCommand("osascript", ["-e", script]);
      return result.stdout.includes("Alive");
    } catch {
      return false;
    }
  }

  setTitle(title: string): void {
    try {
      execCommand("osascript", [
        "-e",
        `tell application "iTerm2" to tell current session of current window to set name to "${title}"`
      ]);
    } catch {
      // Ignore errors
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
