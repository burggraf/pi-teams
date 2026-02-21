import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export const CLAUDE_DIR = path.join(os.homedir(), ".claude");
export const TEAMS_DIR = path.join(CLAUDE_DIR, "teams");
export const TASKS_DIR = path.join(CLAUDE_DIR, "tasks");

export function ensureDirs() {
  if (!fs.existsSync(CLAUDE_DIR)) fs.mkdirSync(CLAUDE_DIR);
  if (!fs.existsSync(TEAMS_DIR)) fs.mkdirSync(TEAMS_DIR);
  if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR);
}

export function sanitizeName(name: string): string {
  // Allow only alphanumeric characters, hyphens, and underscores.
  if (/[^a-zA-Z0-9_-]/.test(name)) {
    throw new Error(`Invalid name: "${name}". Only alphanumeric characters, hyphens, and underscores are allowed.`);
  }
  return name;
}

export function teamDir(teamName: string) {
  return path.join(TEAMS_DIR, sanitizeName(teamName));
}

export function taskDir(teamName: string) {
  return path.join(TASKS_DIR, sanitizeName(teamName));
}

export function inboxPath(teamName: string, agentName: string) {
  return path.join(teamDir(teamName), "inboxes", `${sanitizeName(agentName)}.json`);
}

export function configPath(teamName: string) {
  return path.join(teamDir(teamName), "config.json");
}
