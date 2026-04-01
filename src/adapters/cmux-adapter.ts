/**
 * CMUX Terminal Adapter
 * 
 * Implements the TerminalAdapter interface for CMUX (cmux.dev).
 *
 * Spawn strategy: cmux's `new-split` does not support a `--command` flag.
 * We follow the proven pattern from pi-cmux (npm:pi-cmux):
 *   1. Snapshot existing surfaces
 *   2. `cmux new-split <direction>`
 *   3. Poll `cmux list-pane-surfaces` to find the newly created surface
 *   4. `cmux respawn-pane --surface <id> --command <cmd>` to run the command
 *
 * Workspace strategy: when a workspace ID is provided via anchorPaneId,
 * agents spawn as splits inside that workspace instead of the lead's workspace.
 * Split direction alternates (right, down) to keep panes roughly equal.
 */

import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";

const SURFACE_POLL_ATTEMPTS = 20;
const SURFACE_POLL_DELAY_MS = 150;

const WORKSPACE_COLORS = [
  "Blue", "Green", "Purple", "Orange", "Teal", "Rose",
  "Amber", "Indigo", "Crimson", "Aqua", "Navy", "Olive",
  "Magenta", "Brown", "Charcoal", "Red",
];

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Parse a workspace ref from cmux output like "OK workspace:3 window:1"
 */
function parseWorkspaceRef(output: string): string | null {
  const match = output.match(/\b(workspace:\d+)\b/);
  return match ? match[1] : null;
}

export class CmuxAdapter implements TerminalAdapter {
  readonly name = "cmux";

  /** Tracks how many agents have been spawned per workspace for split direction alternation */
  private workspaceSpawnCount = new Map<string, number>();
  /** Tracks which color index to assign next */
  private colorIndex = 0;

  detect(): boolean {
    // Defensive: Don't detect cmux if we're inside tmux or Zellij
    // This prevents false positives in nested terminal scenarios
    if (process.env.TMUX || process.env.ZELLIJ) {
      return false;
    }
    return !!process.env.CMUX_SOCKET_PATH || !!process.env.CMUX_WORKSPACE_ID;
  }

  /**
   * List all surface refs visible in a specific workspace, or the current one.
   */
  private listSurfaceRefs(workspaceRef?: string): Set<string> {
    const refs = new Set<string>();
    try {
      const args = ["list-pane-surfaces"];
      if (workspaceRef) args.push("--workspace", workspaceRef);
      const result = execCommand("cmux", args);
      if (result.status === 0) {
        for (const line of result.stdout.split("\n")) {
          // Output lines look like: "* surface:5  ⠹ π · ziahmco  [selected]"
          const match = line.match(/\b(surface:\d+)\b/);
          if (match) refs.add(match[1]);
        }
      }
    } catch {
      // Ignore
    }
    return refs;
  }

  /**
   * Block until a new surface appears that was not in `before`, or give up.
   */
  private waitForNewSurface(before: Set<string>, workspaceRef?: string): string | null {
    for (let i = 0; i < SURFACE_POLL_ATTEMPTS; i++) {
      const current = this.listSurfaceRefs(workspaceRef);
      for (const ref of current) {
        if (!before.has(ref)) return ref;
      }
      // spawnSync-based sleep — keeps the adapter synchronous
      execCommand("sleep", [String(SURFACE_POLL_DELAY_MS / 1000)]);
    }
    return null;
  }

  /**
   * Build the full shell command with env vars and cwd prefix.
   */
  private buildFullCommand(options: SpawnOptions): string {
    const envPrefix = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");

    const baseCommand = envPrefix ? `env ${envPrefix} ${options.command}` : options.command;
    return options.cwd ? `cd ${shellEscape(options.cwd)} && ${baseCommand}` : baseCommand;
  }

  /**
   * Create a named, colored cmux workspace. Returns the workspace ref (e.g. "workspace:3").
   * The first agent for this workspace will be spawned via respawn-pane into the
   * default surface that cmux creates with the workspace.
   */
  createWorkspace(name: string, cwd?: string, color?: string): string {
    // Remember the current workspace so we can switch back after creation
    // (cmux auto-focuses newly created workspaces)
    const currentWorkspace = execCommand("cmux", ["current-workspace"]);
    const previousWorkspaceId = currentWorkspace.status === 0 ? currentWorkspace.stdout.trim() : null;

    const args = ["new-workspace", "--name", name];
    if (cwd) args.push("--cwd", cwd);

    const result = execCommand("cmux", args);
    if (result.status !== 0) {
      throw new Error(`cmux new-workspace failed: ${result.stderr}`);
    }

    const output = result.stdout.trim();
    const workspaceRef = parseWorkspaceRef(output);
    if (!workspaceRef) {
      throw new Error(`cmux new-workspace returned unexpected output: ${output}`);
    }

    // Apply color
    const assignedColor = color || WORKSPACE_COLORS[this.colorIndex % WORKSPACE_COLORS.length];
    this.colorIndex++;
    try {
      execCommand("cmux", [
        "workspace-action", "--action", "set-color",
        "--workspace", workspaceRef,
        "--color", assignedColor,
      ]);
    } catch {
      // Non-critical
    }

    // Switch focus back to the lead's workspace
    if (previousWorkspaceId) {
      try {
        execCommand("cmux", ["select-workspace", "--workspace", previousWorkspaceId]);
      } catch {
        // Non-critical
      }
    }

    this.workspaceSpawnCount.set(workspaceRef, 0);
    return workspaceRef;
  }

