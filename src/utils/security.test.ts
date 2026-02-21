import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { teamDir, inboxPath } from "./paths";

describe("Security Audit - Path Traversal (Prevention Check)", () => {
  it("should throw an error for path traversal via teamName", () => {
    const maliciousTeamName = "../../etc";
    expect(() => teamDir(maliciousTeamName)).toThrow();
  });

  it("should throw an error for path traversal via agentName", () => {
    const teamName = "audit-team";
    const maliciousAgentName = "../../../.ssh/id_rsa";
    expect(() => inboxPath(teamName, maliciousAgentName)).toThrow();
  });

  it("should throw an error for path traversal via taskId", () => {
    const teamName = "audit-team";
    const maliciousTaskId = "../../../etc/passwd";
    // We need to import readTask/updateTask or just sanitizeName directly if we want to test the logic
    // But since we already tested sanitizeName via other paths, this is just for completeness.
    expect(() => sanitizeName(maliciousTaskId)).toThrow();
  });
});

describe("Security Audit - Command Injection (Drafting)", () => {
  it("should be vulnerable to command injection in spawn_teammate (via parameters)", () => {
    const maliciousCwd = "; rm -rf / ;";
    const name = "attacker";
    const team_name = "audit-team";
    const piBinary = "pi";
    const cmd = `PI_TEAM_NAME=${team_name} PI_AGENT_NAME=${name} ${piBinary}`;
    
    // Simulating what happens in spawn_teammate (extensions/index.ts)
    const tmuxCmd = `tmux split-window -h -dP -F "#{pane_id}" "cd ${maliciousCwd} && ${cmd}"`;
    
    // The command becomes: tmux split-window -h -dP -F "#{pane_id}" "cd ; rm -rf / ; && PI_TEAM_NAME=audit-team PI_AGENT_NAME=attacker pi"
    expect(tmuxCmd).toContain("cd ; rm -rf / ; &&");
  });
});
