# pi-teams 🚀

**pi-teams** turns your single Pi agent into a coordinated software engineering team. It allows you to spawn multiple "Teammate" agents in separate terminal panes that work autonomously, communicate with each other, and manage a shared task board—all mediated through tmux, Zellij, iTerm2, WezTerm, or Windows Terminal.

### 🖥️ pi-teams in Action

| iTerm2 | tmux | Zellij |
| :---: | :---: | :---: |
| <a href="iTerm2.png"><img src="iTerm2.png" width="300" alt="pi-teams in iTerm2"></a> | <a href="tmux.png"><img src="tmux.png" width="300" alt="pi-teams in tmux"></a> | <a href="zellij.png"><img src="zellij.png" width="300" alt="pi-teams in Zellij"></a> |

*Also works with **WezTerm** and **Windows Terminal** (cross-platform support)*

## 🛠 Installation

Open your Pi terminal and type:

```bash
pi install npm:pi-teams
```

## 🚀 Quick Start

```bash
# 1. See available fully qualified models first
"List available models for team creation"

# 2. Start a team (inside tmux, Zellij, or iTerm2)
"Create a team named 'my-team' using 'openai-codex/gpt-5.4'"

# 3. Spawn teammates
"Spawn 'security-bot' to scan for vulnerabilities"
"Spawn 'frontend-dev' using 'claude-agent-sdk/claude-sonnet-4-6' for quick iterations"

# 4. Create and assign tasks
"Create a task for security-bot: 'Audit auth endpoints'"

# 5. Review and approve work
"List all tasks and approve any pending plans"
```

## 🌟 What can it do?

### Core Features
- **Spawn Specialists**: Create agents like "Security Expert" or "Frontend Pro" to handle sub-tasks in parallel.
- **Shared Task Board**: Keep everyone on the same page with a persistent list of tasks and their status.
- **Agent Messaging**: Agents can send direct messages to each other and to you (the Team Lead) to report progress.
- **Autonomous Work**: Teammates automatically "wake up," read their instructions, and poll their inboxes for new work while idle.
- **Beautiful UI**: Optimized vertical splits in `tmux` with clear labels so you always know who is doing what.

### Advanced Features
- **Predefined Teams**: Define team templates in `teams.yaml` and spawn entire teams with a single command.
- **Save Teams as Templates**: Convert any runtime team into a reusable template with a single command.
- **Isolated OS Windows**: Launch teammates in true separate OS windows instead of panes.
- **Persistent Window Titles**: Windows are automatically titled `[team-name]: [agent-name]` for easy identification in your window manager.
- **Plan Approval Mode**: Require teammates to submit their implementation plans for your approval before they touch any code.
- **Broadcast Messaging**: Send a message to the entire team at once for global coordination and announcements.
- **Quality Gate Hooks**: Automated shell scripts run when tasks are completed (e.g., to run tests or linting).
- **Thinking Level Control**: Set per-teammate thinking levels (`off`, `minimal`, `low`, `medium`, `high`) to balance speed vs. reasoning depth.

## 💬 Key Examples

### 1. Start a Team
> **You:** "List available models for team creation, then create a team named 'my-app-audit' using 'openai-codex/gpt-5.4' for reviewing the codebase."

**Set a default model for the whole team:**
> **You:** "List available models for team creation, then create a team named 'Research' using 'openai-codex/gpt-5.4' for everyone."

**Start a team in "Separate Windows" mode:**
> **You:** "Create a team named 'Dev' and open everyone in separate windows."
*(Supported in iTerm2 and WezTerm only)*

### 2. Spawn Teammate with Custom Settings
> **You:** "Spawn a teammate named 'security-bot' using 'openai-codex/gpt-5.4' in the current folder. Tell them to scan for hardcoded API keys."

**Spawn a specific teammate in a separate window:**
> **You:** "Spawn 'researcher' in a separate window."

**Move the Team Lead to a separate window:**
> **You:** "Open the team lead in its own window."
*(Requires separate_windows mode enabled or iTerm2/WezTerm)*

**Use a different model:**
> **You:** "List available models for team creation, then spawn a teammate named 'speed-bot' using 'claude-agent-sdk/claude-sonnet-4-6' to quickly run some benchmarks."

**Require plan approval:**
> **You:** "Spawn a teammate named 'refactor-bot' and require plan approval before they make any changes."

