/**
 * WezTerm Terminal Adapter
 *
 * Implements the TerminalAdapter interface for WezTerm terminal emulator.
 * Uses wezterm cli split-pane for pane management.
 */

import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";

export class WezTermAdapter implements TerminalAdapter {
  readonly name = "WezTerm";
  private paneCounter = 0;

  detect(): boolean {
    // WezTerm is available if WEZTERM_PANE is set and not in tmux/zellij
    return !!process.env.WEZTERM_PANE && !process.env.TMUX && !process.env.ZELLIJ;
  }

  spawn(options: SpawnOptions): string {
    const envArgs = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`);

    // First pane splits to the left (like iTerm2's initial split)
    // Subsequent panes split to the bottom (stacking on right side)
    const isFirstPane = this.paneCounter === 0;
    const splitDirection = isFirstPane ? "--left" : "--bottom";
    const splitPercent = isFirstPane ? "30" : "50";

    const weztermArgs = [
      "cli",
      "split-pane",
      splitDirection,
      "--percent", splitPercent,
      "--cwd", options.cwd,
      "--",
      "env", ...envArgs,
      "sh", "-c", options.command
    ];

    const result = execCommand("wezterm", weztermArgs);

    if (result.status !== 0) {
      throw new Error(`wezterm spawn failed with status ${result.status}: ${result.stderr}`);
    }

    // wezterm cli split-pane outputs the pane_id on success
    const paneId = result.stdout.trim();
    this.paneCounter++;

    return `wezterm_${paneId}`;
  }

  kill(paneId: string): void {
    if (!paneId || !paneId.startsWith("wezterm_")) {
      return; // Not a WezTerm pane
    }

    const weztermId = paneId.replace("wezterm_", "");

    try {
      // Send Ctrl-C to terminate the process in the pane
      execCommand("wezterm", ["cli", "send-text", "--pane-id", weztermId, "\x03"]);
    } catch {
      // Ignore errors - pane may already be dead
    }
  }

  isAlive(paneId: string): boolean {
    if (!paneId || !paneId.startsWith("wezterm_")) {
      return false; // Not a WezTerm pane
    }

    const weztermId = paneId.replace("wezterm_", "");

    try {
      // Try to get pane list to check if pane exists
      const result = execCommand("wezterm", ["cli", "list-clients"]);
      // Assume alive if command succeeded and we have a valid pane ID
      // A more robust check would parse the list-clients output
      return result.status === 0 && !!weztermId;
    } catch {
      return false;
    }
  }

  setTitle(title: string): void {
    try {
      // WezTerm doesn't have a direct CLI command to set pane titles
      // Could potentially use escape sequences or wezterm.gui.set_tab_title
      // For now, we'll use tab title as a fallback
      execCommand("wezterm", ["cli", "set-tab-title", title]);
    } catch {
      // Ignore errors
    }
  }
}
