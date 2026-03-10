/**
 * Tmux Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TmuxAdapter } from "./tmux-adapter";
import * as terminalAdapter from "../utils/terminal-adapter";

describe("TmuxAdapter", () => {
  let adapter: TmuxAdapter;
  let mockExecCommand: ReturnType<typeof vi.spyOn>;
  const originalTmux = process.env.TMUX;
  const originalTmuxPane = process.env.TMUX_PANE;

  beforeEach(() => {
    adapter = new TmuxAdapter();
    mockExecCommand = vi.spyOn(terminalAdapter, "execCommand");
    process.env.TMUX = "/tmp/tmux-1000/default,123,0";
    process.env.TMUX_PANE = "%16";
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalTmux === undefined) delete process.env.TMUX;
    else process.env.TMUX = originalTmux;

    if (originalTmuxPane === undefined) delete process.env.TMUX_PANE;
    else process.env.TMUX_PANE = originalTmuxPane;
  });

  it("should have the correct name", () => {
    expect(adapter.name).toBe("tmux");
  });

  it("should detect tmux when TMUX is set", () => {
    expect(adapter.detect()).toBe(true);
  });

  it("should target the originating pane and its window when spawning", () => {
    mockExecCommand.mockImplementation((_bin: string, args: string[]) => {
      if (
        args[0] === "display-message" &&
        args[1] === "-p" &&
        args[2] === "-t" &&
        args[3] === "%16" &&
        args[4] === "#{pane_id}"
      ) {
        return { stdout: "%16", stderr: "", status: 0 };
      }

      if (args[0] === "split-window") {
        return { stdout: "%42", stderr: "", status: 0 };
      }

      if (
        args[0] === "display-message" &&
        args[1] === "-p" &&
        args[2] === "-t" &&
        args[3] === "%16" &&
        args[4] === "#{window_id}"
      ) {
        return { stdout: "@7", stderr: "", status: 0 };
      }

      return { stdout: "", stderr: "", status: 0 };
    });

    const paneId = adapter.spawn({
      name: "agent-1",
      cwd: "/tmp/project",
      command: "pi",
      env: { PI_TEAM_NAME: "team-1", PI_AGENT_NAME: "agent-1", OTHER: "ignored" },
    });

    expect(paneId).toBe("%42");
    expect(mockExecCommand).toHaveBeenCalledWith(
      "tmux",
      [
        "split-window",
        "-h", "-dP",
        "-F", "#{pane_id}",
        "-t", "%16",
        "-c", "/tmp/project",
        "env", "PI_TEAM_NAME=team-1", "PI_AGENT_NAME=agent-1",
        "sh", "-c", "pi",
      ]
    );
    expect(mockExecCommand).toHaveBeenCalledWith(
      "tmux",
      ["set-window-option", "-t", "@7", "main-pane-width", "60%"]
    );
    expect(mockExecCommand).toHaveBeenCalledWith(
      "tmux",
      ["select-layout", "-t", "@7", "main-vertical"]
    );
  });

  it("should prefer an explicit anchor pane when spawning", () => {
    mockExecCommand.mockImplementation((_bin: string, args: string[]) => {
      if (
        args[0] === "display-message" &&
        args[1] === "-p" &&
        args[2] === "-t" &&
        args[3] === "%3" &&
        args[4] === "#{pane_id}"
      ) {
        return { stdout: "%3", stderr: "", status: 0 };
      }

      if (args[0] === "split-window") {
        return { stdout: "%42", stderr: "", status: 0 };
      }

      if (
        args[0] === "display-message" &&
        args[1] === "-p" &&
        args[2] === "-t" &&
        args[3] === "%3" &&
        args[4] === "#{window_id}"
      ) {
        return { stdout: "@9", stderr: "", status: 0 };
      }

      return { stdout: "", stderr: "", status: 0 };
    });

    const paneId = adapter.spawn({
      name: "agent-1",
      cwd: "/tmp/project",
      command: "pi",
      env: { PI_TEAM_NAME: "team-1", PI_AGENT_NAME: "agent-1" },
      anchorPaneId: "%3",
    });

    expect(paneId).toBe("%42");
    expect(mockExecCommand).toHaveBeenCalledWith(
      "tmux",
      [
        "split-window",
        "-h", "-dP",
        "-F", "#{pane_id}",
        "-t", "%3",
        "-c", "/tmp/project",
        "env", "PI_TEAM_NAME=team-1", "PI_AGENT_NAME=agent-1",
        "sh", "-c", "pi",
      ]
    );
    expect(mockExecCommand).toHaveBeenCalledWith(
      "tmux",
      ["set-window-option", "-t", "@9", "main-pane-width", "60%"]
    );
    expect(mockExecCommand).toHaveBeenCalledWith(
      "tmux",
      ["select-layout", "-t", "@9", "main-vertical"]
    );
  });

  it("should fall back to the current pane when the explicit anchor is stale", () => {
    mockExecCommand.mockImplementation((_bin: string, args: string[]) => {
      if (
        args[0] === "display-message" &&
        args[1] === "-p" &&
        args[2] === "-t" &&
        args[3] === "%3" &&
        args[4] === "#{pane_id}"
      ) {
        return { stdout: "", stderr: "no such pane", status: 1 };
      }

      if (
        args[0] === "display-message" &&
        args[1] === "-p" &&
        args[2] === "-t" &&
        args[3] === "%16" &&
        args[4] === "#{pane_id}"
      ) {
        return { stdout: "%16", stderr: "", status: 0 };
      }

      if (args[0] === "split-window") {
        return { stdout: "%42", stderr: "", status: 0 };
      }

      if (
        args[0] === "display-message" &&
        args[1] === "-p" &&
        args[2] === "-t" &&
        args[3] === "%16" &&
        args[4] === "#{window_id}"
      ) {
        return { stdout: "@7", stderr: "", status: 0 };
      }

      return { stdout: "", stderr: "", status: 0 };
    });

    const paneId = adapter.spawn({
      name: "agent-1",
      cwd: "/tmp/project",
      command: "pi",
      env: { PI_TEAM_NAME: "team-1", PI_AGENT_NAME: "agent-1" },
      anchorPaneId: "%3",
    });

    expect(paneId).toBe("%42");
    expect(mockExecCommand).toHaveBeenCalledWith(
      "tmux",
      [
        "split-window",
        "-h", "-dP",
        "-F", "#{pane_id}",
        "-t", "%16",
        "-c", "/tmp/project",
        "env", "PI_TEAM_NAME=team-1", "PI_AGENT_NAME=agent-1",
        "sh", "-c", "pi",
      ]
    );
  });

  it("should target the current pane when setting the title", () => {
    mockExecCommand.mockReturnValue({ stdout: "", stderr: "", status: 0 });

    adapter.setTitle("team: agent-1");

    expect(mockExecCommand).toHaveBeenCalledWith(
      "tmux",
      ["select-pane", "-t", "%16", "-T", "team: agent-1"]
    );
  });
});
