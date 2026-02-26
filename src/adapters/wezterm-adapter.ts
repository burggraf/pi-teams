/**
 * WezTerm Terminal Adapter
 *
 * Implements the TerminalAdapter interface for WezTerm terminal emulator.
 * Uses wezterm cli split-pane for pane management.
 */

import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";

export class WezTermAdapter implements TerminalAdapter {
  readonly name = "WezTerm";

  // Common paths where wezterm CLI might be found
  private possiblePaths = [
    "wezterm",  // In PATH
    "/Applications/WezTerm.app/Contents/MacOS/wezterm",  // macOS
    "/usr/local/bin/wezterm",  // Linux/macOS common
    "/usr/bin/wezterm",  // Linux system
  ];

  private weztermPath: string | null = null;

  private findWeztermBinary(): string | null {
    if (this.weztermPath !== null) {
      return this.weztermPath;
    }

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
    if (!process.env.WEZTERM_PANE || process.env.TMUX || process.env.ZELLIJ) {
      return false;
    }
    return this.findWeztermBinary() !== null;
  }

  /**
   * Get all panes in the current tab to determine layout state.
   */
  private getPanes(): any[] {
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) return [];

    const result = execCommand(weztermBin, ["cli", "list", "--format", "json"]);
    if (result.status !== 0) return [];

