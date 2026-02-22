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
    mockExecCommand = vi.spyOn(terminalAdapter, "execCommand");
    delete process.env.WEZTERM_PANE;
    delete process.env.TMUX;
    delete process.env.ZELLIJ;
    process.env.WEZTERM_PANE = "0";
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
      mockExecCommand.mockReturnValue({ stdout: "version 1.0", stderr: "", status: 0 });
      expect(adapter.detect()).toBe(true);
    });
  });

  describe("spawn", () => {
    it("should spawn first pane to the right with 50%", () => {
      // Mock getPanes finding only current pane
      mockExecCommand.mockImplementation((bin, args) => {
        if (args.includes("list")) {
          return { 
            stdout: JSON.stringify([{ pane_id: 0, tab_id: 0 }]), 
            stderr: "", 
            status: 0 
          };
        }
        if (args.includes("split-pane")) {
          return { stdout: "1", stderr: "", status: 0 };
        }
        return { stdout: "", stderr: "", status: 0 };
      });

      const result = adapter.spawn({
        name: "test-agent",
        cwd: "/home/user/project",
        command: "pi --agent test",
        env: { PI_AGENT_ID: "test-123" },
      });

      expect(result).toBe("wezterm_1");
      expect(mockExecCommand).toHaveBeenCalledWith(
        expect.stringContaining("wezterm"),
        expect.arrayContaining(["cli", "split-pane", "--right", "--percent", "50"])
      );
    });

    it("should spawn subsequent panes by splitting the sidebar", () => {
      // Mock getPanes finding current pane (0) and sidebar pane (1)
      mockExecCommand.mockImplementation((bin, args) => {
        if (args.includes("list")) {
          return { 
            stdout: JSON.stringify([{ pane_id: 0, tab_id: 0 }, { pane_id: 1, tab_id: 0 }]), 
            stderr: "", 
            status: 0 
          };
        }
        if (args.includes("split-pane")) {
          return { stdout: "2", stderr: "", status: 0 };
        }
        return { stdout: "", stderr: "", status: 0 };
      });

      const result = adapter.spawn({
        name: "agent2",
        cwd: "/home/user/project",
        command: "pi",
        env: {},
      });

      expect(result).toBe("wezterm_2");
      // 1 sidebar pane already exists, so percent should be floor(100/(1+1)) = 50%
      expect(mockExecCommand).toHaveBeenCalledWith(
        expect.stringContaining("wezterm"),
        expect.arrayContaining(["cli", "split-pane", "--bottom", "--pane-id", "1", "--percent", "50"])
      );
    });
  });
});