  spawn(options: SpawnOptions): string {
    const fullCommand = this.buildFullCommand(options);
    const targetWorkspace = options.anchorPaneId;

    // If spawning into a workspace, check if it's the first agent (use respawn)
    // or subsequent (use new-split)
    if (targetWorkspace) {
      const count = this.workspaceSpawnCount.get(targetWorkspace) ?? 0;

      if (count === 0) {
        // First agent in this workspace — respawn the default surface
        const surfaces = this.listSurfaceRefs(targetWorkspace);
        if (surfaces.size > 0) {
          const firstSurface = surfaces.values().next().value;
          const respawnResult = execCommand("cmux", [
            "respawn-pane",
            "--workspace", targetWorkspace,
            "--surface", firstSurface,
            "--command", fullCommand,
          ]);
          if (respawnResult.status !== 0) {
            throw new Error(`cmux respawn-pane failed: ${respawnResult.stderr}`);
          }

          // Rename the tab for this agent
          try {
            execCommand("cmux", ["rename-tab", "--surface", firstSurface, options.name]);
          } catch { /* non-critical */ }

          this.workspaceSpawnCount.set(targetWorkspace, count + 1);
          return firstSurface;
        }
      }

      // Subsequent agents — split inside the workspace
      // Alternate direction: first extra goes right, next goes down, etc.
      const direction = count % 2 === 1 ? "down" : "right";
      const before = this.listSurfaceRefs(targetWorkspace);

      const splitResult = execCommand("cmux", [
        "new-split", direction,
        "--workspace", targetWorkspace,
      ]);
      if (splitResult.status !== 0) {
        throw new Error(`cmux new-split failed: ${splitResult.stderr}`);
      }

      const newSurface = this.waitForNewSurface(before, targetWorkspace);
      if (!newSurface) {
        throw new Error("cmux new-split succeeded but new surface was not found");
      }

      const respawnResult = execCommand("cmux", [
        "respawn-pane",
        "--workspace", targetWorkspace,
        "--surface", newSurface,
        "--command", fullCommand,
      ]);
      if (respawnResult.status !== 0) {
        throw new Error(`cmux respawn-pane failed: ${respawnResult.stderr}`);
      }

      // Rename the tab for this agent
      try {
        execCommand("cmux", ["rename-tab", "--surface", newSurface, options.name]);
      } catch { /* non-critical */ }

      this.workspaceSpawnCount.set(targetWorkspace, count + 1);
      return newSurface;
    }

    // Default: spawn into the current workspace (original behavior)
    const before = this.listSurfaceRefs();

    const splitResult = execCommand("cmux", ["new-split", "right"]);
    if (splitResult.status !== 0) {
      throw new Error(`cmux new-split failed with status ${splitResult.status}: ${splitResult.stderr}`);
    }

    const newSurface = this.waitForNewSurface(before);
    if (!newSurface) {
      throw new Error("cmux new-split succeeded but new surface was not found");
    }

    const respawnResult = execCommand("cmux", [
      "respawn-pane",
      "--surface", newSurface,
      "--command", fullCommand,
    ]);
    if (respawnResult.status !== 0) {
      throw new Error(`cmux respawn-pane failed with status ${respawnResult.status}: ${respawnResult.stderr}`);
    }

    return newSurface;
  }

  kill(paneId: string): void {
    if (!paneId) return;
    
    try {
      execCommand("cmux", ["close-surface", "--surface", paneId]);
    } catch {
      // Ignore errors during kill
    }
  }

  isAlive(paneId: string): boolean {
    if (!paneId) return false;

    try {
      const result = execCommand("cmux", ["list-pane-surfaces"]);
      return result.stdout.includes(paneId);
    } catch {
      return false;
    }
  }

  setTitle(title: string): void {
    try {
      execCommand("cmux", ["rename-tab", title]);
    } catch {
      // Ignore errors
    }
  }

  supportsWindows(): boolean {
    return true;
  }

  spawnWindow(options: SpawnOptions): string {
    const result = execCommand("cmux", ["new-window"]);
    
    if (result.status !== 0) {
      throw new Error(`cmux new-window failed with status ${result.status}: ${result.stderr}`);
    }

    const output = result.stdout.trim();
    if (output.startsWith("OK ")) {
      const windowId = output.substring(3).trim();
      const fullCommand = this.buildFullCommand(options);

      execCommand("cmux", ["new-workspace", "--window", windowId, "--command", fullCommand]);

      if (options.teamName) {
        this.setWindowTitle(windowId, options.teamName);
      }

      return windowId;
    }

    throw new Error(`cmux new-window returned unexpected output: ${output}`);
  }

  setWindowTitle(windowId: string, title: string): void {
    try {
      execCommand("cmux", ["rename-window", "--window", windowId, title]);
    } catch {
      // Ignore
    }
  }

  killWindow(windowId: string): void {
    if (!windowId) return;
    try {
      execCommand("cmux", ["close-window", "--window", windowId]);
    } catch {
      // Ignore
    }
  }

  isWindowAlive(windowId: string): boolean {
    if (!windowId) return false;
    try {
      const result = execCommand("cmux", ["list-windows"]);
      return result.stdout.includes(windowId);
    } catch {
      return false;
    }
  }
}
