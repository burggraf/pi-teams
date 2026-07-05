/**
 * Herdr Terminal Adapter
 *
 * Implements the TerminalAdapter interface for Herdr (https://herdr.dev).
 * Herdr is a terminal workspace manager with panes, tabs, and first-class
 * coding-agent lifecycle integration.
 */

import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";

function parseJson(stdout: string): any | null {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

export class HerdrAdapter implements TerminalAdapter {
  readonly name = "herdr";

  private herdrBin(): string {
    return process.env.HERDR_BIN_PATH || "herdr";
  }

  private filteredEnv(options: SpawnOptions): Array<[string, string]> {
    // Match the existing pi-teams adapter behavior: only explicitly inject
    // pi-teams metadata. Do not pass inherited HERDR_* values from the lead
    // pane; Herdr will set authoritative HERDR_PANE_ID/TAB_ID/WORKSPACE_ID
    // values for the newly-created pane.
    return Object.entries(options.env).filter(([key]) => key.startsWith("PI_"));
  }

  private envCliArgs(options: SpawnOptions): string[] {
    return this.filteredEnv(options).flatMap(([key, value]) => ["--env", `${key}=${value}`]);
  }

  private currentPlacement(): { tabId?: string; workspaceId?: string } {
    const paneId = process.env.HERDR_PANE_ID;
    if (paneId) {
      try {
        const result = execCommand(this.herdrBin(), ["pane", "get", paneId]);
        if (result.status === 0) {
          const json = parseJson(result.stdout);
          const pane = json?.result?.pane;
          if (pane?.tab_id || pane?.workspace_id) {
            return { tabId: pane.tab_id, workspaceId: pane.workspace_id };
          }
        }
      } catch {
        // Fall through to inherited environment below.
      }
    }

    return {
      tabId: process.env.HERDR_TAB_ID,
      workspaceId: process.env.HERDR_WORKSPACE_ID,
    };
  }

  detect(): boolean {
    return (
      process.env.HERDR_ENV === "1" &&
      !!process.env.HERDR_SOCKET_PATH &&
      !!process.env.HERDR_PANE_ID
    );
  }

  spawn(options: SpawnOptions): string {
    const args = [
      "agent", "start", options.name,
      "--cwd", options.cwd,
    ];

    const placement = this.currentPlacement();
    if (placement.tabId) {
      args.push("--tab", placement.tabId);
    } else if (placement.workspaceId) {
      args.push("--workspace", placement.workspaceId);
    }

    args.push(
      "--split", "right",
      "--no-focus",
      ...this.envCliArgs(options),
      "--",
      "sh", "-c", options.command,
    );

    const result = execCommand(this.herdrBin(), args);
    if (result.status !== 0) {
      throw new Error(`herdr agent start failed with status ${result.status}: ${result.stderr || result.stdout}`);
    }

    const json = parseJson(result.stdout);
    const paneId = json?.result?.agent?.pane_id || json?.result?.pane?.pane_id || json?.result?.pane_id;
    if (!paneId) {
      throw new Error(`herdr agent start returned unexpected output: ${result.stdout.trim()}`);
    }

    return paneId;
  }

  kill(paneId: string): void {
    if (!paneId) return;

    try {
      execCommand(this.herdrBin(), ["pane", "close", paneId]);
    } catch {
      // Ignore errors during shutdown. The pane may already be closed.
    }
  }

  isAlive(paneId: string): boolean {
    if (!paneId) return false;

    try {
      const result = execCommand(this.herdrBin(), ["pane", "get", paneId]);
      return result.status === 0;
    } catch {
      return false;
    }
  }

  setTitle(title: string): void {
    const paneId = process.env.HERDR_PANE_ID;
    if (!paneId) return;

    try {
      execCommand(this.herdrBin(), ["pane", "rename", paneId, title]);
    } catch {
      // Best-effort UI nicety only.
    }
  }

  supportsWindows(): boolean {
    // Herdr does not expose OS windows, but tabs are the Herdr-native isolated
    // surface that best matches pi-teams' separate-window workflow.
    return this.detect();
  }

  spawnWindow(options: SpawnOptions): string {
    const paneId = this.spawn(options);
    const title = options.teamName ? `${options.teamName}: ${options.name}` : options.name;
    const args = ["pane", "move", paneId, "--new-tab", "--label", title, "--no-focus"];

    const placement = this.currentPlacement();
    if (placement.workspaceId) {
      args.splice(4, 0, "--workspace", placement.workspaceId);
    }

    const result = execCommand(this.herdrBin(), args);
    if (result.status !== 0) {
      this.kill(paneId);
      throw new Error(`herdr pane move failed with status ${result.status}: ${result.stderr || result.stdout}`);
    }

    const json = parseJson(result.stdout);
    const tabId = json?.result?.move_result?.created_tab?.tab_id || json?.result?.tab?.tab_id || json?.result?.pane?.tab_id;
    if (!tabId) {
      this.kill(paneId);
      throw new Error(`herdr pane move returned unexpected output: ${result.stdout.trim()}`);
    }

    return tabId;
  }

  setWindowTitle(windowId: string, title: string): void {
    if (!windowId) return;

    try {
      execCommand(this.herdrBin(), ["tab", "rename", windowId, title]);
    } catch {
      // Best-effort only.
    }
  }

  killWindow(windowId: string): void {
    if (!windowId) return;

    try {
      execCommand(this.herdrBin(), ["tab", "close", windowId]);
    } catch {
      // Ignore errors during shutdown. The tab may already be closed.
    }
  }

  isWindowAlive(windowId: string): boolean {
    if (!windowId) return false;

    try {
      const result = execCommand(this.herdrBin(), ["tab", "get", windowId]);
      return result.status === 0;
    } catch {
      return false;
    }
  }
}
