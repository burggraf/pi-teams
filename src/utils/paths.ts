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

export function teamDir(teamName: string) {
  return path.join(TEAMS_DIR, teamName);
}

export function taskDir(teamName: string) {
  return path.join(TASKS_DIR, teamName);
}

export function inboxPath(teamName: string, agentName: string) {
  return path.join(teamDir(teamName), "inboxes", `${agentName}.json`);
}

export function configPath(teamName: string) {
  return path.join(teamDir(teamName), "config.json");
}
