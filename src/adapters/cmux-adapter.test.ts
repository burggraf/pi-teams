/**
 * CmuxAdapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CmuxAdapter } from "./cmux-adapter";
import * as terminalAdapter from "../utils/terminal-adapter";

describe("CmuxAdapter", () => {
  let adapter: CmuxAdapter;
  let mockExecCommand: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new CmuxAdapter();
    mockExecCommand = vi.spyOn(terminalAdapter, "execCommand");
    delete process.env.CMUX_SOCKET_PATH;
    delete process.env.CMUX_WORKSPACE_ID;
    delete process.env.TMUX;
    delete process.env.ZELLIJ;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("name", () => {
    it("should have the correct name", () => {
      expect(adapter.name).toBe("cmux");
    });
  });

  describe("detect", () => {
    it("should detect when CMUX_SOCKET_PATH is set", () => {
      process.env.CMUX_SOCKET_PATH = "/tmp/cmux.sock";
      expect(adapter.detect()).toBe(true);
    });

    it("should detect when CMUX_WORKSPACE_ID is set", () => {
      process.env.CMUX_WORKSPACE_ID = "workspace-123";
      expect(adapter.detect()).toBe(true);
    });

    it("should not detect when neither env var is set", () => {
      expect(adapter.detect()).toBe(false);
    });

    it("should not detect when TMUX is set (defensive - nested)", () => {
      process.env.CMUX_SOCKET_PATH = "/tmp/cmux.sock";
      process.env.TMUX = "/tmp/tmux-1000/default,123,0";
      expect(adapter.detect()).toBe(false);
    });

    it("should not detect when ZELLIJ is set (defensive - nested)", () => {
      process.env.CMUX_WORKSPACE_ID = "workspace-123";
      process.env.ZELLIJ = "1";
      expect(adapter.detect()).toBe(false);
    });
  });

  describe("spawn", () => {
    beforeEach(() => {
      process.env.CMUX_SOCKET_PATH = "/tmp/cmux.sock";
    });

    it("should spawn via new-split + poll + respawn-pane and return the new surface", () => {
      mockExecCommand
        // 1. listSurfaceRefs (before snapshot) — realistic cmux output
        .mockReturnValueOnce({ stdout: "* surface:1  Terminal  [selected]\n  surface:2  Terminal\n", stderr: "", status: 0 })
        // 2. new-split right
        .mockReturnValueOnce({ stdout: "OK", stderr: "", status: 0 })
        // 3. listSurfaceRefs (poll — finds new surface:42)
        .mockReturnValueOnce({ stdout: "* surface:1  Terminal  [selected]\n  surface:2  Terminal\n  surface:42  Terminal\n", stderr: "", status: 0 })
        // 4. respawn-pane
        .mockReturnValueOnce({ stdout: "OK", stderr: "", status: 0 });

      const result = adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi --agent test",
        env: { PI_AGENT_ID: "test-123" },
      });

      expect(result).toBe("surface:42");

      // Verify new-split was called without --command
      expect(mockExecCommand).toHaveBeenCalledWith("cmux", ["new-split", "right"]);

      // Verify respawn-pane was called with the new surface and full command (with cd prefix)
      expect(mockExecCommand).toHaveBeenCalledWith("cmux", [
        "respawn-pane",
        "--surface", "surface:42",
        "--command", "cd '/home/user/project' && env PI_AGENT_ID=test-123 pi --agent test",
      ]);
    });

    it("should spawn without env prefix when no PI_ vars", () => {
      mockExecCommand
        .mockReturnValueOnce({ stdout: "  surface:1  Terminal\n", stderr: "", status: 0 })
        .mockReturnValueOnce({ stdout: "OK", stderr: "", status: 0 })
        .mockReturnValueOnce({ stdout: "  surface:1  Terminal\n  surface:99  Terminal\n", stderr: "", status: 0 })
        .mockReturnValueOnce({ stdout: "OK", stderr: "", status: 0 });

      const result = adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi",
        env: { OTHER: "ignored" },
      });

      expect(result).toBe("surface:99");
      expect(mockExecCommand).toHaveBeenCalledWith("cmux", [
        "respawn-pane",
        "--surface", "surface:99",
        "--command", "cd '/home/user/project' && pi",
      ]);
    });

    it("should throw on new-split failure", () => {
      mockExecCommand
        // listSurfaceRefs (before)
        .mockReturnValueOnce({ stdout: "  surface:1  Terminal\n", stderr: "", status: 0 })
        // new-split fails
        .mockReturnValueOnce({ stdout: "", stderr: "cmux not found", status: 1 });

      expect(() => adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi",
        env: {},
      })).toThrow("cmux new-split failed with status 1");
    });

    it("should throw when new surface is not found after polling", () => {
      mockExecCommand
        // listSurfaceRefs (before)
        .mockReturnValueOnce({ stdout: "  surface:1  Terminal\n", stderr: "", status: 0 })
        // new-split OK
        .mockReturnValueOnce({ stdout: "OK", stderr: "", status: 0 });

      // All subsequent polls return the same surfaces (no new one appears)
      // Each poll cycle = listSurfaceRefs + sleep
      for (let i = 0; i < 20; i++) {
        mockExecCommand
          .mockReturnValueOnce({ stdout: "  surface:1  Terminal\n", stderr: "", status: 0 })  // listSurfaceRefs
          .mockReturnValueOnce({ stdout: "", stderr: "", status: 0 });  // sleep
      }

      expect(() => adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi",
        env: {},
      })).toThrow("new surface was not found");
    });

    it("should throw when respawn-pane fails", () => {
      mockExecCommand
        .mockReturnValueOnce({ stdout: "  surface:1  Terminal\n", stderr: "", status: 0 })
        .mockReturnValueOnce({ stdout: "OK", stderr: "", status: 0 })
        .mockReturnValueOnce({ stdout: "  surface:1  Terminal\n  surface:50  Terminal\n", stderr: "", status: 0 })
        // respawn-pane fails
        .mockReturnValueOnce({ stdout: "", stderr: "respawn error", status: 1 });

      expect(() => adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi",
        env: {},
      })).toThrow("cmux respawn-pane failed with status 1");
    });
  });

  describe("kill", () => {
    it("should kill a pane by surface ID", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

      adapter.kill("surface-42");

      expect(mockExecCommand).toHaveBeenCalledWith(
        "cmux",
        ["close-surface", "--surface", "surface-42"]
      );
    });

    it("should be idempotent - no error on empty pane ID", () => {
      adapter.kill("");
      adapter.kill(undefined as unknown as string);
      expect(mockExecCommand).not.toHaveBeenCalled();
    });
  });

  describe("isAlive", () => {
    it("should return true if pane exists", () => {
      mockExecCommand.mockReturnValue({ 
        stdout: "surface-1\nsurface-42\nsurface-99", 
        stderr: "", 
        status: 0 
      });

      expect(adapter.isAlive("surface-42")).toBe(true);
    });

    it("should return false if pane does not exist", () => {
      mockExecCommand.mockReturnValue({ 
        stdout: "surface-1\nsurface-99", 
        stderr: "", 
        status: 0 
      });

      expect(adapter.isAlive("surface-42")).toBe(false);
    });

    it("should return false on error", () => {
      mockExecCommand.mockImplementation(() => {
        throw new Error("cmux error");
      });

      expect(adapter.isAlive("surface-42")).toBe(false);
    });

    it("should return false for empty pane ID", () => {
      expect(adapter.isAlive("")).toBe(false);
      expect(adapter.isAlive(undefined as unknown as string)).toBe(false);
    });
  });

  describe("setTitle", () => {
    it("should set the tab title", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

      adapter.setTitle("My Team");

      expect(mockExecCommand).toHaveBeenCalledWith(
        "cmux",
        ["rename-tab", "My Team"]
      );
    });

    it("should silently ignore errors", () => {
      mockExecCommand.mockImplementation(() => {
        throw new Error("cmux error");
      });

      // Should not throw
      expect(() => adapter.setTitle("My Team")).not.toThrow();
    });
  });

  describe("supportsWindows", () => {
    it("should return true", () => {
      expect(adapter.supportsWindows()).toBe(true);
    });
  });

  describe("spawnWindow", () => {
    it("should spawn a new window with command", () => {
      mockExecCommand
        .mockReturnValueOnce({ stdout: "OK window-1", stderr: "", status: 0 })
        .mockReturnValueOnce({ stdout: "", stderr: "", status: 0 })
        .mockReturnValueOnce({ stdout: "", stderr: "", status: 0 });

      const result = adapter.spawnWindow({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi",
        env: { PI_TEAM: "myteam" },
        teamName: "Team Alpha",
      });

      expect(result).toBe("window-1");
      expect(mockExecCommand).toHaveBeenCalledWith(
        "cmux",
        ["new-window"]
      );
      expect(mockExecCommand).toHaveBeenCalledWith(
        "cmux",
        ["new-workspace", "--window", "window-1", "--command", "cd '/home/user/project' && env PI_TEAM=myteam pi"]
      );
      expect(mockExecCommand).toHaveBeenCalledWith(
        "cmux",
        ["rename-window", "--window", "window-1", "Team Alpha"]
      );
    });

    it("should throw on new-window failure", () => {
      mockExecCommand.mockReturnValue({ 
        stdout: "", 
        stderr: "error", 
        status: 1 
      });

      expect(() => adapter.spawnWindow({
        name: "test",
        cwd: "/home/user",
        command: "pi",
        env: {},
      })).toThrow("cmux new-window failed with status 1");
    });
  });

  describe("window operations", () => {
    it("should set window title", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

      adapter.setWindowTitle("window-1", "New Title");

      expect(mockExecCommand).toHaveBeenCalledWith(
        "cmux",
        ["rename-window", "--window", "window-1", "New Title"]
      );
    });

    it("should kill a window", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

      adapter.killWindow("window-1");

      expect(mockExecCommand).toHaveBeenCalledWith(
        "cmux",
        ["close-window", "--window", "window-1"]
      );
    });

    it("should check if window is alive", () => {
      mockExecCommand.mockReturnValue({ 
        stdout: "window-1\nwindow-2", 
        stderr: "", 
        status: 0 
      });

      expect(adapter.isWindowAlive("window-1")).toBe(true);
      expect(adapter.isWindowAlive("window-99")).toBe(false);
    });

    it("should handle empty window IDs gracefully", () => {
      adapter.killWindow("");
      adapter.killWindow(undefined as unknown as string);
      expect(mockExecCommand).not.toHaveBeenCalled();

      expect(adapter.isWindowAlive("")).toBe(false);
      expect(adapter.isWindowAlive(undefined as unknown as string)).toBe(false);
    });
  });
});
