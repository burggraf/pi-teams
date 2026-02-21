# pi-teams

Agent teams for `pi`, ported from `claude-code-teams-mcp`.

This package implements a team protocol for agents working together on a project using shared task lists and messaging, mediated via `tmux`. It allows a "Lead" agent to spawn "Teammates", assign them tasks, and communicate via a persistent inbox system.

## Features

- **Team Orchestration**: Create named teams with isolated configurations.
- **Agent Spawning**: Launch teammates in background `tmux` panes.
- **Messaging Protocol**: Lead can send direct messages and instructions; teammates can reply and report progress.
- **Shared Task List**: Track progress across the whole team with persistent task states (`pending`, `in_progress`, `completed`).
- **Identity Awareness**: Agents know if they are a Lead or a Teammate and adjust their system prompts accordingly.

## Installation

```bash
pi install npm:pi-teams
```

Or from GitHub:

```bash
pi install github:burggraf/pi-teams
```

## Getting Started (Quick Start)

To get a team up and running, follow these steps:

1.  **Initialize your team**:
    "Start a new team called 'ui-refactor' for improving the React component architecture."
2.  **Define your plan**:
    "Create tasks for 'refactor-header', 'add-storybooks', and 'update-theme'."
3.  **Spawn a specialist**:
    "Spawn a teammate named 'storybook-expert' in the `packages/ui` directory. Their goal is to create Storybook stories for all components in the `src/components` directory."
4.  **Follow progress**:
    "Check on 'storybook-expert'. Any updates? Show me the current task list."

## How to Use in Pi

As a developer, you interact with `pi-teams` by giving natural language instructions to the pi agent. The agent will then use the underlying tools to execute your requests.

### 1. Starting a New Team
**You:** "Start a new team called 'backend-migration' for refactoring our auth service."
- **Pi will:** Call `team_create("backend-migration", "Refactoring auth service")`.

### 2. Adding Teammates
**You:** "Spawn a teammate named 'security-audit' in the `./auth` directory. Their goal is to find any hardcoded secrets."
- **Pi will:** Call `spawn_teammate("backend-migration", "security-audit", "Analyze all files in the current directory and find hardcoded secrets. Report back with a message to team-lead.", "./auth")`.
- **In your terminal:** A new `tmux` pane will open running a fresh `pi` instance with those instructions.

### 3. Coordinating via Tasks
**You:** "Create a task for 'security-audit' to check the `.env` handling and set it to 'in_progress'."
- **Pi will:** Call `task_create` and then `task_update` to assign it to the teammate.

### 4. Checking Progress
**You:** "Check on 'security-audit'. Do they have any updates for me?"
- **Pi will:** Call `check_teammate` to see if they are active and `read_inbox` to see if they sent any messages back to you (the lead).

### 5. Managing the Team
**You:** "List all tasks and show me the team config."
- **Pi will:** Call `task_list` and `read_config` to give you a status overview.

## Teammate Experience

When a teammate is spawned:
- A new `tmux` pane will open in your terminal.
- The teammate agent will be running a `pi` session with its initial instructions.
- The agent's status bar (if supported by your terminal) will indicate its role and team name.
- It will automatically start by checking its inbox for initial tasks or additional context.
- It will periodically check for new messages from the "Lead" agent.

## Communication Flow
1. **Lead to Teammate**: Use `send_message`. The teammate is programmed to check their inbox.
2. **Teammate to Lead**: Teammates are instructed to use `send_message` with `recipient="team-lead"`.
3. **Checking Messages**: You can ask Pi "Read my messages" or "Check for new messages from the team".

### Team Management
- `team_create(team_name, description?)`: Initialize a new team.
- `team_delete(team_name)`: Remove all team data and configuration.
- `read_config(team_name)`: View the current team members and status.

### Teammate Operations
- `spawn_teammate(team_name, name, prompt, cwd)`: Spawn a new `pi` agent in a `tmux` pane with specific instructions.
- `check_teammate(team_name, agent_name)`: Check if an agent is still alive in `tmux` and see their unread message count.
- `force_kill_teammate(team_name, agent_name)`: Forcibly terminate an agent's `tmux` pane and remove them from the team.

### Communication
- `send_message(team_name, recipient, content, summary)`: Send a message to any team member.
- `read_inbox(team_name, unread_only?)`: Check for incoming messages. Teammates use this to get their orders.

### Task Management
- `task_create(team_name, subject, description)`: Add a new task to the team board.
- `task_list(team_name)`: List all tasks and their owners/status.
- `task_get(team_name, task_id)`: Get full details for a specific task.
- `task_update(team_name, task_id, status?, owner?)`: Update status or assign/reassign a task.

## Troubleshooting

- **Tmux not found**: Ensure `tmux` is installed on your system.
- **Tmux pane doesn't open**: Make sure you have a `tmux` session active when spawning teammates.
- **Pi not in path**: Teammates are spawned with the command `pi`. Ensure the `pi` binary is in your PATH.
- **Storage Issues**: If team data is corrupted or you want a fresh start, you can manually delete the data at `~/.claude/teams/` and `~/.claude/tasks/`.

## Safety and Concurrency

`pi-teams` is designed for high reliability in multi-agent environments:

- **Granular Locking**: Uses a per-file locking mechanism (`.filename.lock`) to ensure that concurrent reads and writes from multiple agents don't corrupt team state or task lists.
- **Atomic Operations**: All state changes are wrapped in atomic file operations with automatic retries and exponential backoff.
- **Identity Protection**: Teammate sessions are isolated with their own environment variables (`PI_TEAM_NAME`, `PI_AGENT_NAME`) and tailored system prompts.
- **Tmux Integration**: Leverages `tmux` for robust process management and visual separation of agent activities.

## Requirements

- **tmux**: Must be installed on your system.
- **pi**: The `pi` binary must be accessible in your environment.

## Credits and Attribution

This project is a port of [claude-code-teams-mcp](https://github.com/cs50victor/claude-code-teams-mcp) by [cs50victor](https://github.com/cs50victor). It adapts the core team orchestration protocol and shared task management concepts from the original MCP server to work natively within the `pi` ecosystem.

Special thanks to the original author for the architectural inspiration and for deep-diving into the agent coordination patterns that make this package possible.

## License
MIT
