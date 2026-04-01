/**
 * Git Worktree Utilities
 *
 * Creates and manages git worktrees for team-based workflows.
 * Adapted from pi-cmux's git-core.ts for synchronous pi-teams usage.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const GIT_TIMEOUT_MS = 10000;

interface GitExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

interface WorktreeInfo {
  path: string;
  branch?: string;
}

function execGit(cwd: string, args: string[]): GitExecResult {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: GIT_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
  };
}

function parseWorktreeList(text: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  let current: WorktreeInfo | undefined;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("worktree ")) {
      if (current) worktrees.push(current);
      current = { path: line.slice("worktree ".length).trim() };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).trim().replace(/^refs\/heads\//, "") || undefined;
      continue;
    }
    if (line.length === 0) {
      worktrees.push(current);
      current = undefined;
    }
  }
  if (current) worktrees.push(current);
  return worktrees;
}

function slugifyBranch(branch: string): string {
  return branch
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "worktree";
}

/**
 * Get the git repo root for a directory, or null if not in a repo.
 */
export function getRepoRoot(cwd: string): string | null {
  const result = execGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (!result.ok) return null;
  const root = result.stdout.trim();
  return root || null;
}

/**
 * Get the current branch name.
 */
export function getCurrentBranch(cwd: string): string | null {
  const result = execGit(cwd, ["branch", "--show-current"]);
  if (!result.ok) return null;
  return result.stdout.trim() || null;
}

/**
 * Check if a local branch exists.
 */
export function branchExists(repoRoot: string, branch: string): boolean {
  const result = execGit(repoRoot, ["show-ref", "--verify", "--", `refs/heads/${branch}`]);
  return result.ok;
}

/**
 * List all worktrees for the repo.
 */
export function listWorktrees(repoRoot: string): WorktreeInfo[] {
  const result = execGit(repoRoot, ["worktree", "list", "--porcelain"]);
  if (!result.ok) return [];
  return parseWorktreeList(result.stdout);
}

/**
 * Create a new branch worktree.
 *
 * Creates a new git branch from `fromRef` (default: HEAD) and checks it out
 * in a worktree directory adjacent to the repo.
 *
 * Layout: ../project-worktrees/branch-slug/
 */
export function createWorktree(
  repoRoot: string,
  branch: string,
  fromRef?: string,
): { ok: true; path: string; reused: boolean } | { ok: false; error: string } {
  // Check if branch already exists
  if (branchExists(repoRoot, branch)) {
    // Branch exists — try to find an existing worktree for it
    const existing = listWorktrees(repoRoot).find(w => w.branch === branch);
    if (existing) {
      return { ok: true, path: existing.path, reused: true };
    }

    // Branch exists but no worktree — check it out into a new worktree
    const worktreeRoot = join(dirname(repoRoot), `${basename(repoRoot)}-worktrees`);
    const targetPath = join(worktreeRoot, slugifyBranch(branch));

    if (existsSync(targetPath)) {
      return { ok: false, error: `Worktree path already exists: ${targetPath}` };
    }

    mkdirSync(worktreeRoot, { recursive: true });
    const addResult = execGit(repoRoot, ["worktree", "add", targetPath, branch]);
    if (!addResult.ok) {
      return { ok: false, error: addResult.stderr || `Failed to create worktree for branch ${branch}` };
    }
    return { ok: true, path: targetPath, reused: false };
  }

  // Branch doesn't exist — create it
  const worktreeRoot = join(dirname(repoRoot), `${basename(repoRoot)}-worktrees`);
  const targetPath = join(worktreeRoot, slugifyBranch(branch));

  if (existsSync(targetPath)) {
    return { ok: false, error: `Worktree path already exists: ${targetPath}` };
  }

  mkdirSync(worktreeRoot, { recursive: true });
  const args = ["worktree", "add", "-b", branch, targetPath];
  if (fromRef?.trim()) {
    args.push(fromRef.trim());
  }
  const addResult = execGit(repoRoot, args);
  if (!addResult.ok) {
    return { ok: false, error: addResult.stderr || `Failed to create worktree for branch ${branch}` };
  }
  return { ok: true, path: targetPath, reused: false };
}

/**
 * Remove a worktree by path.
 */
export function removeWorktree(repoRoot: string, worktreePath: string): { ok: boolean; error?: string } {
  const result = execGit(repoRoot, ["worktree", "remove", worktreePath, "--force"]);
  if (!result.ok) {
    return { ok: false, error: result.stderr || `Failed to remove worktree at ${worktreePath}` };
  }
  return { ok: true };
}
