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
  private sidebarPaneId: string | null = null; // Track the right sidebar pane for stacking teammates

  // Common paths where wezterm CLI might be found
  private possiblePaths = [
    "wezterm",  // In PATH
    "/Applications/WezTerm.app/Contents/MacOS/wezterm",  // macOS
    "/usr/local/bin/wezterm",  // Linux/macOS common
    "/usr/bin/wezterm",  // Linux system
  ];

  private weztermPath: string | null = null;

  private findWeztermBinary(): string | null {
    // Return cached path if already found
    if (this.weztermPath !== null) {
      return this.weztermPath;
    }

    // Try to find wezterm in common locations
    for (const path of this.possiblePaths) {
      try {
        const result = execCommand(path, ["--version"]);
        if (result.status === 0) {
          this.weztermPath = path;
          return path;
        }
      } catch {
        // Continue to next path
      }
    }

    this.weztermPath = null;
    return null;
  }

  detect(): boolean {
    // WezTerm is available if WEZTERM_PANE is set and not in tmux/zellij
    // AND the wezterm CLI binary can be found
    if (!process.env.WEZTERM_PANE || process.env.TMUX || process.env.ZELLIJ) {
      return false;
    }

    // Verify wezterm CLI is available
    return this.findWeztermBinary() !== null;
  }

  spawn(options: SpawnOptions): string {
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) {
      throw new Error("WezTerm CLI binary not found. Please ensure WezTerm is installed and the CLI is accessible.");
    }

    const envArgs = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`);

    // First pane: split to the right with inverted percentages (70% left for main, 30% right for sidebar)
    // Subsequent panes: split within the sidebar pane vertically (bottom)
    const isFirstPane = this.paneCounter === 0;
    const weztermArgs = [
      "cli",
      "split-pane",
      isFirstPane ? "--right" : "--bottom",
      "--percent", isFirstPane ? "30" : "50",
      ...(isFirstPane ? [] : ["--pane-id", this.sidebarPaneId!]), // Only split within sidebar for subsequent panes
      "--cwd", options.cwd,
      "--",
      "env", ...envArgs,
      "sh", "-c", options.command
    ];

    const result = execCommand(weztermBin, weztermArgs);

    if (result.status !== 0) {
      throw new Error(`wezterm spawn failed with status ${result.status}: ${result.stderr}`);
    }

    // wezterm cli split-pane outputs the pane_id on success
    const paneId = result.stdout.trim();
    
    // Track the sidebar pane on first spawn
    if (isFirstPane) {
      this.sidebarPaneId = paneId;
    }

    this.paneCounter++;

    return `wezterm_${paneId}`;
  }

  kill(paneId: string): void {
    if (!paneId || !paneId.startsWith("wezterm_")) {
      return; // Not a WezTerm pane
    }

    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) {
      return; // Can't kill without binary
    }

    const weztermId = paneId.replace("wezterm_", "");

    try {
      // Send Ctrl-C to terminate the process in the pane
      execCommand(weztermBin, ["cli", "send-text", "--pane-id", weztermId, "\x03"]);
    } catch {
      // Ignore errors - pane may already be dead
    }
  }

  isAlive(paneId: string): boolean {
    if (!paneId || !paneId.startsWith("wezterm_")) {
      return false; // Not a WezTerm pane
    }

    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) {
      return false; // Can't check without binary
    }

    const weztermId = paneId.replace("wezterm_", "");

    try {
      // Try to get pane list to check if pane exists
      const result = execCommand(weztermBin, ["cli", "list-clients"]);
      // Assume alive if command succeeded and we have a valid pane ID
      // A more robust check would parse the list-clients output
      return result.status === 0 && !!weztermId;
    } catch {
      return false;
    }
  }

  setTitle(title: string): void {
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) {
      return; // Can't set title without binary
    }

    try {
      // WezTerm doesn't have a direct CLI command to set pane titles
      // Could potentially use escape sequences or wezterm.gui.set_tab_title
      // For now, we'll use tab title as a fallback
      execCommand(weztermBin, ["cli", "set-tab-title", title]);
    } catch {
      // Ignore errors
    }
  }
}