**Customize model and thinking level:**
> **You:** "List available models for team creation, then spawn a teammate named 'architect-bot' using 'openai-codex/gpt-5.4' with 'high' thinking level for deep reasoning."

**Explicit model selection:**
pi-teams does **not** auto-resolve bare model names like `gpt-5` or `haiku`.
When creating a new team or spawning teammates, use `list_available_models` first and then pass a fully qualified `provider/model` string.

If you provide a model that is not fully qualified or not available, pi-teams will fail fast and ask you to choose a valid model.

**Configuring model-list ordering:**
You can customize the order shown by `list_available_models` globally with `~/.pi/pi-teams.json` or per-project with `.pi/pi-teams.json`.
Project-local config overrides global config.

```json
{
  "providerPriority": [
    "openai-codex",
    "claude-agent-sdk",
    "kimi-coding"
  ]
}
```

- `providerPriority`: Controls the ordering shown by `list_available_models` after pi's preferred models are listed first.
- Preferred models themselves come from pi settings (`defaultProvider`, `defaultModel`, and `enabledModels`).

### 3. Assign Task & Get Approval
> **You:** "Create a task for security-bot: 'Check the .env.example file for sensitive defaults' and set it to in_progress."

Teammates in `planning` mode will use `task_submit_plan`. As the lead, review their work:
> **You:** "Review refactor-bot's plan for task 5. If it looks good, approve it. If not, reject it with feedback on the test coverage."

### 4. Broadcast to Team
> **You:** "Broadcast to the entire team: 'The API endpoint has changed to /v2. Please update your work accordingly.'"

### 5. Shut Down Team
> **You:** "We're done. Shut down the team and close the panes."

**Automatic Cleanup:**
When you shut down a team, pi-teams automatically cleans up orphaned agent session folders from `~/.pi/agent/teams/` that are older than 1 hour. This prevents accumulation of stale session data over time.

**Manual Cleanup:**
If you need to clean up agent sessions without shutting down a team, or want to use a different age threshold:
> **You:** "Clean up agent session folders older than 24 hours."

---

## 🏗️ Predefined Teams

Predefined teams let you define reusable team templates in a `teams.yaml` file. This is perfect for common workflows where you always want the same set of specialists.

### Define Team Templates

Create `~/.pi/teams.yaml` (global) or `.pi/teams.yaml` in your project:

```yaml
# Full development team
full:
  - scout
  - planner
  - builder
  - reviewer
  - documenter

# Quick plan-build cycle
plan-build:
  - planner
  - builder
  - reviewer

# Research and documentation
research:
  - scout
  - documenter

# Frontend specialists
frontend:
  - planner
  - builder
  - bowser
```

### Define Agent Definitions

Create agent definitions in `~/.pi/agent/agents/` (global) or `.pi/agents/` (project-local):

**scout.md:**
```markdown
---
name: scout
description: Fast recon and codebase exploration
tools: read,grep,find,ls
---
You are a scout agent. Investigate the codebase quickly and report findings concisely. Do NOT modify any files. Focus on structure, patterns, and key entry points.
```

**builder.md:**
```markdown
---
name: builder
description: Implementation specialist
tools: read,write,edit,bash
model: claude-agent-sdk/claude-sonnet-4-6
thinking: medium
---
You are a builder agent. Implement code following the plan provided. Write clean, tested code.
```

**Agent Definition Fields:**
- `name` (required): The agent's name
- `description` (required): What the agent does
- `tools` (optional): Comma or space-separated list of allowed tools
- `model` (optional): Fully qualified model to use (e.g., `claude-agent-sdk/claude-sonnet-4-6`, `openai-codex/gpt-5.4`)
- `thinking` (optional): Thinking level (`off`, `minimal`, `low`, `medium`, `high`)

### Use Predefined Teams

**List available team templates:**
> **You:** "List all predefined teams I can use."

**List available agent definitions:**
> **You:** "Show me all predefined agents."

**Create a team from a template:**
> **You:** "Create a team named 'my-project' from the 'plan-build' predefined team in the current directory."

This single command:
1. Creates the team
2. Spawns all agents defined in the template
3. Each agent gets its predefined prompt, tools, model, and thinking settings

**With options:**
> **You:** "Create a team named 'big-team' from 'full' predefined team using 'openai-codex/gpt-5.4' as default model and separate windows."

---

## 💾 Save Teams as Templates

Sometimes you create a team with custom prompts and settings that you'd like to reuse later. Instead of manually creating `teams.yaml` and agent definition files, you can save any runtime team as a template.

