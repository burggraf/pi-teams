import fs from "node:fs";
import path from "node:path";
import { TaskFile } from "./models";
import { taskDir, sanitizeName } from "./paths";
import { teamExists } from "./teams";
import { withLock } from "./lock";
import { runHook } from "./hooks";

export function getTaskId(teamName: string): string {
  const dir = taskDir(teamName);
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
  const ids = files.map(f => parseInt(path.parse(f).name, 10)).filter(id => !isNaN(id));
  return ids.length > 0 ? (Math.max(...ids) + 1).toString() : "1";
}

export async function createTask(
  teamName: string,
  subject: string,
  description: string,
  activeForm = "",
  metadata?: Record<string, any>
): Promise<TaskFile> {
  if (!subject || !subject.trim()) throw new Error("Task subject must not be empty");
  if (!teamExists(teamName)) throw new Error(`Team ${teamName} does not exist`);

  const dir = taskDir(teamName);
  const lockPath = dir;

  return await withLock(lockPath, async () => {
    const id = getTaskId(teamName);
    const task: TaskFile = {
      id,
      subject,
      description,
      activeForm,
      status: "pending",
      blocks: [],
      blockedBy: [],
      metadata,
    };
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(task, null, 2));
    return task;
  });
}

export async function updateTask(
  teamName: string,
  taskId: string,
  updates: Partial<TaskFile>,
  retries?: number
): Promise<TaskFile> {
  const dir = taskDir(teamName);
  const safeTaskId = sanitizeName(taskId);
  const p = path.join(dir, `${safeTaskId}.json`);

  return await withLock(p, async () => {
    if (!fs.existsSync(p)) throw new Error(`Task ${taskId} not found`);
    const task: TaskFile = JSON.parse(fs.readFileSync(p, "utf-8"));
    const updated = { ...task, ...updates };

    if (updates.status === "deleted") {
      fs.unlinkSync(p);
      return updated;
    }

    fs.writeFileSync(p, JSON.stringify(updated, null, 2));

    if (updates.status === "completed") {
      await runHook(teamName, "task_completed", updated);
    }

    return updated;
  }, retries);
}

/**
 * Submits a plan for a task, updating its status to "planning".
 * @param teamName The name of the team
 * @param taskId The ID of the task
 * @param plan The content of the plan
 * @returns The updated task
 */
export async function submitPlan(teamName: string, taskId: string, plan: string): Promise<TaskFile> {
  if (!plan || !plan.trim()) throw new Error("Plan must not be empty");
  return await updateTask(teamName, taskId, { status: "planning", plan });
}

/**
 * Evaluates a submitted plan for a task.
 * @param teamName The name of the team
 * @param taskId The ID of the task
 * @param action The evaluation action: "approve" or "reject"
 * @param feedback Optional feedback for the evaluation (required for rejection)
 * @param retries Number of times to retry acquiring the lock
 * @returns The updated task
 */
export async function evaluatePlan(
  teamName: string,
  taskId: string,
  action: "approve" | "reject",
  feedback?: string,
  retries?: number
): Promise<TaskFile> {
  const dir = taskDir(teamName);
  const safeTaskId = sanitizeName(taskId);
  const p = path.join(dir, `${safeTaskId}.json`);

  return await withLock(p, async () => {
    if (!fs.existsSync(p)) throw new Error(`Task ${taskId} not found`);
    const task: TaskFile = JSON.parse(fs.readFileSync(p, "utf-8"));

    // 1. Validate state: Only "planning" tasks can be evaluated
    if (task.status !== "planning") {
      throw new Error(
        `Cannot evaluate plan for task ${taskId} because its status is '${task.status}'. ` +
        `Tasks must be in 'planning' status to be evaluated.`
      );
    }

    // 2. Validate plan presence
    if (!task.plan || !task.plan.trim()) {
      throw new Error(`Cannot evaluate plan for task ${taskId} because no plan has been submitted.`);
    }

    // 3. Require feedback for rejections
    if (action === "reject" && (!feedback || !feedback.trim())) {
      throw new Error("Feedback is required when rejecting a plan.");
    }

    // 4. Perform update
    const updates: Partial<TaskFile> = action === "approve" 
      ? { status: "in_progress", planFeedback: "" }
      : { status: "planning", planFeedback: feedback };

    const updated = { ...task, ...updates };
    fs.writeFileSync(p, JSON.stringify(updated, null, 2));
    return updated;
  }, retries);
}

export async function readTask(teamName: string, taskId: string, retries?: number): Promise<TaskFile> {
  const dir = taskDir(teamName);
  const safeTaskId = sanitizeName(taskId);
  const p = path.join(dir, `${safeTaskId}.json`);
  if (!fs.existsSync(p)) throw new Error(`Task ${taskId} not found`);
  return await withLock(p, async () => {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  }, retries);
}

export async function listTasks(teamName: string): Promise<TaskFile[]> {
  const dir = taskDir(teamName);
  return await withLock(dir, async () => {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    const tasks: TaskFile[] = files
      .map(f => {
        const id = parseInt(path.parse(f).name, 10);
        if (isNaN(id)) return null;
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
      })
      .filter(t => t !== null);
    return tasks.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  });
}

export async function resetOwnerTasks(teamName: string, agentName: string) {
  const dir = taskDir(teamName);
  const lockPath = dir;

  await withLock(lockPath, async () => {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
    for (const f of files) {
      const p = path.join(dir, f);
      const task: TaskFile = JSON.parse(fs.readFileSync(p, "utf-8"));
      if (task.owner === agentName) {
        task.owner = undefined;
        if (task.status !== "completed") {
          task.status = "pending";
        }
        fs.writeFileSync(p, JSON.stringify(task, null, 2));
      }
    }
  });
}
