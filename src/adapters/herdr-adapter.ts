/**
 * Herdr Terminal Adapter
 *
 * Bridges the TerminalAdapter interface to herdr's CLI (the terminal
 * workspace manager for AI coding agents). Shells out to the `herdr`
 * binary the same way TmuxAdapter shells out to `tmux`.
 *
 * Detection: only active when running inside a herdr session, signalled
 * by HERDR_ENV=1 and HERDR_PANE_ID being present in the environment.
 *
 * Patterns and JSON-envelope handling are inspired by @ogulcancelik/pi-herdr
 * (MIT). That extension exposes herdr as an LLM tool; this adapter calls
 * the same CLI programmatically for pi-teams' spawn_teammate flow.
 */
import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";

interface PaneInfo {
  pane_id: string;
  workspace_id: string;
  tab_id: string;
}

interface WorkspaceInfo {
  workspace_id: string;
  label: string;
}

interface HerdrEnvelope {
  id?: string;
  result?: unknown;
  error?: { code?: string; message?: string };
}

export class HerdrAdapter implements TerminalAdapter {
  readonly name = "herdr";

  detect(): boolean {
    return process.env.HERDR_ENV === "1" && !!process.env.HERDR_PANE_ID;
  }

  private getCurrentPaneId(): string | null {
    const id = process.env.HERDR_PANE_ID?.trim();
    return id ? id : null;
  }

  /**
   * Execute a herdr command. Throws on non-zero exit, surfacing any JSON
   * error envelope found in stderr/stdout. Returns the raw output.
   *
   * Use for commands that don't produce a structured result (pane run,
   * pane close, pane rename, workspace close, workspace rename, send-text...).
   */
  private execHerdr(args: string[]): { stdout: string; stderr: string } {
    const res = execCommand("herdr", args);
    const stdout = (res.stdout ?? "").trim();
    const stderr = (res.stderr ?? "").trim();

    if (res.status !== 0) {
      const fromStderr = this.tryParseErrorMessage(stderr);
      const fromStdout = this.tryParseErrorMessage(stdout);
      throw new Error(
        `herdr ${args.join(" ")} failed (exit ${res.status}): ${fromStderr || fromStdout || stderr || "unknown error"}`,
      );
    }

    return { stdout, stderr };
  }

  /**
   * Execute a herdr command and parse the JSON envelope `{ id, result, error }`.
   *
   * Use for commands that return structured info (pane get, pane split,
   * workspace get/create/list, pane list...).
   */
  private execHerdrJson<T = unknown>(args: string[]): T {
    const { stdout } = this.execHerdr(args);
    if (!stdout) {
      throw new Error(`herdr ${args.join(" ")} returned empty output`);
    }

    let envelope: HerdrEnvelope;
    try {
      envelope = JSON.parse(stdout) as HerdrEnvelope;
    } catch {
      throw new Error(`herdr ${args.join(" ")} returned non-JSON output`);
    }

    if (envelope.error) {
      throw new Error(envelope.error.message || envelope.error.code || `herdr ${args.join(" ")} failed`);
    }
    return envelope.result as T;
  }

  private tryParseErrorMessage(output: string): string | null {
    if (!output) return null;
    try {
      const parsed = JSON.parse(output) as HerdrEnvelope;
      return parsed.error?.message || parsed.error?.code || null;
    } catch {
      return null;
    }
  }

  /**
   * Build a shell command string that inlines the PI_* env vars so they
   * reach the teammate process. herdr `pane run` sends literal text + Enter
   * to the pane's shell, so we have to do env prefixing in-band.
   */
  private buildInlineCommand(options: SpawnOptions): string {
    const envPrefix = Object.entries(options.env)
      .filter(([k]) => k.startsWith("PI_"))
      .map(([k, v]) => `${k}=${this.shellQuote(v)}`)
      .join(" ");
    return envPrefix ? `${envPrefix} ${options.command}` : options.command;
  }

