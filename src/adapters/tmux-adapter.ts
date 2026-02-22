/**
 * Tmux Terminal Adapter
 * 
 * Implements the TerminalAdapter interface for tmux terminal multiplexer.
 */

import { execSync } from "node:child_process";
import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";

export class TmuxAdapter implements TerminalAdapter {
  readonly name = "tmux";

  detect(): boolean {
    // tmux is available if TMUX environment variable is set
    return !!process.env.TMUX;
  }

  spawn(options: SpawnOptions): string {
    const envArgs = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`);

    const tmuxArgs = [
      "split-window",
      "-h", "-dP",
      "-F", "#{pane_id}",
      "-c", options.cwd,
      "env", ...envArgs,
      "sh", "-c", options.command
    ];

    const result = execCommand("tmux", tmuxArgs);
    
    if (result.status !== 0) {
      throw new Error(`tmux spawn failed with status ${result.status}: ${result.stderr}`);
    }

    // Apply layout after spawning
    execCommand("tmux", ["set-window-option", "main-pane-width", "60%"]);
    execCommand("tmux", ["select-layout", "main-vertical"]);

    return result.stdout.trim();
  }

  kill(paneId: string): void {
    if (!paneId || paneId.startsWith("iterm_") || paneId.startsWith("zellij_")) {
      return; // Not a tmux pane
    }
    
    try {
      execCommand("tmux", ["kill-pane", "-t", paneId.trim()]);
    } catch {
      // Ignore errors - pane may already be dead
    }
  }

  isAlive(paneId: string): boolean {
    if (!paneId || paneId.startsWith("iterm_") || paneId.startsWith("zellij_")) {
      return false; // Not a tmux pane
    }

    try {
      execSync(`tmux has-session -t ${paneId}`);
      return true;
    } catch {
      return false;
    }
  }

  setTitle(title: string): void {
    try {
      execCommand("tmux", ["select-pane", "-T", title]);
    } catch {
      // Ignore errors
    }
  }
}
