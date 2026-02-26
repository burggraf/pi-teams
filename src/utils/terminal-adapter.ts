/**
 * Terminal Adapter Interface
 * 
 * Abstracts terminal multiplexer operations (tmux, iTerm2, Zellij)
 * to provide a unified API for spawning, managing, and terminating panes.
 */

import { spawnSync } from "node:child_process";

/**
 * Options for spawning a new terminal pane or window
 */
export interface SpawnOptions {
  /** Name/identifier for the pane/window */
  name: string;
  /** Working directory for the new pane/window */
  cwd: string;
  /** Command to execute in the pane/window */
  command: string;
  /** Environment variables to set (key-value pairs) */
  env: Record<string, string>;
  /** Team name for window title formatting (e.g., "team: agent") */
  teamName?: string;
}

/**
 * Terminal Adapter Interface
 * 
 * Implementations provide terminal-specific logic for pane management.
 */
export interface TerminalAdapter {
  /** Unique name identifier for this terminal type */
  readonly name: string;

  /**
   * Detect if this terminal is currently available/active.
   * Should check for terminal-specific environment variables or processes.
   * 
   * @returns true if this terminal should be used
   */
  detect(): boolean;

  /**
   * Spawn a new terminal pane with the given options.
   * 
   * @param options - Spawn configuration
   * @returns Pane ID that can be used for subsequent operations
   * @throws Error if spawn fails
   */
  spawn(options: SpawnOptions): string;

  /**
   * Kill/terminate a terminal pane.
   * Should be idempotent - no error if pane doesn't exist.
   * 
   * @param paneId - The pane ID returned from spawn()
   */
  kill(paneId: string): void;

  /**
   * Check if a terminal pane is still alive/active.
   * 
   * @param paneId - The pane ID returned from spawn()
   * @returns true if pane exists and is active
   */
  isAlive(paneId: string): boolean;

  /**
   * Set the title of the current terminal pane/window.
   * Used for identifying panes in the terminal UI.
   * 
   * @param title - The title to set
   */
  setTitle(title: string): void;

  /**
   * Check if this terminal supports spawning separate OS windows.
   * Terminals like tmux and Zellij only support panes/tabs within a session.
   * 
   * @returns true if spawnWindow() is supported
   */
  supportsWindows(): boolean;

  /**
   * Spawn a new separate OS window with the given options.
   * Only available if supportsWindows() returns true.
   * 
   * @param options - Spawn configuration
   * @returns Window ID that can be used for subsequent operations
   * @throws Error if spawn fails or not supported
   */
  spawnWindow(options: SpawnOptions): string;

  /**
   * Set the title of a specific window.
   * Used for identifying windows in the OS window manager.
   * 
   * @param windowId - The window ID returned from spawnWindow()
   * @param title - The title to set
   */
  setWindowTitle(windowId: string, title: string): void;

  /**
   * Kill/terminate a window.
   * Should be idempotent - no error if window doesn't exist.
   * 
   * @param windowId - The window ID returned from spawnWindow()
   */
  killWindow(windowId: string): void;

  /**
   * Check if a window is still alive/active.
   * 
   * @param windowId - The window ID returned from spawnWindow()
   * @returns true if window exists and is active
   */
  isWindowAlive(windowId: string): boolean;
}

/**
 * Base helper for adapters to execute commands synchronously.
 */
export function execCommand(command: string, args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(command, args, { encoding: "utf-8" });
  return {
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
    status: result.status,
  };
}
