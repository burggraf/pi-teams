import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Represents an agent definition from a .md file
 */
export interface AgentDefinition {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high";
  prompt: string;
  filePath: string;
}

/**
 * Represents a predefined team from teams.yaml
 */
export interface PredefinedTeam {
  name: string;
  agents: string[];
  description?: string;
}

/**
 * Parse frontmatter from a markdown file
 */
export function parseAgentFrontmatter(content: string, filePath: string): AgentDefinition | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatterStr = frontmatterMatch[1];
  const prompt = frontmatterMatch[2].trim();
  const frontmatter: Record<string, string> = {};

  // Parse YAML-like frontmatter (simple key: value format)
  for (const line of frontmatterStr.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  }

  const name = frontmatter.name;
  if (!name) {
    return null;
  }

  const description = frontmatter.description || "";
  
  // Parse tools (comma-separated or space-separated)
  let tools: string[] | undefined;
  if (frontmatter.tools) {
    tools = frontmatter.tools.split(/[,\s]+/).map(t => t.trim()).filter(t => t);
  }

  const thinking = frontmatter.thinking as AgentDefinition["thinking"];
  const model = frontmatter.model;

  return {
    name,
    description,
    tools,
    model,
    thinking,
    prompt,
    filePath,
  };
}

/**
 * Discover agent definitions from a directory
 */
export function discoverAgents(dir: string): AgentDefinition[] {
  const agents: AgentDefinition[] = [];

  if (!fs.existsSync(dir)) {
    return agents;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name.endsWith(".md")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const agent = parseAgentFrontmatter(content, fullPath);
      if (agent) {
        agents.push(agent);
      }
    } else if (entry.isDirectory()) {
      // Check for SKILL.md style (agent-name/SKILL.md)
      const skillPath = path.join(fullPath, "SKILL.md");
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, "utf-8");
        const agent = parseAgentFrontmatter(content, skillPath);
        if (agent) {
          agents.push(agent);
        }
      }
    }
  }

  return agents;
}

/**
 * Parse teams.yaml content into PredefinedTeam array
 */
export function parseTeamsYaml(content: string): PredefinedTeam[] {
  const teams: PredefinedTeam[] = [];
  const lines = content.split("\n");
  let currentTeam: PredefinedTeam | null = null;

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    // Check for team definition (no leading spaces, ends with colon)
    if (!line.startsWith(" ") && !line.startsWith("\t") && line.endsWith(":")) {
      // Save previous team
      if (currentTeam && currentTeam.agents.length > 0) {
        teams.push(currentTeam);
      }
      currentTeam = {
        name: line.slice(0, -1).trim(),
        agents: [],
      };
    } else if (currentTeam && (line.startsWith("  ") || line.startsWith("\t"))) {
      // Agent entry (indented line starting with -)
      const agentMatch = line.match(/^\s*-\s*(.+)$/);
      if (agentMatch) {
        currentTeam.agents.push(agentMatch[1].trim());
      }
    }
  }

  // Save last team
  if (currentTeam && currentTeam.agents.length > 0) {
    teams.push(currentTeam);
  }

  return teams;
}

/**
 * Discover predefined teams from teams.yaml files
 */
export function discoverTeams(dir: string): PredefinedTeam[] {
  const teamsPath = path.join(dir, "teams.yaml");
  
  if (!fs.existsSync(teamsPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(teamsPath, "utf-8");
    return parseTeamsYaml(content);
  } catch {
    return [];
  }
}

/**
 * Get all agent definitions from all locations
 * Priority: project-local > global
 */
export function getAllAgentDefinitions(projectDir?: string): AgentDefinition[] {
  const agents: AgentDefinition[] = [];
  const seenNames = new Set<string>();

  // Global agent definitions
  const globalDir = path.join(os.homedir(), ".pi", "agent", "agents");
  for (const agent of discoverAgents(globalDir)) {
    if (!seenNames.has(agent.name)) {
      seenNames.add(agent.name);
      agents.push(agent);
    }
  }

  // Project-local agent definitions
  if (projectDir) {
    const projectAgentsDir = path.join(projectDir, ".pi", "agents");
    for (const agent of discoverAgents(projectAgentsDir)) {
      if (!seenNames.has(agent.name)) {
        seenNames.add(agent.name);
        agents.push(agent);
      } else {
        // Override global with project-local
        const idx = agents.findIndex(a => a.name === agent.name);
        if (idx >= 0) {
          agents[idx] = agent;
        }
      }
    }
  }

  return agents;
}

/**
 * Get all predefined teams from all locations
 * Priority: project-local > global
 */
export function getAllPredefinedTeams(projectDir?: string): PredefinedTeam[] {
  const teams: PredefinedTeam[] = [];
  const seenNames = new Set<string>();

  // Global teams
  const globalDir = path.join(os.homedir(), ".pi", "agent");
  for (const team of discoverTeams(globalDir)) {
    if (!seenNames.has(team.name)) {
      seenNames.add(team.name);
      teams.push(team);
    }
  }

  // Project-local teams
  if (projectDir) {
    const projectDirPath = path.join(projectDir, ".pi");
    for (const team of discoverTeams(projectDirPath)) {
      if (!seenNames.has(team.name)) {
        seenNames.add(team.name);
        teams.push(team);
      } else {
        // Override global with project-local
        const idx = teams.findIndex(t => t.name === team.name);
        if (idx >= 0) {
          teams[idx] = team;
        }
      }
    }
  }

  return teams;
}

/**
 * Get a specific agent definition by name
 */
export function getAgentDefinition(name: string, projectDir?: string): AgentDefinition | undefined {
  const agents = getAllAgentDefinitions(projectDir);
  return agents.find(a => a.name === name);
}

/**
 * Get a specific predefined team by name
 */
export function getPredefinedTeam(name: string, projectDir?: string): PredefinedTeam | undefined {
  const teams = getAllPredefinedTeams(projectDir);
  return teams.find(t => t.name === name);
}