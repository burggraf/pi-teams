import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseAgentFrontmatter,
  parseTeamsYaml,
  discoverAgents,
  discoverTeams,
  getAllAgentDefinitions,
  getAllPredefinedTeams,
  getAgentDefinition,
  getPredefinedTeam,
} from "./predefined-teams";

describe("parseAgentFrontmatter", () => {
  it("parses a valid agent definition with all fields", () => {
    const content = `---
name: scout
description: Fast recon and codebase exploration
tools: read,grep,find,ls
model: claude-sonnet-4
thinking: high
---
You are a scout agent. Investigate the codebase quickly.`;

    const result = parseAgentFrontmatter(content, "/test/scout.md");
    
    expect(result).not.toBeNull();
    expect(result?.name).toBe("scout");
    expect(result?.description).toBe("Fast recon and codebase exploration");
    expect(result?.tools).toEqual(["read", "grep", "find", "ls"]);
    expect(result?.model).toBe("claude-sonnet-4");
    expect(result?.thinking).toBe("high");
    expect(result?.prompt).toBe("You are a scout agent. Investigate the codebase quickly.");
    expect(result?.filePath).toBe("/test/scout.md");
  });

  it("parses an agent definition with space-separated tools", () => {
    const content = `---
name: builder
description: Code builder
tools: read write edit bash
---
You build things.`;

    const result = parseAgentFrontmatter(content, "/test/builder.md");
    
    expect(result).not.toBeNull();
    expect(result?.tools).toEqual(["read", "write", "edit", "bash"]);
  });

  it("parses an agent definition without optional fields", () => {
    const content = `---
name: simple
description: Simple agent
---
You are simple.`;

    const result = parseAgentFrontmatter(content, "/test/simple.md");
    
    expect(result).not.toBeNull();
    expect(result?.name).toBe("simple");
    expect(result?.description).toBe("Simple agent");
    expect(result?.tools).toBeUndefined();
    expect(result?.model).toBeUndefined();
    expect(result?.thinking).toBeUndefined();
    expect(result?.prompt).toBe("You are simple.");
  });

  it("returns null for content without frontmatter", () => {
    const content = "This is just regular markdown without frontmatter.";
    const result = parseAgentFrontmatter(content, "/test/no-frontmatter.md");
    expect(result).toBeNull();
  });

  it("returns null for frontmatter without name", () => {
    const content = `---
description: Missing name field
---
Some prompt`;
    const result = parseAgentFrontmatter(content, "/test/no-name.md");
    expect(result).toBeNull();
  });
});

describe("parseTeamsYaml", () => {
  it("parses a valid teams.yaml content", () => {
    const content = `
full:
  - scout
  - planner
  - builder

plan-build:
  - planner
  - builder
  - reviewer
`;

    const result = parseTeamsYaml(content);
    
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("full");
    expect(result[0].agents).toEqual(["scout", "planner", "builder"]);
    expect(result[1].name).toBe("plan-build");
    expect(result[1].agents).toEqual(["planner", "builder", "reviewer"]);
  });

  it("handles comments and empty lines", () => {
    const content = `
# This is a comment
full:
  - scout
  # Another comment
  - planner

# Empty line above
minimal:
  - scout
`;

    const result = parseTeamsYaml(content);
    
    expect(result).toHaveLength(2);
    expect(result[0].agents).toEqual(["scout", "planner"]);
    expect(result[1].agents).toEqual(["scout"]);
  });

  it("returns empty array for empty content", () => {
    expect(parseTeamsYaml("")).toEqual([]);
    expect(parseTeamsYaml("# Just comments\n\n")).toEqual([]);
  });

  it("handles tab indentation", () => {
    const content = `
full:
\t- scout
\t- planner
`;

    const result = parseTeamsYaml(content);
    
    expect(result).toHaveLength(1);
    expect(result[0].agents).toEqual(["scout", "planner"]);
  });
});

describe("discoverAgents", () => {
  const testDir = path.join(os.tmpdir(), "pi-teams-test-agents-" + Date.now());

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it("discovers agent definitions from markdown files", () => {
    fs.writeFileSync(path.join(testDir, "scout.md"), `---
name: scout
description: Scout agent
---
Scout prompt`);

    fs.writeFileSync(path.join(testDir, "builder.md"), `---
name: builder
description: Builder agent
---
Builder prompt`);

    const result = discoverAgents(testDir);
    
    expect(result).toHaveLength(2);
    expect(result.find(a => a.name === "scout")).toBeDefined();
    expect(result.find(a => a.name === "builder")).toBeDefined();
  });

  it("discovers agents from SKILL.md in subdirectories", () => {
    const subDir = path.join(testDir, "special-agent");
    fs.mkdirSync(subDir, { recursive: true });
    
    fs.writeFileSync(path.join(subDir, "SKILL.md"), `---
name: special
description: Special agent
---
Special prompt`);

    const result = discoverAgents(testDir);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("special");
  });

  it("returns empty array for non-existent directory", () => {
    const result = discoverAgents("/non/existent/path");
    expect(result).toEqual([]);
  });

  it("ignores files without valid frontmatter", () => {
    fs.writeFileSync(path.join(testDir, "invalid.md"), "No frontmatter here");
    fs.writeFileSync(path.join(testDir, "valid.md"), `---
name: valid
description: Valid agent
---
Valid prompt`);

    const result = discoverAgents(testDir);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("valid");
  });
});

