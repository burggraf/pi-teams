/**
 * Windows Terminal/PowerShell Adapter
 *
 * Implements the TerminalAdapter interface for Windows with PowerShell.
 * Uses wt (Windows Terminal) CLI for pane management and PowerShell for command execution.
 *
 * IMPORTANT: The `wt` CLI on Windows is a UWP app execution alias, NOT a standard
 * executable. It has its own argument parser that:
 *   - Uses `;` as a command separator (not shell semicolons)
 *   - Does NOT understand `--` as an end-of-options separator
 *   - Mangles complex arguments (multi-line strings, nested quotes)
 *   - Spawns VISIBLE error dialogs when given invalid arguments
 *
 * Strategy: We write a temporary .ps1 script file and tell wt to run
 * `pwsh -NoExit -File <script>`. This avoids ALL quoting/escaping issues
 * because the script content never passes through wt's argument parser.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TerminalAdapter, SpawnOptions, execCommand } from "../utils/terminal-adapter";

export class WindowsAdapter implements TerminalAdapter {
  readonly name = "Windows";

  private wtPath: string | null = null;
  private psPath: string | null = null;

  /**
   * Temp directory for spawning .ps1 scripts.
   * We use os.tmpdir() which is reliable on Windows.
   */
  private getTempDir(): string {
    const dir = path.join(os.tmpdir(), "pi-teams");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Find the wt (Windows Terminal) binary WITHOUT spawning it.
   * Uses `where.exe` to check PATH, or checks common file paths.
   * Never calls `wt` directly — the UWP alias spawns visible error windows.
   */
  private findWtBinary(): string | null {
    if (this.wtPath !== null) {
      return this.wtPath;
    }

    // Method 1: Use where.exe to check if wt is in PATH
    try {
      const result = execCommand("where.exe", ["wt"]);
      if (result.status === 0 && result.stdout.trim().length > 0) {
        this.wtPath = "wt";
        return "wt";
      }
    } catch {
      // where.exe couldn't find wt
    }

    // Method 2: Check common file paths directly
    const possiblePaths = [
      `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe`,
      "C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminal_8wekyb3d8bbwe\\wt.exe",
      `C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe\\wt.exe`,
    ];

    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          this.wtPath = p;
          return p;
        }
      } catch {}
    }

    // Method 3: On Windows, assume wt is available — most Win10/11 have it
    if (process.platform === "win32") {
      this.wtPath = "wt";
      return "wt";
    }

    this.wtPath = null;
    return null;
  }

  /**
   * Find the PowerShell binary to use.
   * Prefers PowerShell Core (pwsh) if available, falls back to Windows PowerShell (powershell).
   */
  private findPsBinary(): string {
    if (this.psPath !== null) {
      return this.psPath;
    }

    // Try pwsh (PowerShell Core / PowerShell 7+) first
    try {
      const result = execCommand("pwsh", ["-NoProfile", "-Command", "echo 'found'"]);
      if (result.status === 0 && result.stdout.trim() === "found") {
        this.psPath = "pwsh";
        return "pwsh";
      }
    } catch {
      // pwsh not found, try powershell
    }

    // Fall back to powershell (Windows PowerShell 5.1)
    try {
      const result = execCommand("powershell", ["-NoProfile", "-Command", "echo 'found'"]);
      if (result.status === 0 && result.stdout.trim() === "found") {
        this.psPath = "powershell";
        return "powershell";
      }
    } catch {
      // powershell not found either
    }

    // Default to powershell as it's built into Windows
    this.psPath = "powershell";
    return "powershell";
  }

  detect(): boolean {
    if (process.platform !== "win32") {
      return false;
    }

    // Don't use if inside tmux, Zellij, or WezTerm
    if (process.env.TMUX || process.env.ZELLIJ || process.env.WEZTERM_PANE) {
      return false;
    }

    return true;
  }

  /**
   * Write a temporary .ps1 script file that sets env vars, cd's, and runs the command.
   * Returns the path to the script file.
   *
   * This approach completely avoids wt's argument parser — the script contents
   * never pass through wt at all. wt only sees: pwsh -NoExit -File C:\path\script.ps1
   */
  private writeSpawnScript(options: SpawnOptions): string {
    const lines: string[] = [];

    // Self-delete: by the time PowerShell executes this line, the script
    // is already loaded into memory, so removing the file is safe.
    // This avoids temp file accumulation without race conditions.
    lines.push(`Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue`);

    // Set environment variables
    for (const [k, v] of Object.entries(options.env)) {
      if (k.startsWith("PI_")) {
        lines.push(`$env:${k} = '${v}'`);
      }
    }

    // Change to working directory
    lines.push(`cd '${options.cwd}'`);

    // Run the command
    lines.push(options.command);

    const scriptContent = lines.join("\r\n");
    const scriptPath = path.join(this.getTempDir(), `spawn_${options.name}_${Date.now()}.ps1`);
    fs.writeFileSync(scriptPath, scriptContent, "utf-8");

    return scriptPath;
  }

  spawn(options: SpawnOptions): string {
    const wtBin = this.findWtBinary();
    if (!wtBin) {
      throw new Error("Windows Terminal (wt) CLI binary not found.");
    }

    const psBin = this.findPsBinary();
    const scriptPath = this.writeSpawnScript(options);

    // wt split-pane -V --size 0.5 pwsh -NoExit -File C:\path\script.ps1
    // -V = vertical split (side by side)
    // --size 0.5 = 50% size (decimal between 0.01 and 0.99, NOT "50%")
    // -NoExit = keep the PowerShell window open after the script finishes
    // -File = run the script (avoids all quoting/escaping issues with -Command)
    // DO NOT use -- separator or -% flag — wt doesn't parse them correctly as a UWP alias
    const wtArgs: string[] = [
      "split-pane",
      "-V",
      "--size", "0.5",
      psBin, "-NoExit", "-File", scriptPath,
    ];

    const result = execCommand(wtBin, wtArgs);

    if (result.status !== 0) {
      throw new Error(`Windows Terminal spawn failed: ${result.stderr}`);
    }

    const syntheticId = `windows_${Date.now()}_${options.name}`;
    return syntheticId;
  }

  kill(paneId: string): void {
    if (!paneId?.startsWith("windows_")) return;
  }

  isAlive(paneId: string): boolean {
    if (!paneId?.startsWith("windows_")) return false;
    return true;
  }

  setTitle(title: string): void {
    // Avoid calling wt for setTitle — it can spawn error dialogs
    // Titles are better set at spawn time via --title
  }

  supportsWindows(): boolean {
    return this.findWtBinary() !== null;
  }

  spawnWindow(options: SpawnOptions): string {
    const wtBin = this.findWtBinary();
    if (!wtBin) {
      throw new Error("Windows Terminal (wt) CLI binary not found.");
    }

    const psBin = this.findPsBinary();
    const scriptPath = this.writeSpawnScript(options);

    const windowTitle = options.teamName
      ? `${options.teamName}: ${options.name}`
      : options.name;

    const spawnArgs: string[] = [
      "new-window",
      "--title", windowTitle,
      psBin, "-NoExit", "-File", scriptPath,
    ];

    const result = execCommand(wtBin, spawnArgs);

    if (result.status !== 0) {
      throw new Error(`Windows Terminal spawn-window failed: ${result.stderr}`);
    }

    const syntheticId = `windows_win_${Date.now()}_${options.name}`;
    return syntheticId;
  }

  setWindowTitle(windowId: string, title: string): void {
    // Not supported post-creation via wt CLI
  }

  killWindow(windowId: string): void {
    if (!windowId?.startsWith("windows_win_")) return;
  }

  isWindowAlive(windowId: string): boolean {
    if (!windowId?.startsWith("windows_win_")) return false;
    return true;
  }
}
