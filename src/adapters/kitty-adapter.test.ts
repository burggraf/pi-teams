/**
 * Kitty Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { KittyAdapter } from "./kitty-adapter";
import * as terminalAdapter from "../utils/terminal-adapter";

describe("KittyAdapter", () => {
  let adapter: KittyAdapter;
  let mockExecCommand: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new KittyAdapter();
    // Mock the execCommand function from terminal-adapter
    mockExecCommand = vi.spyOn(terminalAdapter, "execCommand");
    // Reset environment variables
    delete process.env.KITTY_WINDOW_ID;
    delete process.env.TMUX;
    delete process.env.ZELLIJ;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("name", () => {
    it("should have the correct name", () => {
      expect(adapter.name).toBe("Kitty");
    });
  });

  describe("detect", () => {
    it("should detect when KITTY_WINDOW_ID is set", () => {
      process.env.KITTY_WINDOW_ID = "1";
      expect(adapter.detect()).toBe(true);
    });

    it("should not detect when KITTY_WINDOW_ID is not set", () => {
      expect(adapter.detect()).toBe(false);
    });

    it("should not detect when in tmux", () => {
      process.env.KITTY_WINDOW_ID = "1";
      process.env.TMUX = "/tmp/tmux-1000/default";
      expect(adapter.detect()).toBe(false);
    });

    it("should not detect when in zellij", () => {
      process.env.KITTY_WINDOW_ID = "1";
      process.env.ZELLIJ = "1";
      expect(adapter.detect()).toBe(false);
    });
  });

  describe("spawn", () => {
    it("should spawn first window with vertical split", () => {
      mockExecCommand.mockReturnValue({ stdout: "1", stderr: "", status: 0 });

      const result = adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi --agent test",
        env: { PI_AGENT_ID: "test-123" },
      });

      expect(result).toBe("kitty_1");
      expect(mockExecCommand).toHaveBeenCalledWith(
        "kitty",
        expect.arrayContaining(["@", "launch", "--location", "vsplit"])
      );
    });

    it("should spawn subsequent windows with horizontal split", () => {
      // First spawn
      mockExecCommand.mockReturnValue({ stdout: "1", stderr: "", status: 0 });
      adapter.spawn({
        name: "agent1",
        cwd: "/home/user/project",
        command: "pi --agent agent1",
        env: {},
      });

      // Second spawn
      mockExecCommand.mockReturnValue({ stdout: "2", stderr: "", status: 0 });
      const result = adapter.spawn({
        name: "agent2",
        cwd: "/home/user/project",
        command: "pi --agent agent2",
        env: {},
      });

      expect(result).toBe("kitty_2");
      expect(mockExecCommand).toHaveBeenLastCalledWith(
        "kitty",
        expect.arrayContaining(["@", "launch", "--location", "hsplit"])
      );
    });

    it("should set window title to pane name", () => {
      mockExecCommand.mockReturnValue({ stdout: "1", stderr: "", status: 0 });

      adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi --agent test",
        env: {},
      });

      expect(mockExecCommand).toHaveBeenCalledWith(
        "kitty",
        expect.arrayContaining(["--title", "test-agent"])
      );
    });

    it("should filter env variables to only PI_* prefixed", () => {
      mockExecCommand.mockReturnValue({ stdout: "1", stderr: "", status: 0 });

      adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi --agent test",
        env: { PI_AGENT_ID: "test-123", PATH: "/usr/bin", PI_TEAM_NAME: "my-team" },
      });

      expect(mockExecCommand).toHaveBeenCalledWith(
        "kitty",
        expect.arrayContaining(["PI_AGENT_ID=test-123", "PI_TEAM_NAME=my-team"])
      );
    });

    it("should throw error on spawn failure", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "error", status: 1 });

      expect(() =>
        adapter.spawn({
          name: "test-agent",
          cwd: "/home/user/project",
          command: "pi --agent test",
          env: {},
        })
      ).toThrow("kitty spawn failed with status 1: error");
    });
  });

  describe("kill", () => {
    it("should close window by id", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

      adapter.kill("kitty_1");

      expect(mockExecCommand).toHaveBeenCalledWith("kitty", ["@", "close-window", "--match", "id:1"]);
    });

    it("should not kill non-kitty panes", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

      adapter.kill("tmux_%1");
      adapter.kill("zellij_test");

      expect(mockExecCommand).not.toHaveBeenCalled();
    });

    it("should ignore errors when killing", () => {
      mockExecCommand.mockImplementation(() => {
        throw new Error("window not found");
      });

      expect(() => adapter.kill("kitty_1")).not.toThrow();
    });
  });

  describe("isAlive", () => {
    it("should check if window is alive", () => {
      mockExecCommand.mockReturnValue({ stdout: "Window id 1: some output", stderr: "", status: 0 });

      const result = adapter.isAlive("kitty_1");

      expect(result).toBe(true);
      expect(mockExecCommand).toHaveBeenCalledWith("kitty", ["@", "ls"]);
    });

    it("should return false for non-kitty panes", () => {
      expect(adapter.isAlive("tmux_%1")).toBe(false);
      expect(adapter.isAlive("")).toBe(false);
    });

    it("should return false when window not found in list", () => {
      mockExecCommand.mockReturnValue({ stdout: "Window id 2: other output", stderr: "", status: 0 });

      const result = adapter.isAlive("kitty_1");

      expect(result).toBe(false);
    });

    it("should return false on error", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "error", status: 1 });

      const result = adapter.isAlive("kitty_1");

      expect(result).toBe(false);
    });
  });

  describe("setTitle", () => {
    it("should set window title", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

      adapter.setTitle("Test Agent");

      expect(mockExecCommand).toHaveBeenCalledWith("kitty", ["@", "set-window-title", "Test Agent"]);
    });

    it("should ignore errors", () => {
      mockExecCommand.mockImplementation(() => {
        throw new Error("error");
      });

      expect(() => adapter.setTitle("Test Agent")).not.toThrow();
    });
  });

  describe("spawn context", () => {
    it("should track spawn context", () => {
      mockExecCommand.mockReturnValue({ stdout: "1", stderr: "", status: 0 });

      adapter.spawn({
        name: "agent1",
        cwd: "/home/user/project",
        command: "pi --agent agent1",
        env: {},
      });

      const context = adapter.getSpawnContext();
      expect(context.lastWindowId).toBe("1");
    });

    it("should allow setting spawn context", () => {
      adapter.setSpawnContext({ lastWindowId: "5" });

      mockExecCommand.mockReturnValue({ stdout: "6", stderr: "", status: 0 });
      adapter.spawn({
        name: "agent2",
        cwd: "/home/user/project",
        command: "pi --agent agent2",
        env: {},
      });

      const context = adapter.getSpawnContext();
      expect(context.lastWindowId).toBe("6");
    });
  });
});
