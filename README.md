# pi-teams 🚀

**pi-teams** turns your single Pi agent into a coordinated software engineering team. It allows you to spawn multiple "Teammate" agents in separate terminal panes that work autonomously, communicate with each other, and manage a shared task board—all mediated through **tmux**.

### 🖥️ pi-teams in Action

| iTerm2 | tmux | Zellij |
| :---: | :---: | :---: |
| <a href="iTerm2.png"><img src="iTerm2.png" width="300" alt="pi-teams in iTerm2"></a> | <a href="tmux.png"><img src="tmux.png" width="300" alt="pi-teams in tmux"></a> | <a href="zellij.png"><img src="zellij.png" width="300" alt="pi-teams in Zellij"></a> |

## 🛠 Installation

Open your Pi terminal and type:

```bash
pi install npm:pi-teams
```

---

## 🌟 What can it do?

- **Spawn Specialists**: Create agents like "Security Expert" or "Frontend Pro" to handle sub-tasks in parallel.
- **Shared Task Board**: Keep everyone on the same page with a persistent list of tasks and their status.
- **Agent Messaging**: Agents can send direct messages to each other and to you (the Team Lead) to report progress.
- **Broadcast Messaging**: Send a message to the entire team at once for global coordination.
- **Plan Approval Mode**: Require teammates to submit their implementation plans for lead approval before they touch any code.
- **Quality Gate Hooks**: Automated shell scripts can run when tasks are completed (e.g., to run tests or linting).
- **Autonomous Work**: Teammates automatically "wake up," read their instructions, and poll their inboxes for new work while idle.
- **Beautiful UI**: Optimized vertical splits in `tmux` with clear labels so you always know who is doing what.

---

## 💬 How to use it (Examples)

You don't need to learn complex code commands. Just talk to Pi in plain English!

### 1. Start a Team
> **You:** "Create a team named 'my-app-audit' for reviewing the codebase."

**Pro Tip:** You can also set a default model for the whole team!
> **You:** "Create a team named 'Research' and use 'gpt-4o' for everyone."

### 2. Spawn a Teammate
> **You:** "Spawn a teammate named 'security-bot' in the current folder. Tell them to scan for hardcoded API keys."

**Pro Tip:** You can specify a different model for a specific teammate!
> **You:** "Spawn a teammate named 'speed-bot' using 'haiku' to quickly run some benchmarks."

**New: Plan Approval Mode**
> **You:** "Spawn a teammate named 'refactor-bot' and require plan approval before they make any changes."

**Customize Teammate Model & Thinking**
> **You:** "Spawn a teammate named 'architect-bot' using 'gpt-4o' with 'high' thinking level for deep reasoning."
> **You:** "Spawn a teammate named 'frontend-dev' using 'haiku' with 'low' thinking level for quick iterations."
> **You:** "Spawn a teammate named 'code-reviewer' using 'gpt-4o' with 'medium' thinking level."

You can customize **both** the model and thinking level for each teammate independently:
- **Model**: Override team's default model for a specific teammate (e.g., `gpt-4o`, `haiku`, `glm-4.7`)
- **Thinking Level**: Balance speed vs. depth per teammate:
  - `off`: No thinking blocks (fastest)
  - `minimal`: Minimal reasoning overhead
  - `low`: Light reasoning for quick decisions
  - `medium`: Balanced reasoning (default for most work)
  - `high`: Extended reasoning for complex problems

This lets you build teams with varied capabilities—fast, lightweight teammates for simple tasks, and powerful, thoughtful teammates for complex work.

### 3. Assign a Task
> **You:** "Create a task for security-bot: 'Check the .env.example file for sensitive defaults' and set it to in_progress."

### 4. Submit and Evaluate a Plan
Teammates in `planning` mode will use `task_submit_plan`. As the lead, you can then:
> **You:** "Review refactor-bot's plan for task 5. If it looks good, approve it. If not, reject it with feedback on the test coverage."

### 5. Broadcast a Message
> **You:** "Broadcast to the entire team: 'The API endpoint has changed to /v2. Please update your work accordingly.'"

### 6. Automated Hooks
Add a script at `.pi/team-hooks/task_completed.sh` to run automated checks when any task is finished.
```bash
#!/bin/bash
# Example: Run tests when a task is completed
npm test
```

