/**
 * Terminal Registry Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clearAdapterCache, getTerminalName } from "./terminal-registry";

const ENV_KEYS = [
  "HERDR_ENV",
  "HERDR_SOCKET_PATH",
  "HERDR_PANE_ID",
  "HERDR_TAB_ID",
  "HERDR_WORKSPACE_ID",
  "TMUX",
  "ZELLIJ",
  "CMUX_SOCKET_PATH",
  "CMUX_WORKSPACE_ID",
  "TERM_PROGRAM",
  "WEZTERM_PANE",
] as const;

describe("terminal registry", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    clearAdapterCache();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    clearAdapterCache();
  });

  it("selects Herdr when Herdr pane environment is present", () => {
    process.env.HERDR_ENV = "1";
    process.env.HERDR_SOCKET_PATH = "/tmp/herdr.sock";
    process.env.HERDR_PANE_ID = "w1:p1";

    expect(getTerminalName()).toBe("herdr");
  });

  it("keeps Herdr priority when tmux-like environment is also present", () => {
    process.env.HERDR_ENV = "1";
    process.env.HERDR_SOCKET_PATH = "/tmp/herdr.sock";
    process.env.HERDR_PANE_ID = "w1:p1";
    process.env.TMUX = "/tmp/tmux-1000/default,123,0";

    expect(getTerminalName()).toBe("herdr");
  });
});
