# pi-teams Core Features Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Implement Plan Approval Mode, Broadcast Messaging, and Quality Gate Hooks for the `pi-teams` repository to achieve functional parity with Claude Code Agent Teams.

**Architecture:**
-   **Plan Approval**: Add a `planning` status to `TaskFile.status`. Create `task_submit_plan` and `task_evaluate_plan` tools. Lead can approve/reject.
-   **Broadcast Messaging**: Add a `broadcast_message` tool that iterates through the team roster in `config.json` and sends messages to all active members.
-   **Quality Gate Hooks**: Introduce a simple hook system that triggers on `task_update` (specifically when status becomes `completed`). For now, it will look for a `.pi/hooks/task_completed.sh` or similar.

**Tech Stack:** Node.js, TypeScript, Vitest

---

## Phase 1: Plan Approval Mode

### Task 1: Update Task Models and Statuses
**Files:**
-   Modify: `src/utils/models.ts`

**Step 1: Add `planning` to `TaskFile.status` and add `plan` field**
```typescript
export interface TaskFile {
  id: string;
  subject: string;
  description: string;
  activeForm?: string;
  status: "pending" | "in_progress" | "planning" | "completed" | "deleted";
  blocks: string[];
  blockedBy: string[];
  owner?: string;
  plan?: string;
  planFeedback?: string;
  metadata?: Record<string, any>;
}
```

**Step 2: Commit**
```bash
git add src/utils/models.ts
git commit -m "feat: add planning status to TaskFile"
```

### Task 2: Implement Plan Submission Tool
**Files:**
-   Modify: `src/utils/tasks.ts`
-   Test: `src/utils/tasks.test.ts`

**Step 1: Write test for `submitPlan`**
```typescript
it("should update task status to planning and save plan", async () => {
  const task = await createTask("test-team", "Task 1", "Desc");
  const updated = await submitPlan("test-team", task.id, "My Plan");
  expect(updated.status).toBe("planning");
  expect(updated.plan).toBe("My Plan");
});
```

**Step 2: Implement `submitPlan` in `tasks.ts`**
```typescript
export async function submitPlan(teamName: string, taskId: string, plan: string): Promise<TaskFile> {
  return await updateTask(teamName, taskId, { status: "planning", plan });
}
```

**Step 3: Run tests**
```bash
npx vitest run src/utils/tasks.test.ts
```

**Step 4: Commit**
```bash
git add src/utils/tasks.ts src/utils/tasks.test.ts
git commit -m "feat: implement submitPlan tool"
```

### Task 3: Implement Plan Evaluation Tool (Approve/Reject)
**Files:**
-   Modify: `src/utils/tasks.ts`
-   Test: `src/utils/tasks.test.ts`

**Step 1: Write test for `evaluatePlan`**
```typescript
it("should set status to in_progress on approval", async () => {
  const task = await createTask("test-team", "Task 1", "Desc");
  await submitPlan("test-team", task.id, "My Plan");
  const approved = await evaluatePlan("test-team", task.id, "approve");
  expect(approved.status).toBe("in_progress");
});

it("should set status back to in_progress or pending on reject with feedback", async () => {
  const task = await createTask("test-team", "Task 1", "Desc");
  await submitPlan("test-team", task.id, "My Plan");
  const rejected = await evaluatePlan("test-team", task.id, "reject", "More detail needed");
  expect(rejected.status).toBe("in_progress"); // Teammate stays in implementation but needs to revise
  expect(rejected.planFeedback).toBe("More detail needed");
});
```

**Step 2: Implement `evaluatePlan` in `tasks.ts`**
```typescript
export async function evaluatePlan(
  teamName: string, 
  taskId: string, 
  action: "approve" | "reject", 
  feedback?: string
): Promise<TaskFile> {
  const status = action === "approve" ? "in_progress" : "in_progress"; // Simplified for now
  return await updateTask(teamName, taskId, { status, planFeedback: feedback });
}
```

**Step 3: Run tests and commit**
```bash
npx vitest run src/utils/tasks.test.ts
git add src/utils/tasks.ts
git commit -m "feat: implement evaluatePlan tool"
```

---

## Phase 2: Broadcast Messaging

### Task 4: Implement Broadcast Messaging Tool
**Files:**
-   Modify: `src/utils/messaging.ts`
-   Test: `src/utils/messaging.test.ts`

**Step 1: Write test for `broadcastMessage`**
```typescript
it("should send message to all team members except sender", async () => {
  // setup team with lead, m1, m2
  await broadcastMessage("test-team", "team-lead", "Hello everyone!", "Broadcast");
  // verify m1 and m2 inboxes have the message
});
```

**Step 2: Implement `broadcastMessage`**
```typescript
import { readConfig } from "./teams";

export async function broadcastMessage(
  teamName: string,
  fromName: string,
  text: string,
  summary: string,
  color?: string
) {
  const config = await readConfig(teamName);
  for (const member of config.members) {
    if (member.name !== fromName) {
      await sendPlainMessage(teamName, fromName, member.name, text, summary, color);
    }
  }
}
```

**Step 3: Run tests and commit**
```bash
npx vitest run src/utils/messaging.test.ts
git add src/utils/messaging.ts
git commit -m "feat: implement broadcastMessage tool"
```

---

## Phase 3: Quality Gate Hooks

### Task 5: Implement Simple Hook System for Task Completion
**Files:**
-   Modify: `src/utils/tasks.ts`
-   Create: `src/utils/hooks.ts`
-   Test: `src/utils/hooks.test.ts`

**Step 1: Create `hooks.ts` to run local hook scripts**
```typescript
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function runHook(teamName: string, hookName: string, payload: any): boolean {
  const hookPath = path.join(process.cwd(), ".pi", "hooks", `${hookName}.sh`);
  if (!fs.existsSync(hookPath)) return true; // No hook, success

  try {
    const payloadStr = JSON.stringify(payload);
    execSync(`sh ${hookPath} '${payloadStr}'`, { stdio: "inherit" });
    return true;
  } catch (e) {
    console.error(`Hook ${hookName} failed`, e);
    return false;
  }
}
```

**Step 2: Modify `updateTask` in `tasks.ts` to trigger hook**
```typescript
// in updateTask, after saving:
if (updates.status === "completed") {
  const success = runHook(teamName, "task_completed", updated);
  if (!success) {
    // Optionally revert or mark as failed
  }
}
```

**Step 3: Write test and verify**
```bash
npx vitest run src/utils/hooks.test.ts
git add src/utils/tasks.ts src/utils/hooks.ts
git commit -m "feat: implement basic hook system for task completion"
```

---

## Phase 4: Expose New Tools to Agents

### Task 6: Expose Tools in extensions/index.ts
**Files:**
-   Modify: `extensions/index.ts`

**Step 1: Add `broadcast_message`, `task_submit_plan`, and `task_evaluate_plan` tools**
**Step 2: Update `spawn_teammate` to include `plan_mode_required`**
**Step 3: Update `task_update` to allow `planning` status**