### The Workflow

```
CREATE → USE → SAVE → REUSE
```

1. **Create** a team with custom teammates and prompts
2. **Use** the team for your task
3. **Save** the team as a reusable template
4. **Reuse** the template later (even on different projects)

### List Runtime Teams

See which teams you have that can be saved:

> **You:** "List all runtime teams."

### Save a Team as a Template

> **You:** "Save team 'my-modularization-team' as template 'code-modularization'"

This creates:
- Agent definition files in `~/.pi/agent/agents/` for each teammate
- Updates `~/.pi/teams.yaml` with the new template

### Save to Project-Local Scope

To save a template that's specific to the current project:

> **You:** "Save team 'my-frontend-team' as template 'frontend-sprint' with scope 'project'"

This creates files in `.pi/agents/` and `.pi/teams.yaml` in the current project directory.

### Reuse Your Template

Once saved, use it just like any predefined team:

> **You:** "Create a team named 'auth-refactor' from the 'code-modularization' template in the current directory"

---

## 📚 Learn More

- **[Full Usage Guide](docs/guide.md)** - Detailed examples, hook system, best practices, and troubleshooting
- **[Tool Reference](docs/reference.md)** - Complete documentation of all tools and parameters

## 🪟 Terminal Requirements

To show multiple agents on one screen, **pi-teams** requires a way to manage terminal panes. It supports **tmux**, **Zellij**, **iTerm2**, **WezTerm**, and **Windows Terminal**.

### Option 1: tmux (Recommended)

Install tmux:
- **macOS**: `brew install tmux`
- **Linux**: `sudo apt install tmux`

How to run:
```bash
tmux  # Start tmux session
pi   # Start pi inside tmux
```

### Option 2: Zellij

Simply start `pi` inside a Zellij session. **pi-teams** will detect it via the `ZELLIJ` environment variable and use `zellij run` to spawn teammates in new panes.

### Option 3: iTerm2 (macOS)

If you are using **iTerm2** on macOS and are *not* inside tmux or Zellij, **pi-teams** can manage your team in two ways:
1. **Panes (Default)**: Automatically split your current window into an optimized layout.
2. **Windows**: Create true separate OS windows for each agent.

It will name the panes or windows with the teammate's agent name for easy identification.

### Option 4: WezTerm (macOS, Linux, Windows)

**WezTerm** is a GPU-accelerated, cross-platform terminal emulator written in Rust. Like iTerm2, it supports both **Panes** and **Separate OS Windows**.

Install WezTerm:
- **macOS**: `brew install --cask wezterm`
- **Linux**: See [wezterm.org/installation](https://wezterm.org/installation)
- **Windows**: Download from [wezterm.org](https://wezterm.org)

How to run:
```bash
wezterm  # Start WezTerm
pi       # Start pi inside WezTerm
```

### Option 5: Windows Terminal (Windows)

**Windows Terminal** is the modern, feature-rich terminal emulator for Windows 10/11. It supports both **Panes** and **Separate OS Windows**.

**Requirements:**
- Windows 10 (version 19041 or later) or Windows 11
- Windows Terminal installed (available from Microsoft Store or winget)
- PowerShell 5.1 or later (pwsh.exe)

Install Windows Terminal:
- **Microsoft Store**: Search for "Windows Terminal" and install
- **winget**: `winget install Microsoft.WindowsTerminal`
- **Scoop**: `scoop install windows-terminal`

Install PowerShell Core (optional but recommended):
- **winget**: `winget install Microsoft.PowerShell`
- **Scoop**: `scoop install powershell`

How to run:
```powershell
# Open Windows Terminal and start pi
wt
pi
```

Or start pi directly from Windows Terminal with new window:
```powershell
wt -- pwsh -c "pi"
```

**Note:** On Windows, pi-teams uses PowerShell for command execution. Make sure `pi` is in your PATH. If you installed pi via npm and Node.js, verify both are accessible from PowerShell.

## 📜 Credits & Attribution

This project is a port of the excellent [claude-code-teams-mcp](https://github.com/cs50victor/claude-code-teams-mcp) by [cs50victor](https://github.com/cs50victor).

We have adapted the original MCP coordination protocol to work natively as a **Pi Package**, adding features like auto-starting teammates, balanced vertical UI layouts, automatic inbox polling, plan approval mode, broadcast messaging, and quality gate hooks.

## 📄 License
MIT
