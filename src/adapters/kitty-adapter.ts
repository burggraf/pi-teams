/**
 * Kitty Terminal Adapter
 *
 * Implements the TerminalAdapter interface for Kitty terminal emulator.
 * Uses kitty @ launch for pane management.
 */

import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";

/**
 * Context needed for Kitty spawning (tracks layout state)
 */
export interface KittySpawnContext {
  /** ID of the last spawned window, used for layout decisions */
  lastWindowId?: string;
}

export class KittyAdapter implements TerminalAdapter {
  readonly name = "Kitty";
  private spawnContext: KittySpawnContext = {};

  detect(): boolean {
    // Kitty is available if KITTY_WINDOW_ID is set and not in tmux/zellij
    return !!process.env.KITTY_WINDOW_ID && !process.env.TMUX && !process.env.ZELLIJ;
  }

  spawn(options: SpawnOptions): string {
    const envArgs = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`);

    // First window splits vertically (side-by-side with main pane)
    // Subsequent windows split horizontally (stacking on right side)
    const isFirstWindow = !this.spawnContext.lastWindowId;
    const location = isFirstWindow ? "vsplit" : "hsplit";

    const kittyArgs = [
      "@",
      "launch",
      "--location", location,
      "--cwd", options.cwd,
      "--title", options.name,
      "--",
      "env", ...envArgs,
      "sh", "-c", options.command
    ];

    const result = execCommand("kitty", kittyArgs);

    if (result.status !== 0) {
      throw new Error(`kitty spawn failed with status ${result.status}: ${result.stderr}`);
    }

    // kitty @ launch returns window id on success
    const windowId = result.stdout.trim();
    this.spawnContext.lastWindowId = windowId;

    return `kitty_${windowId}`;
  }

  kill(paneId: string): void {
    if (!paneId || !paneId.startsWith("kitty_")) {
      return; // Not a Kitty pane
    }

    const kittyId = paneId.replace("kitty_", "");

    try {
      // Close the window
      execCommand("kitty", ["@", "close-window", "--match", `id:${kittyId}`]);
    } catch {
      // Ignore errors - window may already be closed
    }
  }

  isAlive(paneId: string): boolean {
    if (!paneId || !paneId.startsWith("kitty_")) {
      return false; // Not a Kitty pane
    }

    const kittyId = paneId.replace("kitty_", "");

    try {
      // Check if window exists by listing windows
      const result = execCommand("kitty", ["@", "ls"]);
      return result.stdout.includes(kittyId);
    } catch {
      return false;
    }
  }

  setTitle(title: string): void {
    try {
      // Set the title for the current window
      execCommand("kitty", ["@", "set-window-title", title]);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Set the spawn context (used to restore state when needed)
   */
  setSpawnContext(context: KittySpawnContext): void {
    this.spawnContext = context;
  }

  /**
   * Get current spawn context (useful for persisting state)
   */
  getSpawnContext(): KittySpawnContext {
    return { ...this.spawnContext };
  }
}
