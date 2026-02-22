# pi-teams 🚀

**pi-teams** turns your single Pi agent into a coordinated software engineering team. It allows you to spawn multiple "Teammate" agents in separate terminal panes that work autonomously, communicate with each other, and manage a shared task board—all mediated through **tmux**.

<details>
<summary><b>View pi-teams in action (click to expand)</b></summary>

| iTerm2 | tmux | Zellij |
| :---: | :---: | :---: |
| <a href="iTerm2.png"><img src="iTerm2.png" width="300" alt="pi-teams in iTerm2"></a> | <a href="tmux.png"><img src="tmux.png" width="300" alt="pi-teams in tmux"></a> | <a href="zellij.png"><img src="zellij.png" width="300" alt="pi-teams in Zellij"></a> |

</details>

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

### 3. Assign a Task
> **You:** "Create a task for security-bot: 'Check the .env.example file for sensitive defaults' and set it to in_progress."

### 4. Send a Message
> **You:** "Tell security-bot to focus on the 'config/' directory first."
> *The lead agent uses `send_message` to put an instruction in the teammate's inbox.*

### 5. Inter-Agent Communication
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
- `spawn_teammate`: Launch a new agent into a `tmux` pane with a role and instructions. (Optional: `model`)
- `check_teammate`: See if a teammate is still running or has unread messages.
- `force_kill_teammate`: Stop a teammate and remove them from the team.
- `process_shutdown_approved`: Orderly shutdown for a finished teammate.

### Task Management
- `task_create`: Create a new task.
- `task_list`: List all tasks and their current status.
- `task_get`: Get full details of a specific task.
- `task_update`: Update a task's status or owner.

### Messaging
- `send_message`: Send a message to a teammate or lead.
- `read_inbox`: Read incoming messages for an agent.

---

## 🤖 Automated Behavior

- **Initial Greeting**: When a teammate is spawned, they will automatically send a message saying they've started and are checking their inbox.
- **Idle Polling**: Teammates check for new messages every 30 seconds if they are idle.
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