### 7. Inter-Agent Communication
> Teammates can also talk to each other! For example, a `frontend-bot` can message a `backend-bot` to coordinate on an API schema without your intervention.

### 6. Check on Progress
> **You:** "How is the team doing? List all tasks and check my inbox for any messages."

### 7. Shut Down the Team
> **You:** "We're done. Shut down the team and close the panes."

---

## 🛠 Available Tools

Pi automatically uses these tools when you give instructions like the examples above.

### Team Management
- `team_create`: Start a new team. (Optional: `default_model`)
- `team_delete`: Delete a team and its data.
- `read_config`: Get details about the team and its members.

### Teammates
- `spawn_teammate`: Launch a new agent into a `tmux` pane with a role and instructions. (Optional: `model`, `thinking`, `plan_mode_required`)
  - **`model`**: Specify which AI model this teammate should use (e.g., `gpt-4o`, `haiku`, `glm-4.7`, `glm-5`). If not specified, uses the team's default model. You can mix different models across teammates for cost/performance optimization.
  - **`thinking`**: Set the agent's thinking level (`off`, `minimal`, `low`, `medium`, `high`). This controls how much time the agent spends reasoning before responding. If not specified, inherited from team/global settings. Different teammates can have different thinking levels.
  - **`plan_mode_required`**: If true, teammate must submit plans for lead approval before making code changes
- `check_teammate`: See if a teammate is still running or has unread messages.
- `force_kill_teammate`: Stop a teammate and remove them from the team.
- `process_shutdown_approved`: Orderly shutdown for a finished teammate.

### Task Management
- `task_create`: Create a new task.
- `task_list`: List all tasks and their current status.
- `task_get`: Get full details of a specific task.
- `task_update`: Update a task's status (pending, planning, in_progress, etc.) or owner.

### Messaging
- `send_message`: Send a message to a teammate or lead.
- `broadcast_message`: Send a message to the entire team.
- `read_inbox`: Read incoming messages for an agent.

### Task Planning & Approval
- `task_submit_plan`: For teammates to submit their implementation plans.
- `task_evaluate_plan`: For the lead to approve or reject a plan (with feedback).

---

## 🤖 Automated Behavior

- **Initial Greeting**: When a teammate is spawned, they will automatically send a message saying they've started and are checking their inbox.
- **Idle Polling**: Teammates check for new messages every 30 seconds if they are idle.
- **Automated Hooks**: If `.pi/team-hooks/task_completed.sh` exists, it will automatically execute whenever a task status is changed to `completed`.
- **Context Injection**: Each teammate is given a custom system prompt that defines their role and instructions for the team environment.

---

## 📂 Configuration & Data

All team and task data is stored in your home directory:
`~/.pi/teams/` and `~/.pi/tasks/`

You can manually inspect these JSON files if you ever need to debug your team's configuration or message history.

---

## 🪟 Terminal Requirements: tmux, Zellij, or iTerm2

To show multiple agents on one screen, **pi-teams** requires a way to manage terminal panes. It supports **tmux**, **Zellij**, and **iTerm2** (macOS).

### Option 1: tmux (Recommended)

#### 1. Install tmux
- **macOS**: `brew install tmux`
- **Linux**: `sudo apt install tmux`

#### 2. How to run it
Before you start a team, you **must** be inside a tmux session. Simply type:
```bash
tmux
```
Then start `pi` inside that window.

### Option 2: Zellij

If you prefer **Zellij**, simply start `pi` inside a Zellij session. **pi-teams** will detect it via the `ZELLIJ` environment variable and use `zellij run` to spawn teammates in new panes.

### Option 3: iTerm2 (macOS)

If you are using **iTerm2** on macOS and are *not* inside tmux or Zellij, **pi-teams** will use AppleScript to automatically split your current window into an optimized layout (1 large Lead pane on the left, Teammates stacked on the right). It will also name the panes with the teammate's agent name for easy identification.

---

## 📜 Credits & Attribution

This project is a port of the excellent [claude-code-teams-mcp](https://github.com/cs50victor/claude-code-teams-mcp) by [cs50victor](https://github.com/cs50victor). 

We have adapted the original MCP coordination protocol to work natively as a **Pi Package**, adding features like auto-starting teammates, balanced vertical UI layouts, and automatic inbox polling to make the experience seamless for Pi users.

## 📄 License
MIT
