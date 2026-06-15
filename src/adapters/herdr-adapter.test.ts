/**
 * Herdr Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HerdrAdapter } from "./herdr-adapter";
import * as terminalAdapter from "../utils/terminal-adapter";

describe("HerdrAdapter", () => {
  let adapter: HerdrAdapter;
  let mockExecCommand: ReturnType<typeof vi.spyOn>;
  const originalHerdrEnv = process.env.HERDR_ENV;
  const originalHerdrPaneId = process.env.HERDR_PANE_ID;

  beforeEach(() => {
    adapter = new HerdrAdapter();
    mockExecCommand = vi.spyOn(terminalAdapter, "execCommand");
    process.env.HERDR_ENV = "1";
    process.env.HERDR_PANE_ID = "w_abc-1";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalHerdrEnv === undefined) delete process.env.HERDR_ENV;
    else process.env.HERDR_ENV = originalHerdrEnv;
    if (originalHerdrPaneId === undefined) delete process.env.HERDR_PANE_ID;
    else process.env.HERDR_PANE_ID = originalHerdrPaneId;
  });

  it("has the correct name", () => {
    expect(adapter.name).toBe("herdr");
  });

  describe("detect", () => {
    it("returns true when HERDR_ENV=1 and HERDR_PANE_ID are set", () => {
      expect(adapter.detect()).toBe(true);
    });

    it("returns false when HERDR_ENV is missing", () => {
      delete process.env.HERDR_ENV;
      expect(adapter.detect()).toBe(false);
    });

    it("returns false when HERDR_PANE_ID is missing", () => {
      delete process.env.HERDR_PANE_ID;
      expect(adapter.detect()).toBe(false);
    });

    it("returns false when HERDR_ENV is not exactly '1'", () => {
      process.env.HERDR_ENV = "0";
      expect(adapter.detect()).toBe(false);
    });
  });

  describe("supportsWindows", () => {
    it("returns true (herdr workspaces)", () => {
      expect(adapter.supportsWindows()).toBe(true);
    });
  });

  describe("spawn", () => {
    it("splits the current pane and runs the command with PI_ env vars inlined", () => {
      mockExecCommand.mockImplementation((_bin: string, args: string[]) => {
        if (args[0] === "pane" && args[1] === "split") {
          return {
            stdout: JSON.stringify({
              id: "cli:pane:split",
              result: {
                pane: { pane_id: "w_abc-2", workspace_id: "w_abc", tab_id: "w_abc:1" },
              },
            }),
            stderr: "",
            status: 0,
          };
        }
        if (args[0] === "pane" && args[1] === "run") {
          return {
            stdout: JSON.stringify({ id: "cli:pane:run", result: { ok: true } }),
            stderr: "",
            status: 0,
          };
        }
        return { stdout: "", stderr: "", status: 0 };
      });

      const paneId = adapter.spawn({
        name: "agent-1",
        cwd: "/tmp/project",
        command: "pi --model anthropic/claude",
        env: { PI_TEAM_NAME: "team-1", PI_AGENT_NAME: "agent-1", PATH: "/ignore" },
      });

      expect(paneId).toBe("w_abc-2");

      expect(mockExecCommand).toHaveBeenCalledWith(
        "herdr",
        ["pane", "split", "w_abc-1", "--direction", "down", "--no-focus", "--cwd", "/tmp/project"],
      );

      expect(mockExecCommand).toHaveBeenCalledWith(
        "herdr",
        [
          "pane",
          "run",
          "w_abc-2",
          "PI_TEAM_NAME=team-1 PI_AGENT_NAME=agent-1 pi --model anthropic/claude",
        ],
      );
    });

    it("uses anchorPaneId when provided", () => {
      mockExecCommand.mockImplementation((_bin: string, args: string[]) => {
        if (args[0] === "pane" && args[1] === "split") {
          return {
            stdout: JSON.stringify({
              result: { pane: { pane_id: "w_abc-3", workspace_id: "w_abc", tab_id: "w_abc:1" } },
            }),
            stderr: "",
            status: 0,
          };
        }
        return { stdout: JSON.stringify({ result: {} }), stderr: "", status: 0 };
      });

      adapter.spawn({
        name: "agent-2",
        cwd: "/tmp",
        command: "pi",
        env: { PI_TEAM_NAME: "t", PI_AGENT_NAME: "a" },
        anchorPaneId: "w_xyz-1",
      });

      expect(mockExecCommand).toHaveBeenCalledWith(
        "herdr",
        ["pane", "split", "w_xyz-1", "--direction", "down", "--no-focus", "--cwd", "/tmp"],
      );
    });

    it("throws if HERDR_PANE_ID is missing and no anchor is given", () => {
      delete process.env.HERDR_PANE_ID;
      expect(() =>
        adapter.spawn({
          name: "a",
          cwd: "/tmp",
          command: "pi",
          env: { PI_TEAM_NAME: "t", PI_AGENT_NAME: "a" },
        }),
      ).toThrow(/HERDR_PANE_ID/);
    });

    it("throws when herdr CLI exits non-zero, surfacing the error message", () => {
      mockExecCommand.mockReturnValue({
        stdout: "",
        stderr: JSON.stringify({ error: { code: "no_such_pane", message: "pane not found" } }),
        status: 1,
      });
      expect(() =>
        adapter.spawn({
          name: "a",
          cwd: "/tmp",
          command: "pi",
          env: { PI_TEAM_NAME: "t", PI_AGENT_NAME: "a" },
        }),
      ).toThrow(/pane not found/);
    });
  });

  describe("kill", () => {
    it("calls pane close for valid herdr pane ids", () => {
      mockExecCommand.mockReturnValue({
        stdout: JSON.stringify({ result: {} }),
        stderr: "",
        status: 0,
      });
      adapter.kill("w_abc-2");
      expect(mockExecCommand).toHaveBeenCalledWith("herdr", ["pane", "close", "w_abc-2"]);
    });

    it("does nothing for empty pane id", () => {
      adapter.kill("");
      expect(mockExecCommand).not.toHaveBeenCalled();
    });

    it("ignores tmux/iterm/zellij ids", () => {
      adapter.kill("%16");
      adapter.kill("iterm_abc");
      adapter.kill("zellij_xyz");
      expect(mockExecCommand).not.toHaveBeenCalled();
    });

    it("swallows errors (idempotent)", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "no such pane", status: 1 });
      expect(() => adapter.kill("w_abc-2")).not.toThrow();
    });
  });

  describe("isAlive", () => {
    it("returns true when pane get succeeds", () => {
      mockExecCommand.mockReturnValue({
        stdout: JSON.stringify({
          result: { pane: { pane_id: "w_abc-2", workspace_id: "w_abc", tab_id: "w_abc:1" } },
        }),
        stderr: "",
        status: 0,
      });
      expect(adapter.isAlive("w_abc-2")).toBe(true);
    });

    it("returns false when pane get fails", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "not found", status: 1 });
      expect(adapter.isAlive("w_abc-2")).toBe(false);
    });

    it("returns false for foreign pane ids without calling herdr", () => {
      expect(adapter.isAlive("%16")).toBe(false);
      expect(adapter.isAlive("iterm_abc")).toBe(false);
      expect(mockExecCommand).not.toHaveBeenCalled();
    });
  });

  describe("setTitle", () => {
    it("renames the current pane", () => {
      mockExecCommand.mockReturnValue({
        stdout: JSON.stringify({ result: {} }),
        stderr: "",
        status: 0,
      });
      adapter.setTitle("team: agent-1");
      expect(mockExecCommand).toHaveBeenCalledWith(
        "herdr",
        ["pane", "rename", "w_abc-1", "team: agent-1"],
      );
    });

    it("no-ops if title is empty", () => {
      adapter.setTitle("");
      expect(mockExecCommand).not.toHaveBeenCalled();
    });
  });

  describe("spawnWindow", () => {
    it("creates a workspace and runs the command in its root pane", () => {
      mockExecCommand.mockImplementation((_bin: string, args: string[]) => {
        if (args[0] === "workspace" && args[1] === "create") {
          return {
            stdout: JSON.stringify({
              result: {
                workspace: { workspace_id: "w_new", label: "team-1" },
                root_pane: { pane_id: "w_new-1", workspace_id: "w_new", tab_id: "w_new:1" },
              },
            }),
            stderr: "",
            status: 0,
          };
        }
        if (args[0] === "pane" && args[1] === "run") {
          return {
            stdout: JSON.stringify({ result: {} }),
            stderr: "",
            status: 0,
          };
        }
        return { stdout: "", stderr: "", status: 0 };
      });

      const wsId = adapter.spawnWindow({
        name: "agent-1",
        cwd: "/tmp/project",
        command: "pi --model x/y",
        env: { PI_TEAM_NAME: "team-1", PI_AGENT_NAME: "agent-1" },
        teamName: "team-1",
      });

      expect(wsId).toBe("w_new");
      expect(mockExecCommand).toHaveBeenCalledWith(
        "herdr",
        ["workspace", "create", "--no-focus", "--cwd", "/tmp/project", "--label", "team-1"],
      );
      expect(mockExecCommand).toHaveBeenCalledWith(
        "herdr",
        ["pane", "run", "w_new-1", "PI_TEAM_NAME=team-1 PI_AGENT_NAME=agent-1 pi --model x/y"],
      );
    });

    it("falls back to pane list when root_pane is missing", () => {
      let callIndex = 0;
      mockExecCommand.mockImplementation((_bin: string, args: string[]) => {
        callIndex++;
        if (args[0] === "workspace" && args[1] === "create") {
          return {
            stdout: JSON.stringify({
              result: { workspace: { workspace_id: "w_new", label: "agent-1" } },
            }),
            stderr: "",
            status: 0,
          };
        }
        if (args[0] === "pane" && args[1] === "list") {
          return {
            stdout: JSON.stringify({
              result: { panes: [{ pane_id: "w_new-1", workspace_id: "w_new", tab_id: "w_new:1" }] },
            }),
            stderr: "",
            status: 0,
          };
        }
        return { stdout: JSON.stringify({ result: {} }), stderr: "", status: 0 };
      });

      const wsId = adapter.spawnWindow({
        name: "agent-1",
        cwd: "/tmp",
        command: "pi",
        env: { PI_TEAM_NAME: "t", PI_AGENT_NAME: "a" },
      });

      expect(wsId).toBe("w_new");
      expect(mockExecCommand).toHaveBeenCalledWith(
        "herdr",
        ["pane", "list", "--workspace", "w_new"],
      );
    });
  });

  describe("killWindow / isWindowAlive / setWindowTitle", () => {
    it("killWindow calls workspace close", () => {
      mockExecCommand.mockReturnValue({
        stdout: JSON.stringify({ result: {} }),
        stderr: "",
        status: 0,
      });
      adapter.killWindow("w_new");
      expect(mockExecCommand).toHaveBeenCalledWith("herdr", ["workspace", "close", "w_new"]);
    });

    it("isWindowAlive returns true on workspace get success", () => {
      mockExecCommand.mockReturnValue({
        stdout: JSON.stringify({ result: { workspace: { workspace_id: "w_new", label: "x" } } }),
        stderr: "",
        status: 0,
      });
      expect(adapter.isWindowAlive("w_new")).toBe(true);
    });

    it("isWindowAlive returns false on workspace get failure", () => {
      mockExecCommand.mockReturnValue({ stdout: "", stderr: "missing", status: 1 });
      expect(adapter.isWindowAlive("w_new")).toBe(false);
    });

    it("setWindowTitle renames the workspace", () => {
      mockExecCommand.mockReturnValue({
        stdout: JSON.stringify({ result: {} }),
        stderr: "",
        status: 0,
      });
      adapter.setWindowTitle("w_new", "team-x");
      expect(mockExecCommand).toHaveBeenCalledWith("herdr", ["workspace", "rename", "w_new", "team-x"]);
    });

    it("setWindowTitle no-ops on empty inputs", () => {
      adapter.setWindowTitle("", "x");
      adapter.setWindowTitle("w", "");
      expect(mockExecCommand).not.toHaveBeenCalled();
    });
  });

  describe("env var shell quoting", () => {
    it("quotes env values containing spaces or shell metacharacters", () => {
      mockExecCommand.mockImplementation((_bin: string, args: string[]) => {
        if (args[0] === "pane" && args[1] === "split") {
          return {
            stdout: JSON.stringify({
              result: { pane: { pane_id: "w_abc-2", workspace_id: "w_abc", tab_id: "w_abc:1" } },
            }),
            stderr: "",
            status: 0,
          };
        }
        return { stdout: JSON.stringify({ result: {} }), stderr: "", status: 0 };
      });

      adapter.spawn({
        name: "agent",
        cwd: "/tmp",
        command: "pi",
        env: { PI_TEAM_NAME: "team with spaces", PI_AGENT_NAME: "ag$ent" },
      });

      const runCall = mockExecCommand.mock.calls.find(
        (call: any[]) => call[1][0] === "pane" && call[1][1] === "run",
      );
      expect(runCall).toBeDefined();
      // PI_TEAM_NAME value contains spaces — must be quoted.
      expect(runCall![1][3]).toContain("PI_TEAM_NAME='team with spaces'");
      // PI_AGENT_NAME contains $ — must be quoted.
      expect(runCall![1][3]).toContain("PI_AGENT_NAME='ag$ent'");
    });
  });
});
