/**
 * Zellij Terminal Adapter
 * 
 * Implements the TerminalAdapter interface for Zellij terminal multiplexer.
 * Note: Zellij uses --close-on-exit, so explicit kill is not needed.
 */

import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";

export class ZellijAdapter implements TerminalAdapter {
  readonly name = "zellij";

  detect(): boolean {
    // Zellij is available if ZELLIJ env is set and not in tmux
    return !!process.env.ZELLIJ && !process.env.TMUX;
  }

  spawn(options: SpawnOptions): string {
    const zellijArgs = [
      "run",
      "--name", options.name,
      "--cwd", options.cwd,
      "--close-on-exit",
      "--",
      "env",
      ...Object.entries(options.env)
        .filter(([k]) => k.startsWith("PI_"))
        .map(([k, v]) => `${k}=${v}`),
      "sh", "-c", options.command
    ];

    const result = execCommand("zellij", zellijArgs);
    
    if (result.status !== 0) {
      throw new Error(`zellij spawn failed with status ${result.status}: ${result.stderr}`);
    }

    // Zellij doesn't return a pane ID, so we create a synthetic one
    return `zellij_${options.name}`;
  }

  kill(_paneId: string): void {
    // Zellij uses --close-on-exit, so panes close automatically
    // when the process exits. No explicit kill needed.
  }

  isAlive(paneId: string): boolean {
    // Zellij doesn't have a straightforward way to check if a pane is alive
    // For now, we assume alive if it's a zellij pane ID
    if (!paneId || !paneId.startsWith("zellij_")) {
      return false;
    }
    
    // Could potentially use `zellij list-sessions` or similar in the future
    return true;
  }

  setTitle(_title: string): void {
    // Zellij pane titles are set via --name at spawn time
    // No runtime title changing supported
  }

  /**
   * Zellij does not support spawning separate OS windows
   */
  supportsWindows(): boolean {
    return false;
  }

  /**
   * Not supported - throws error
   */
  spawnWindow(_options: SpawnOptions): string {
    throw new Error("Zellij does not support spawning separate OS windows. Use iTerm2 or WezTerm instead.");
  }

  /**
   * Not supported - no-op
   */
  setWindowTitle(_windowId: string, _title: string): void {
    // Not supported
  }

  /**
   * Not supported - no-op
   */
  killWindow(_windowId: string): void {
    // Not supported
  }

  /**
   * Not supported - always returns false
   */
  isWindowAlive(_windowId: string): boolean {
    return false;
  }
}
