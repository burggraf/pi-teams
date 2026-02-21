# pi-teams 🚀

**pi-teams** turns your single Pi agent into a coordinated software engineering team. It allows you to spawn multiple "Teammate" agents in separate terminal panes that work autonomously, communicate with each other, and manage a shared task board—all mediated through **tmux**.

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

### 2. Spawn a Teammate
> **You:** "Spawn a teammate named 'security-bot' in the current folder. Tell them to scan for hardcoded API keys."

### 3. Assign a Task
> **You:** "Create a task for security-bot: 'Check the .env.example file for sensitive defaults' and set it to in_progress."

### 4. Check on Progress
> **You:** "How is the team doing? Check my inbox for any messages from security-bot."

### 5. Shut Down the Team
> **You:** "We're done. Shut down the team and close the panes."

---

## 🪟 Requirement: tmux

To show multiple agents on one screen, **pi-teams** requires `tmux` (a terminal multiplexer).

### 1. Install tmux
- **macOS**: `brew install tmux`
- **Linux**: `sudo apt install tmux`

### 2. How to run it
Before you start a team, you **must** be inside a tmux session. Simply type:
```bash
tmux
```
Then start `pi` inside that window.

### 3. Navigating Panes (Vanilla tmux)
When your screen splits into multiple agents, you use "Prefix" commands to move around. By default, the prefix is **`Ctrl+b`**.

- **Switch to next agent**: Press `Ctrl+b` then `o`.
- **Switch using arrows**: Press `Ctrl+b` then any **Arrow Key**.
- **How to Scroll**: Vanilla tmux does not use the mouse wheel by default.
    1. Press `Ctrl+b` then `[` to enter "Copy Mode".
    2. Use your **Arrow Keys** or **Page Up/Down** to scroll.
    3. Press `q` to exit scroll mode and go back to typing.

*Note: You can greatly improve this experience by enabling "mouse mode" in your `~/.tmux.conf` file.*

---

## 📜 Credits & Attribution

This project is a port of the excellent [claude-code-teams-mcp](https://github.com/cs50victor/claude-code-teams-mcp) by [cs50victor](https://github.com/cs50victor). 

We have adapted the original MCP coordination protocol to work natively as a **Pi Package**, adding features like auto-starting teammates, balanced vertical UI layouts, and automatic inbox polling to make the experience seamless for Pi users.

## 📄 License
MIT
