# pi-teams: Agent Guide 🤖

This guide explains how `pi-teams` transforms your single Pi agent into a coordinated team of specialists. It covers the roles, capabilities, and coordination patterns available to you as the **Team Lead**.

---

## 🎭 The Two Roles

In a `pi-teams` environment, there are two distinct types of agents:

### 1. The Team Lead (You)
The agent in your main terminal window. You are responsible for:
- **Strategy**: Creating the team and defining its goals.
- **Delegation**: Spawning teammates and assigning them specific roles.
- **Coordination**: Managing the shared task board and broadcasting updates.
- **Quality Control**: Reviewing plans and approving finished work.

### 2. Teammates (The Specialists)
Agents spawned in separate panes. They are designed for:
- **Focus**: Executing specific, isolated tasks (e.g., "Security Audit", "Frontend Refactor").
- **Parallelism**: Working on multiple parts of the project simultaneously.
- **Autonomy**: Checking their own inboxes, submitting plans, and reporting progress without constant hand-holding.

---

## 🛠 Capabilities

### 🚀 Specialist Spawning
You can create teammates with custom identities, models, and reasoning depths:
- **Custom Roles**: "Spawn a 'CSS Expert' to fix the layout shifts."
- **Model Selection**: Use `gpt-4o` for complex architecture and `haiku` for fast, repetitive tasks.
- **Thinking Levels**: Set thinking to `high` for deep reasoning or `off` for maximum speed.

### 📋 Shared Task Board
A centralized source of truth for the entire team:
- **Visibility**: Everyone can see the full task list and who owns what.
- **Status Tracking**: Tasks move through `pending` ➔ `planning` ➔ `in_progress` ➔ `completed`.
- **Ownership**: Assigning a task to a teammate automatically notifies them.

### 💬 Coordination & Messaging
Communication flows naturally between team members:
- **Direct Messaging**: Send specific instructions to one teammate.
- **Broadcasts**: Announce global changes (like API updates) to everyone at once.
- **Inbox Polling**: Teammates automatically "wake up" to check for new work every 30 seconds when idle.

### 🛡️ Plan Approval Mode
For critical changes, you can require teammates to submit a plan before they start:
1. Teammate analyzes the task and calls `task_submit_plan`.
2. You review the plan in the Lead pane.
3. You `approve` (to start work) or `reject` (with feedback for revision).

---

## 💡 Coordination Patterns

### Pattern 1: The "Parallel Sprint"
Use this when you have 3-4 independent features to build.
1. Create a team: `team_create({ team_name: "feature-sprint" })`
2. Spawn specialists for each feature.
3. Create tasks for each specialist.
4. Monitor progress while you work on the core architecture.

### Pattern 2: The "Safety First" Audit
Use this for refactoring or security work.
1. Spawn a teammate with `plan_mode_required: true`.
2. Assign the refactoring task.
3. Review their proposed changes before any code is touched.
4. Approve the plan to let them execute.

### Pattern 3: The "Quality Gate"
Use automated hooks to ensure standards.
1. Define a script at `.pi/team-hooks/task_completed.sh`.
2. When any teammate marks a task as `completed`, the hook runs (e.g., runs `npm test`).
3. If the hook fails, you'll know the work isn't ready.

---

## 🛑 When to Use pi-teams
- **Complex Projects**: Tasks that involve multiple files and logic layers.
- **Research & Execution**: One agent researches while another implements.
- **Parallel Testing**: Running different test suites in parallel.
- **Code Review**: Having one agent write code and another (specialized) agent review it.

## ⚠️ Best Practices
- **Isolation**: Give teammates tasks that don't overlap too much to avoid git conflicts.
- **Clear Prompts**: Be specific about the teammate's role and boundaries when spawning.
- **Check-ins**: Use `task_list` regularly to see the "big picture" of your team's progress.