describe("discoverTeams", () => {
  const testDir = path.join(os.tmpdir(), "pi-teams-test-teams-" + Date.now());

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it("discovers teams from teams.yaml", () => {
    fs.writeFileSync(path.join(testDir, "teams.yaml"), `
full:
  - scout
  - planner
`);

    const result = discoverTeams(testDir);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("full");
    expect(result[0].agents).toEqual(["scout", "planner"]);
  });

  it("returns empty array when teams.yaml does not exist", () => {
    const result = discoverTeams(testDir);
    expect(result).toEqual([]);
  });
});

describe("getAllAgentDefinitions and getAllPredefinedTeams", () => {
  const globalDir = path.join(os.homedir(), ".pi", "agent", "agents");
  const globalTeamsDir = path.join(os.homedir(), ".pi", "agent");
  const projectDir = path.join(os.tmpdir(), "pi-teams-test-project-" + Date.now());
  const projectAgentsDir = path.join(projectDir, ".pi", "agents");
  const projectTeamsDir = path.join(projectDir, ".pi");

  // Store original files to restore later
  let originalGlobalAgents: string[] = [];
  let originalGlobalTeams: string | null = null;

  beforeEach(() => {
    // Create project directory
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true });
    }
    fs.mkdirSync(projectAgentsDir, { recursive: true });

    // Backup global files if they exist
    if (fs.existsSync(globalDir)) {
      originalGlobalAgents = fs.readdirSync(globalDir);
    }
    if (fs.existsSync(path.join(globalTeamsDir, "teams.yaml"))) {
      originalGlobalTeams = fs.readFileSync(path.join(globalTeamsDir, "teams.yaml"), "utf-8");
    }
  });

  afterEach(() => {
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true });
    }
  });

  it("combines global and project-local agents", () => {
    // Create project-local agent
    fs.writeFileSync(path.join(projectAgentsDir, "project-agent.md"), `---
name: project-agent
description: Project local agent
---
Project prompt`);

    const result = getAllAgentDefinitions(projectDir);
    
    // Should include project-local agent
    expect(result.find(a => a.name === "project-agent")).toBeDefined();
  });

  it("project-local agents override global agents", () => {
    // Create project-local agent with same name as global
    fs.writeFileSync(path.join(projectAgentsDir, "scout.md"), `---
name: scout
description: Project override scout
---
Project scout prompt`);

    const result = getAllAgentDefinitions(projectDir);
    const scout = result.find(a => a.name === "scout");
    
    expect(scout).toBeDefined();
    expect(scout?.description).toBe("Project override scout");
  });

  it("combines global and project-local teams", () => {
    // Create project-local teams.yaml
    fs.writeFileSync(path.join(projectTeamsDir, "teams.yaml"), `
custom:
  - agent1
  - agent2
`);

    const result = getAllPredefinedTeams(projectDir);
    
    // Should include project-local team
    expect(result.find(t => t.name === "custom")).toBeDefined();
    expect(result.find(t => t.name === "custom")?.agents).toEqual(["agent1", "agent2"]);
  });
});

describe("getAgentDefinition and getPredefinedTeam", () => {
  const projectDir = path.join(os.tmpdir(), "pi-teams-test-get-" + Date.now());
  const projectAgentsDir = path.join(projectDir, ".pi", "agents");
  const projectTeamsDir = path.join(projectDir, ".pi");

  beforeEach(() => {
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true });
    }
    fs.mkdirSync(projectAgentsDir, { recursive: true });

    fs.writeFileSync(path.join(projectAgentsDir, "test-agent.md"), `---
name: test-agent
description: Test agent
---
Test prompt`);

    fs.writeFileSync(path.join(projectTeamsDir, "teams.yaml"), `
test-team:
  - test-agent
`);
  });

  afterEach(() => {
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true });
    }
  });

  it("gets a specific agent definition by name", () => {
    const result = getAgentDefinition("test-agent", projectDir);
    
    expect(result).toBeDefined();
    expect(result?.name).toBe("test-agent");
    expect(result?.description).toBe("Test agent");
  });

  it("returns undefined for non-existent agent", () => {
    const result = getAgentDefinition("non-existent", projectDir);
    expect(result).toBeUndefined();
  });

  it("gets a specific predefined team by name", () => {
    const result = getPredefinedTeam("test-team", projectDir);
    
    expect(result).toBeDefined();
    expect(result?.name).toBe("test-team");
    expect(result?.agents).toEqual(["test-agent"]);
  });

  it("returns undefined for non-existent team", () => {
    const result = getPredefinedTeam("non-existent", projectDir);
    expect(result).toBeUndefined();
  });
});