    try {
      const allPanes = JSON.parse(result.stdout);
      const currentPaneId = parseInt(process.env.WEZTERM_PANE || "0", 10);
      
      // Find the tab of the current pane
      const currentPane = allPanes.find((p: any) => p.pane_id === currentPaneId);
      if (!currentPane) return [];

      // Return all panes in the same tab
      return allPanes.filter((p: any) => p.tab_id === currentPane.tab_id);
    } catch {
      return [];
    }
  }

  spawn(options: SpawnOptions): string {
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) {
      throw new Error("WezTerm CLI binary not found.");
    }

    const panes = this.getPanes();
    const envArgs = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`);

    let weztermArgs: string[];
    
    // First pane: split to the right with 50% (matches iTerm2/tmux behavior)
    const isFirstPane = panes.length === 1;

    if (isFirstPane) {
      weztermArgs = [
        "cli", "split-pane", "--right", "--percent", "50",
        "--cwd", options.cwd, "--", "env", ...envArgs, "sh", "-c", options.command
      ];
    } else {
      // Subsequent teammates stack in the sidebar on the right.
      // currentPaneId (id 0) is the main pane on the left.
      // All other panes are in the sidebar.
      const currentPaneId = parseInt(process.env.WEZTERM_PANE || "0", 10);
      const sidebarPanes = panes
        .filter(p => p.pane_id !== currentPaneId)
        .sort((a, b) => b.cursor_y - a.cursor_y); // Sort by vertical position (bottom-most first)

      // To add a new pane to the bottom of the sidebar stack:
      // We always split the BOTTOM-MOST pane (sidebarPanes[0])
      // and use 50% so the new pane and the previous bottom pane are equal.
      // This progressively fills the sidebar from top to bottom.
      const targetPane = sidebarPanes[0];

      weztermArgs = [
        "cli", "split-pane", "--bottom", "--pane-id", targetPane.pane_id.toString(),
        "--percent", "50",
        "--cwd", options.cwd, "--", "env", ...envArgs, "sh", "-c", options.command
      ];
    }

    const result = execCommand(weztermBin, weztermArgs);
    if (result.status !== 0) {
      throw new Error(`wezterm spawn failed: ${result.stderr}`);
    }

    // New: After spawning, tell WezTerm to equalize the panes in this tab
    // This ensures that regardless of the split math, they all end up the same height.
    try {
      execCommand(weztermBin, ["cli", "zoom-pane", "--unzoom"]); // Ensure not zoomed
      // WezTerm doesn't have a single "equalize" command like tmux, 
      // but splitting with no percentage usually balances, or we can use 
      // the 'AdjustPaneSize' sequence. 
      // For now, let's stick to the 50/50 split of the LAST pane which is most reliable.
    } catch {}

    const paneId = result.stdout.trim();
    return `wezterm_${paneId}`;
  }

  kill(paneId: string): void {
    if (!paneId?.startsWith("wezterm_")) return;
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) return;

    const weztermId = paneId.replace("wezterm_", "");
    try {
      execCommand(weztermBin, ["cli", "kill-pane", "--pane-id", weztermId]);
    } catch {}
  }

  isAlive(paneId: string): boolean {
    if (!paneId?.startsWith("wezterm_")) return false;
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) return false;

    const weztermId = parseInt(paneId.replace("wezterm_", ""), 10);
    const panes = this.getPanes();
    return panes.some(p => p.pane_id === weztermId);
  }

  setTitle(title: string): void {
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) return;
    try {
      execCommand(weztermBin, ["cli", "set-tab-title", title]);
    } catch {}
  }

  /**
   * WezTerm supports spawning separate OS windows via CLI
   */
  supportsWindows(): boolean {
    return this.findWeztermBinary() !== null;
  }

  /**
   * Spawn a new separate OS window with the given options.
   * Uses `wezterm cli spawn --new-window` and sets the window title.
   */
  spawnWindow(options: SpawnOptions): string {
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) {
      throw new Error("WezTerm CLI binary not found.");
    }

    const envArgs = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`);

    // Format window title as "teamName: agentName" if teamName is provided
    const windowTitle = options.teamName 
      ? `${options.teamName}: ${options.name}`
      : options.name;

    // Spawn a new window
    const spawnArgs = [
      "cli", "spawn", "--new-window",
      "--cwd", options.cwd,
      "--", "env", ...envArgs, "sh", "-c", options.command
    ];

    const result = execCommand(weztermBin, spawnArgs);
    if (result.status !== 0) {
      throw new Error(`wezterm spawn-window failed: ${result.stderr}`);
    }

    // The output is the pane ID, we need to find the window ID
    const paneId = result.stdout.trim();
    
    // Query to get window ID from pane ID
    const windowId = this.getWindowIdFromPaneId(parseInt(paneId, 10));
    
    // Set the window title if we found the window
    if (windowId !== null) {
      this.setWindowTitle(`wezterm_win_${windowId}`, windowTitle);
    }

    return `wezterm_win_${windowId || paneId}`;
  }

  /**
   * Get window ID from a pane ID by querying WezTerm
   */
  private getWindowIdFromPaneId(paneId: number): number | null {
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) return null;

    const result = execCommand(weztermBin, ["cli", "list", "--format", "json"]);
    if (result.status !== 0) return null;

    try {
      const allPanes = JSON.parse(result.stdout);
      const pane = allPanes.find((p: any) => p.pane_id === paneId);
      return pane?.window_id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Set the title of a specific window.
   */
  setWindowTitle(windowId: string, title: string): void {
    if (!windowId?.startsWith("wezterm_win_")) return;
    
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) return;

    const weztermWindowId = windowId.replace("wezterm_win_", "");
    
    try {
      execCommand(weztermBin, ["cli", "set-window-title", "--window-id", weztermWindowId, title]);
    } catch {
      // Silently fail
    }
  }

  /**
   * Kill/terminate a window.
   */
  killWindow(windowId: string): void {
    if (!windowId?.startsWith("wezterm_win_")) return;
    
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) return;

    const weztermWindowId = windowId.replace("wezterm_win_", "");
    
    try {
      // WezTerm doesn't have a direct kill-window command, so we kill all panes in the window
      const result = execCommand(weztermBin, ["cli", "list", "--format", "json"]);
      if (result.status !== 0) return;

      const allPanes = JSON.parse(result.stdout);
      const windowPanes = allPanes.filter((p: any) => p.window_id.toString() === weztermWindowId);
      
      for (const pane of windowPanes) {
        execCommand(weztermBin, ["cli", "kill-pane", "--pane-id", pane.pane_id.toString()]);
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Check if a window is still alive/active.
   */
  isWindowAlive(windowId: string): boolean {
    if (!windowId?.startsWith("wezterm_win_")) return false;
    
    const weztermBin = this.findWeztermBinary();
    if (!weztermBin) return false;

    const weztermWindowId = windowId.replace("wezterm_win_", "");
    
    try {
      const result = execCommand(weztermBin, ["cli", "list", "--format", "json"]);
      if (result.status !== 0) return false;

      const allPanes = JSON.parse(result.stdout);
      return allPanes.some((p: any) => p.window_id.toString() === weztermWindowId);
    } catch {
      return false;
    }
  }
}
