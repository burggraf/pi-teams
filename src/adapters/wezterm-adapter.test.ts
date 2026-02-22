/**
 * WezTerm Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WezTermAdapter } from "./wezterm-adapter";
import * as terminalAdapter from "../utils/terminal-adapter";

describe("WezTermAdapter", () => {
  let adapter: WezTermAdapter;
  let mockExecCommand: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new WezTermAdapter();
    // Mock the execCommand function from terminal-adapter
    mockExecCommand = vi.spyOn(terminalAdapter, "execCommand");
    // Reset environment variables
    delete process.env.WEZTERM_PANE;
    delete process.env.TMUX;
    delete process.env.ZELLIJ;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("name", () => {
    it("should have the correct name", () => {
      expect(adapter.name).toBe("WezTerm");
    });
  });

  describe("detect", () => {
    it("should detect when WEZTERM_PANE is set", () => {
      process.env.WEZTERM_PANE = "1";
      expect(adapter.detect()).toBe(true);
    });

    it("should not detect when WEZTERM_PANE is not set", () => {
      expect(adapter.detect()).toBe(false);
    });

    it("should not detect when in tmux", () => {
      process.env.WEZTERM_PANE = "1";
      process.env.TMUX = "/tmp/tmux-1000/default";
      expect(adapter.detect()).toBe(false);
    });

    it("should not detect when in zellij", () => {
      process.env.WEZTERM_PANE = "1";
      process.env.ZELLIJ = "1";
      expect(adapter.detect()).toBe(false);
    });
  });

  describe("spawn", () => {
    it("should spawn first pane to the left with 30% width", () => {
      mockExecCommand.mockReturnValue({ stdout: "%1", stderr: "", status: 0 });

      const result = adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi --agent test",
        env: { PI_AGENT_ID: "test-123" },
      });

      expect(result).toBe("wezterm_%1");
      expect(mockExecCommand).toHaveBeenCalledWith(
        "wezterm",
        expect.arrayContaining(["cli", "split-pane", "--left", "--percent", "30"])
      );
    });

    it("should spawn subsequent panes to the bottom with 50% height", () => {
      // First spawn
      mockExecCommand.mockReturnValue({ stdout: "%1", stderr: "", status: 0 });
      adapter.spawn({
        name: "agent1",
        cwd: "/home/user/project",
        command: "pi --agent agent1",
        env: {},
      });

      // Second spawn
      mockExecCommand.mockReturnValue({ stdout: "%2", stderr: "", status: 0 });
      const result = adapter.spawn({
        name: "agent2",
        cwd: "/home/user/project",
        command: "pi --agent agent2",
        env: {},
      });

      expect(result).toBe("wezterm_%2");
      expect(mockExecCommand).toHaveBeenLastCalledWith(
        "wezterm",
        expect.arrayContaining(["cli", "split-pane", "--bottom", "--percent", "50"])
      );
    });

    it("should filter env variables to only PI_* prefixed", () => {
      mockExecCommand.mockReturnValue({ stdout: "%1", stderr: "", status: 0 });

      adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi --agent test",
        env: { PI_AGENT_ID: "test-123", PATH: "/usr/bin", PI_TEAM_NAME: "my-team" },
      });

      expect(mockExecCommand).toHaveBeenCalledWith(
        "wezterm",
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
      ).toThrow("wezterm spawn failed with status 1: error");
    });
  });

  describe("kill", () => {
    it("should send Ctrl-C to pane", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

      adapter.kill("wezterm_%1");

      expect(mockExecCommand).toHaveBeenCalledWith("wezterm", ["cli", "send-text", "--pane-id", "%1", "\x03"]);
    });

    it("should not kill non-wezterm panes", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

      adapter.kill("tmux_%1");
      adapter.kill("zellij_test");

      expect(mockExecCommand).not.toHaveBeenCalled();
    });

    it("should ignore errors when killing", () => {
      mockExecCommand.mockImplementation(() => {
        throw new Error("pane not found");
      });

      expect(() => adapter.kill("wezterm_%1")).not.toThrow();
    });
  });

  describe("isAlive", () => {
    it("should check if pane is alive", () => {
      mockExecCommand.mockReturnValue({ stdout: "list output", stderr: "", status: 0 });

      const result = adapter.isAlive("wezterm_%1");

      expect(result).toBe(true);
      expect(mockExecCommand).toHaveBeenCalledWith("wezterm", ["cli", "list-clients"]);
    });

    it("should return false for non-wezterm panes", () => {
      expect(adapter.isAlive("tmux_%1")).toBe(false);
      expect(adapter.isAlive("")).toBe(false);
    });

    it("should return false on error", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "error", status: 1 });

      const result = adapter.isAlive("wezterm_%1");

      expect(result).toBe(false);
    });
  });

  describe("setTitle", () => {
    it("should set tab title", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

      adapter.setTitle("Test Agent");

      expect(mockExecCommand).toHaveBeenCalledWith("wezterm", ["cli", "set-tab-title", "Test Agent"]);
    });

    it("should ignore errors", () => {
      mockExecCommand.mockImplementation(() => {
        throw new Error("error");
      });

      expect(() => adapter.setTitle("Test Agent")).not.toThrow();
    });
  });
});