  /**
   * Quote a value for safe inclusion in a shell command.
   * PI_* values are sanitized upstream but we double-protect against
   * stray spaces or shell metacharacters.
   */
  private shellQuote(value: string): string {
    if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value;
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  spawn(options: SpawnOptions): string {
    const sourcePaneId = options.anchorPaneId || this.getCurrentPaneId();
    if (!sourcePaneId) {
      throw new Error("herdr spawn requires HERDR_PANE_ID or an explicit anchorPaneId");
    }

    const splitArgs = [
      "pane",
      "split",
      sourcePaneId,
      "--direction",
      "down",
      "--no-focus",
    ];
    if (options.cwd) splitArgs.push("--cwd", options.cwd);

    const splitResult = this.execHerdrJson<{ pane: PaneInfo }>(splitArgs);
    const newPaneId = splitResult.pane?.pane_id;
    if (!newPaneId) {
      throw new Error("herdr pane split did not return a pane id");
    }

    const inlineCommand = this.buildInlineCommand(options);
    this.execHerdr(["pane", "run", newPaneId, inlineCommand]);

    return newPaneId;
  }

  kill(paneId: string): void {
    if (!paneId || !this.looksLikeHerdrPaneId(paneId)) return;
    try {
      this.execHerdr(["pane", "close", paneId]);
    } catch {
      // Pane may already be gone; idempotent kill.
    }
  }

  isAlive(paneId: string): boolean {
    if (!paneId || !this.looksLikeHerdrPaneId(paneId)) return false;
    try {
      this.execHerdrJson<{ pane: PaneInfo }>(["pane", "get", paneId]);
      return true;
    } catch {
      return false;
    }
  }

  setTitle(title: string): void {
    const paneId = this.getCurrentPaneId();
    if (!paneId || !title) return;
    try {
      this.execHerdr(["pane", "rename", paneId, title]);
    } catch {
      // Ignore; title is cosmetic.
    }
  }

  supportsWindows(): boolean {
    return true;
  }

  spawnWindow(options: SpawnOptions): string {
    const label = options.teamName || options.name;
    const wsArgs = ["workspace", "create", "--no-focus"];
    if (options.cwd) wsArgs.push("--cwd", options.cwd);
    if (label) wsArgs.push("--label", label);

    const wsResult = this.execHerdrJson<{
      workspace: WorkspaceInfo;
      root_pane?: PaneInfo;
    }>(wsArgs);

    const workspaceId = wsResult.workspace?.workspace_id;
    if (!workspaceId) {
      throw new Error("herdr workspace create did not return a workspace id");
    }

    let rootPaneId = wsResult.root_pane?.pane_id;
    if (!rootPaneId) {
      // Fallback: list panes in the new workspace and pick the first one.
      try {
        const list = this.execHerdrJson<{ panes: PaneInfo[] }>([
          "pane",
          "list",
          "--workspace",
          workspaceId,
        ]);
        rootPaneId = list.panes?.[0]?.pane_id;
      } catch {
        // Leave undefined; we'll surface a clear error below.
      }
    }

    if (!rootPaneId) {
      throw new Error("herdr workspace create did not yield a usable root pane");
    }

    const inlineCommand = this.buildInlineCommand(options);
    this.execHerdr(["pane", "run", rootPaneId, inlineCommand]);

    return workspaceId;
  }

  setWindowTitle(windowId: string, title: string): void {
    if (!windowId || !title) return;
    try {
      this.execHerdr(["workspace", "rename", windowId, title]);
    } catch {
      // Ignore; cosmetic.
    }
  }

  killWindow(windowId: string): void {
    if (!windowId) return;
    try {
      this.execHerdr(["workspace", "close", windowId]);
    } catch {
      // Idempotent.
    }
  }

  isWindowAlive(windowId: string): boolean {
    if (!windowId) return false;
    try {
      this.execHerdrJson<{ workspace: WorkspaceInfo }>(["workspace", "get", windowId]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Herdr pane ids look like `w<hex>-<n>` (e.g. `w654499698d1c65-2`).
   * Filter out ids from other adapters so a stale config doesn't make us
   * shell out to herdr with a tmux/iterm id and pollute logs.
   */
  private looksLikeHerdrPaneId(id: string): boolean {
    return !id.startsWith("iterm_") && !id.startsWith("zellij_") && !id.startsWith("%");
  }
}
