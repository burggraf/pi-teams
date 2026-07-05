/**
 * Herdr Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HerdrAdapter } from "./herdr-adapter";
import * as terminalAdapter from "../utils/terminal-adapter";

describe("HerdrAdapter", () => {
  let adapter: HerdrAdapter;
  let mockExecCommand: ReturnType<typeof vi.spyOn>;
  const originalEnv = {
    HERDR_ENV: process.env.HERDR_ENV,
    HERDR_SOCKET_PATH: process.env.HERDR_SOCKET_PATH,
    HERDR_PANE_ID: process.env.HERDR_PANE_ID,
    HERDR_TAB_ID: process.env.HERDR_TAB_ID,
    HERDR_WORKSPACE_ID: process.env.HERDR_WORKSPACE_ID,
    HERDR_BIN_PATH: process.env.HERDR_BIN_PATH,
  };

  beforeEach(() => {
    adapter = new HerdrAdapter();
    mockExecCommand = vi.spyOn(terminalAdapter, "execCommand");

    process.env.HERDR_ENV = "1";
    process.env.HERDR_SOCKET_PATH = "/tmp/herdr.sock";
    process.env.HERDR_PANE_ID = "w1:p1";
    process.env.HERDR_TAB_ID = "w1:t1";
    process.env.HERDR_WORKSPACE_ID = "w1";
    delete process.env.HERDR_BIN_PATH;
  });

  afterEach(() => {
    vi.restoreAllMocks();

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key as keyof typeof originalEnv];
      else process.env[key as keyof typeof originalEnv] = value;
    }
  });

  it("should have the correct name", () => {
    expect(adapter.name).toBe("herdr");
  });

  it("should detect Herdr when the Herdr pane environment is present", () => {
    expect(adapter.detect()).toBe(true);
  });

  it("should not detect when required Herdr variables are missing", () => {
    delete process.env.HERDR_PANE_ID;
    expect(adapter.detect()).toBe(false);
  });

  it("should spawn a teammate via herdr agent start and parse the pane ID", () => {
    mockExecCommand.mockReturnValue({
      stdout: JSON.stringify({
        id: "cli:agent:start",
        result: {
          type: "agent_started",
          agent: { pane_id: "w1:p2", tab_id: "w1:t1", workspace_id: "w1" },
        },
      }),
      stderr: "",
      status: 0,
    });

    const paneId = adapter.spawn({
      name: "agent-1",
      cwd: "/tmp/project",
      command: "pi --model test/model",
      env: {
        PI_TEAM_NAME: "team-1",
        PI_AGENT_NAME: "agent-1",
        HERDR_PANE_ID: "w1:p1",
        OTHER: "ignored",
      },
    });

    expect(paneId).toBe("w1:p2");
    expect(mockExecCommand).toHaveBeenCalledWith("herdr", ["pane", "get", "w1:p1"]);
    expect(mockExecCommand).toHaveBeenCalledWith("herdr", [
      "agent", "start", "agent-1",
      "--cwd", "/tmp/project",
      "--tab", "w1:t1",
      "--split", "right",
      "--no-focus",
      "--env", "PI_TEAM_NAME=team-1",
      "--env", "PI_AGENT_NAME=agent-1",
      "--",
      "sh", "-c", "pi --model test/model",
    ]);
  });

  it("should resolve placement from the current pane instead of inherited tab env", () => {
    process.env.HERDR_TAB_ID = "stale-tab";
    process.env.HERDR_WORKSPACE_ID = "stale-workspace";
    mockExecCommand
      .mockReturnValueOnce({
        stdout: JSON.stringify({ result: { pane: { pane_id: "w1:p1", tab_id: "w2:t3", workspace_id: "w2" } } }),
        stderr: "",
        status: 0,
      })
      .mockReturnValueOnce({
        stdout: JSON.stringify({ result: { agent: { pane_id: "w2:p4" } } }),
        stderr: "",
        status: 0,
      });

    adapter.spawn({
      name: "agent-1",
      cwd: "/tmp/project",
      command: "pi",
      env: { PI_TEAM_NAME: "team-1" },
    });

    expect(mockExecCommand).toHaveBeenNthCalledWith(1, "herdr", ["pane", "get", "w1:p1"]);
    expect(mockExecCommand).toHaveBeenNthCalledWith(2, "herdr", expect.arrayContaining([
      "--tab", "w2:t3",
    ]));
    expect(mockExecCommand.mock.calls[1][1]).not.toContain("stale-tab");
  });

  it("should fall back to workspace placement when pane lookup and tab env are unavailable", () => {
    delete process.env.HERDR_TAB_ID;
    mockExecCommand
      .mockReturnValueOnce({ stdout: "", stderr: "not found", status: 1 })
      .mockReturnValueOnce({
        stdout: JSON.stringify({ result: { agent: { pane_id: "w1:p3" } } }),
        stderr: "",
        status: 0,
      });

    adapter.spawn({
      name: "agent-1",
      cwd: "/tmp/project",
      command: "pi",
      env: { PI_TEAM_NAME: "team-1" },
    });

    expect(mockExecCommand).toHaveBeenNthCalledWith(2, "herdr", expect.arrayContaining([
      "--workspace", "w1",
    ]));
  });

  it("should throw when Herdr spawn fails", () => {
    mockExecCommand.mockReturnValue({ stdout: "", stderr: "boom", status: 1 });

    expect(() => adapter.spawn({
      name: "agent-1",
      cwd: "/tmp/project",
      command: "pi",
      env: {},
    })).toThrow(/herdr agent start failed/);
  });

  it("should close Herdr panes", () => {
    mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

    adapter.kill("w1:p2");

    expect(mockExecCommand).toHaveBeenCalledWith("herdr", ["pane", "close", "w1:p2"]);
  });

  it("should check whether Herdr panes are alive", () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "{}", stderr: "", status: 0 });
    expect(adapter.isAlive("w1:p2")).toBe(true);

    mockExecCommand.mockReturnValueOnce({ stdout: "", stderr: "not found", status: 1 });
    expect(adapter.isAlive("w1:p3")).toBe(false);
  });

  it("should rename the current Herdr pane when setting the title", () => {
    mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

    adapter.setTitle("team: agent-1");

    expect(mockExecCommand).toHaveBeenCalledWith("herdr", ["pane", "rename", "w1:p1", "team: agent-1"]);
  });

  it("should advertise separate-window support as Herdr tabs", () => {
    expect(adapter.supportsWindows()).toBe(true);
  });

  it("should spawn a teammate then move it into a new Herdr tab", () => {
    process.env.HERDR_TAB_ID = "stale-tab";
    process.env.HERDR_WORKSPACE_ID = "stale-workspace";

    mockExecCommand
      .mockReturnValueOnce({
        stdout: JSON.stringify({ result: { pane: { pane_id: "w1:p1", tab_id: "w1:t1", workspace_id: "w1" } } }),
        stderr: "",
        status: 0,
      })
      .mockReturnValueOnce({
        stdout: JSON.stringify({
          id: "cli:agent:start",
          result: { agent: { pane_id: "w1:p2", tab_id: "w1:t1", workspace_id: "w1" } },
        }),
        stderr: "",
        status: 0,
      })
      .mockReturnValueOnce({
        stdout: JSON.stringify({ result: { pane: { pane_id: "w1:p1", tab_id: "w1:t1", workspace_id: "w1" } } }),
        stderr: "",
        status: 0,
      })
      .mockReturnValueOnce({
        stdout: JSON.stringify({
          id: "cli:pane:move",
          result: {
            move_result: {
              created_tab: { tab_id: "w1:t2" },
              pane: { pane_id: "w1:p2", tab_id: "w1:t2" },
            },
          },
        }),
        stderr: "",
        status: 0,
      });

    const windowId = adapter.spawnWindow({
      name: "agent-1",
      cwd: "/tmp/project",
      command: "pi",
      env: { PI_TEAM_NAME: "team-1", PI_AGENT_NAME: "agent-1", HERDR_PANE_ID: "wrong" },
      teamName: "team-1",
    });

    expect(windowId).toBe("w1:t2");
    expect(mockExecCommand).toHaveBeenNthCalledWith(1, "herdr", ["pane", "get", "w1:p1"]);
    expect(mockExecCommand).toHaveBeenNthCalledWith(2, "herdr", [
      "agent", "start", "agent-1",
      "--cwd", "/tmp/project",
      "--tab", "w1:t1",
      "--split", "right",
      "--no-focus",
      "--env", "PI_TEAM_NAME=team-1",
      "--env", "PI_AGENT_NAME=agent-1",
      "--",
      "sh", "-c", "pi",
    ]);
    expect(mockExecCommand).toHaveBeenNthCalledWith(3, "herdr", ["pane", "get", "w1:p1"]);
    expect(mockExecCommand).toHaveBeenNthCalledWith(4, "herdr", [
      "pane", "move", "w1:p2",
      "--new-tab",
      "--workspace", "w1",
      "--label", "team-1: agent-1",
      "--no-focus",
    ]);
  });

  it("should close the spawned pane if moving it into a new tab fails", () => {
    mockExecCommand
      .mockReturnValueOnce({ stdout: "", stderr: "not found", status: 1 })
      .mockReturnValueOnce({
        stdout: JSON.stringify({ result: { agent: { pane_id: "w1:p2" } } }),
        stderr: "",
        status: 0,
      })
      .mockReturnValueOnce({ stdout: "", stderr: "not found", status: 1 })
      .mockReturnValueOnce({ stdout: "", stderr: "move failed", status: 1 })
      .mockReturnValueOnce({ stdout: "", stderr: "", status: 0 });

    expect(() => adapter.spawnWindow({
      name: "agent-1",
      cwd: "/tmp/project",
      command: "pi",
      env: {},
    })).toThrow(/herdr pane move failed/);

    expect(mockExecCommand).toHaveBeenLastCalledWith("herdr", ["pane", "close", "w1:p2"]);
  });

  it("should rename and close Herdr tab windows", () => {
    mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

    adapter.setWindowTitle("w1:t2", "team: agent-1");
    adapter.killWindow("w1:t2");

    expect(mockExecCommand).toHaveBeenNthCalledWith(1, "herdr", ["tab", "rename", "w1:t2", "team: agent-1"]);
    expect(mockExecCommand).toHaveBeenNthCalledWith(2, "herdr", ["tab", "close", "w1:t2"]);
  });

  it("should check whether Herdr tab windows are alive", () => {
    mockExecCommand.mockReturnValueOnce({ stdout: "{}", stderr: "", status: 0 });
    expect(adapter.isWindowAlive("w1:t2")).toBe(true);

    mockExecCommand.mockReturnValueOnce({ stdout: "", stderr: "not found", status: 1 });
    expect(adapter.isWindowAlive("w1:t3")).toBe(false);
  });
});
