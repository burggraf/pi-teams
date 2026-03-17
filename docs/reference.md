# pi-teams Tool Reference

Complete documentation of all tools, parameters, and automated behavior.

---

## Table of Contents

- [Team Management](#team-management)
- [Teammates](#teammates)
- [Task Management](#task-management)
- [Messaging](#messaging)
- [Task Planning & Approval](#task-planning--approval)
- [Automated Behavior](#automated-behavior)
- [Task Statuses](#task-statuses)
- [Configuration & Data](#configuration--data)

---

## Team Management

### team_create

Start a new team with optional default model.

**Parameters**:
- `team_name` (required): Name for the team
- `description` (optional): Team description
- `default_model` (optional): Default AI model for all teammates (e.g., `gpt-4o`, `haiku`, `glm-4.7`)

**Examples**:
```javascript
team_create({ team_name: "my-team" })
team_create({ team_name: "research", default_model: "gpt-4o" })
```

---

### team_delete

Delete a team and all its data (configuration, tasks, messages).

**Parameters**:
- `team_name` (required): Name of the team to delete

**Example**:
```javascript
team_delete({ team_name: "my-team" })
```

---

### read_config

Get details about the team and its members.

**Parameters**:
- `team_name` (required): Name of the team

**Returns**: Team configuration including:
- Team name and description
- Default model
- List of members with their models and thinking levels
- Creation timestamp

**Example**:
```javascript
read_config({ team_name: "my-team" })
```

---

## Teammates

### spawn_teammate

Launch a new agent into a terminal pane with a role and instructions.

**Parameters**:
- `team_name` (required): Name of the team
- `name` (required): Friendly name for the teammate (e.g., "security-bot")
- `prompt` (required): Instructions for the teammate's role and initial task
- `cwd` (required): Working directory for the teammate
- `model` (optional): AI model for this teammate (overrides team default)
- `thinking` (optional): Thinking level (`off`, `minimal`, `low`, `medium`, `high`)
- `plan_mode_required` (optional): If `true`, teammate must submit plans for approval

**Model Options**:
- Any model available in your pi configuration
- Common models: `gpt-4o`, `haiku` (Anthropic), `glm-4.7`, `glm-5` (Zhipu AI)

**Thinking Levels**:
- `off`: No thinking blocks (fastest)
- `minimal`: Minimal reasoning overhead
- `low`: Light reasoning for quick decisions
- `medium`: Balanced reasoning (default)
- `high`: Extended reasoning for complex problems

**Examples**:
```javascript
// Basic spawn
spawn_teammate({
  team_name: "my-team",
  name: "security-bot",
  prompt: "Scan the codebase for hardcoded API keys",
  cwd: "/path/to/project"
})

// With custom model
spawn_teammate({
  team_name: "my-team",
  name: "speed-bot",
  prompt: "Run benchmarks on the API endpoints",
  cwd: "/path/to/project",
  model: "haiku"
})

// With plan approval
spawn_teammate({
  team_name: "my-team",
  name: "refactor-bot",
  prompt: "Refactor the user service",
  cwd: "/path/to/project",
  plan_mode_required: true
})

// With custom model and thinking
spawn_teammate({
  team_name: "my-team",
  name: "architect-bot",
  prompt: "Design the new feature architecture",
  cwd: "/path/to/project",
  model: "gpt-4o",
  thinking: "high"
})
```

---

### check_teammate

Check if a teammate is still running or has unread messages.

**Parameters**:
- `team_name` (required): Name of the team
- `agent_name` (required): Name of the teammate to check

**Returns**: Status information including:
- `alive`: Whether the teammate process/pane/window is still running
- `unreadCount`: Number of unread inbox messages
- `health`: One of `healthy`, `idle`, `starting`, `stalled`, `dead`
- `agentLoopReady`: Whether the teammate has executed its inbox-read loop at least once
- `hasRecentHeartbeat`: Whether heartbeat data has been updated recently
- `startupStalled`: Detects the "alive but not consuming inbox" startup failure mode
- `runtime`: Raw runtime telemetry (timestamps, pid, last error)

**Example**:
```javascript
check_teammate({ team_name: "my-team", agent_name: "security-bot" })
```

---

### force_kill_teammate

Forcibly kill a teammate's tmux pane and remove them from the team.

**Parameters**:
- `team_name` (required): Name of the team
- `agent_name` (required): Name of the teammate to kill

**Example**:
```javascript
force_kill_teammate({ team_name: "my-team", agent_name: "security-bot" })
```

---

### process_shutdown_approved

Initiate orderly shutdown for a finished teammate.

**Parameters**:
- `team_name` (required): Name of the team
- `agent_name` (required): Name of the teammate to shut down

**Example**:
```javascript
process_shutdown_approved({ team_name: "my-team", agent_name: "security-bot" })
```

---

## Task Management

### task_create

Create a new task for the team.

**Parameters**:
- `team_name` (required): Name of the team
- `subject` (required): Brief task title
- `description` (required): Detailed task description
- `status` (optional): Initial status (`pending`, `in_progress`, `planning`, `completed`, `deleted`). Default: `pending`
- `owner` (optional): Name of the teammate assigned to the task

**Example**:
```javascript
task_create({
  team_name: "my-team",
  subject: "Audit auth endpoints",
  description: "Review all authentication endpoints for SQL injection vulnerabilities",
  status: "pending",
  owner: "security-bot"
})
```

---

### task_list

List all tasks and their current status.

**Parameters**:
- `team_name` (required): Name of the team

**Returns**: Array of all tasks with their current status, owners, and details.

**Example**:
```javascript
task_list({ team_name: "my-team" })
```

---

### task_get

Get full details of a specific task.

**Parameters**:
- `team_name` (required): Name of the team
- `task_id` (required): ID of the task to retrieve

**Returns**: Full task object including:
- Subject and description
- Status and owner
- Plan (if in planning mode)
- Plan feedback (if rejected)
- Blocked relationships

**Example**:
```javascript
task_get({ team_name: "my-team", task_id: "task_abc123" })
```

---

### task_update

Update a task's status or owner.

**Parameters**:
- `team_name` (required): Name of the team
- `task_id` (required): ID of the task to update
- `status` (optional): New status (`pending`, `planning`, `in_progress`, `completed`, `deleted`)
- `owner` (optional): New owner (teammate name)

**Example**:
```javascript
task_update({
  team_name: "my-team",
  task_id: "task_abc123",
  status: "in_progress",
  owner: "security-bot"
})
```

**Note**: When status changes to `completed`, any hook script at `.pi/team-hooks/task_completed.sh` will automatically run.

---

## Messaging

### send_message

Send a message to a specific teammate or the team lead.

**Parameters**:
- `team_name` (required): Name of the team
- `recipient` (required): Name of the agent receiving the message
- `content` (required): Full message content
- `summary` (required): Brief summary for message list
- `color` (optional): Message color for UI highlighting

**Example**:
```javascript
send_message({
  team_name: "my-team",
  recipient: "security-bot",
  content: "Please focus on the auth module first",
  summary: "Focus on auth module"
})
```

---

### broadcast_message

Send a message to the entire team (excluding the sender).

**Parameters**:
- `team_name` (required): Name of the team
- `content` (required): Full message content
- `summary` (required): Brief summary for message list
- `color` (optional): Message color for UI highlighting

**Use cases**:
- API endpoint changes
- Database schema updates
- Team announcements
- Priority shifts

**Example**:
```javascript
broadcast_message({
  team_name: "my-team",
  content: "The API endpoint has changed to /v2. Please update your work accordingly.",
  summary: "API endpoint changed to v2"
})
```

---

### read_inbox

Read incoming messages for an agent.

**Parameters**:
- `team_name` (required): Name of the team
- `agent_name` (optional): Whose inbox to read. Defaults to current agent.
- `unread_only` (optional): Only show unread messages. Default: `true`

**Returns**: Array of messages with sender, content, timestamp, and read status.

**Examples**:
```javascript
// Read my unread messages
read_inbox({ team_name: "my-team" })

// Read all messages (including read)
read_inbox({ team_name: "my-team", unread_only: false })

// Read a teammate's inbox (as lead)
read_inbox({ team_name: "my-team", agent_name: "security-bot" })
```

---

## Task Planning & Approval

### task_submit_plan

For teammates to submit their implementation plans for approval.

**Parameters**:
- `team_name` (required): Name of the team
- `task_id` (required): ID of the task
- `plan` (required): Implementation plan description

**Behavior**:
- Updates task status to `planning`
- Saves the plan to the task
- Lead agent can then review and approve/reject

**Example**:
```javascript
task_submit_plan({
  team_name: "my-team",
  task_id: "task_abc123",
  plan: "1. Add password strength validator component\n2. Integrate with existing signup form\n3. Add unit tests using zxcvbn library"
})
```

---

### task_evaluate_plan

For the lead agent to approve or reject a submitted plan.

**Parameters**:
- `team_name` (required): Name of the team
- `task_id` (required): ID of the task
- `action` (required): `"approve"` or `"reject"`
- `feedback` (optional): Feedback message (required when rejecting)

**Behavior**:
- **Approve**: Sets task status to `in_progress`, clears any previous feedback
- **Reject**: Sets task status back to `in_progress` (for revision), saves feedback

**Examples**:
```javascript
// Approve plan
task_evaluate_plan({
  team_name: "my-team",
  task_id: "task_abc123",
  action: "approve"
})

// Reject with feedback
task_evaluate_plan({
  team_name: "my-team",
  task_id: "task_abc123",
  action: "reject",
  feedback: "Please add more detail about error handling and edge cases"
})
```

---

## Automated Behavior

### Initial Greeting

When a teammate is spawned, they automatically:
1. Send a message to the lead announcing they've started
2. Begin checking their inbox for work

**Example message**: "I've started and am checking my inbox for tasks."

---

### Idle Polling

If a teammate is idle (has no active work), they automatically check for new messages every **30 seconds**.

This ensures teammates stay responsive to new tasks, messages, and task reassignments without manual intervention.

---

### Automated Hooks

When a task's status changes to `completed`, pi-teams automatically executes:

`.pi/team-hooks/task_completed.sh`

The hook receives the task data as a JSON string as the first argument.

**Common hook uses**:
- Run test suite
- Run linting
- Notify external systems (Slack, email)
- Trigger deployments
- Generate reports

**See [Usage Guide](guide.md#hook-system) for detailed examples.**

---

### Context Injection

Each teammate is given a custom system prompt that includes:
- Their role and instructions
- Team context (team name, member list)
- Available tools
- Team environment guidelines

This ensures teammates understand their responsibilities and can work autonomously.

---

## Task Statuses

### pending

Task is created but not yet assigned or started.

### planning

Task is being planned. Teammate has submitted a plan and is awaiting lead approval. (Only available when `plan_mode_required` is true for the teammate)

### in_progress

Task is actively being worked on by the assigned teammate.

### completed

Task is finished. Status change triggers the `task_completed.sh` hook.

### deleted

Task is removed from the active task list. Still preserved in data history.

---

## Configuration & Data

### Data Storage

All pi-teams data is stored in your home directory under `~/.pi/`:

```
~/.pi/
├── teams/
│   └── <team-name>/
│       └── config.json      # Team configuration and member list
├── tasks/
│   └── <team-name>/
│       ├── task_*.json      # Individual task files
│       └── tasks.json       # Task index
└── messages/
    └── <team-name>/
        ├── <agent-name>.json  # Per-agent message history
        └── index.json         # Message index
```

### Team Configuration (config.json)

```json
{
  "name": "my-team",
  "description": "Code review team",
  "defaultModel": "gpt-4o",
  "members": [
    {
      "name": "security-bot",
      "model": "gpt-4o",
      "thinking": "medium",
      "planModeRequired": true
    },
    {
      "name": "frontend-dev",
      "model": "haiku",
      "thinking": "low",
      "planModeRequired": false
    }
  ]
}
```

### Task File (task_*.json)

```json
{
  "id": "task_abc123",
  "subject": "Audit auth endpoints",
  "description": "Review all authentication endpoints for vulnerabilities",
  "status": "in_progress",
  "owner": "security-bot",
  "plan": "1. Scan /api/login\n2. Scan /api/register\n3. Scan /api/refresh",
  "planFeedback": null,
  "blocks": [],
  "blockedBy": [],
  "activeForm": "Auditing auth endpoints",
  "createdAt": "2024-02-22T10:00:00Z",
  "updatedAt": "2024-02-22T10:30:00Z"
}
```

### Message File (<agent-name>.json)

```json
{
  "messages": [
    {
      "id": "msg_def456",
      "from": "team-lead",
      "to": "security-bot",
      "content": "Please focus on the auth module first",
      "summary": "Focus on auth module",
      "timestamp": "2024-02-22T10:15:00Z",
      "read": false
    }
  ]
}
```

---

## Environment Variables

pi-teams respects the following environment variables:

- `ZELLIJ`: Automatically detected when running inside Zellij. Enables Zellij pane management.
- `TMUX`: Automatically detected when running inside tmux. Enables tmux pane management.
- `PI_DEFAULT_THINKING_LEVEL`: Default thinking level for spawned teammates if not specified (`off`, `minimal`, `low`, `medium`, `high`).

---

## Terminal Integration

### tmux Detection

If the `TMUX` environment variable is set, pi-teams uses `tmux split-window` to create panes.

**Layout**: Large lead pane on the left, teammates stacked on the right.

### Zellij Detection

If the `ZELLIJ` environment variable is set, pi-teams uses `zellij run` to create panes.

**Layout**: Same as tmux - large lead pane on left, teammates on right.

### iTerm2 Detection

If neither tmux nor Zellij is detected, and you're on macOS with iTerm2, pi-teams uses AppleScript to split the window.

**Layout**: Same as tmux/Zellij - large lead pane on left, teammates on right.

**Requirements**:
- macOS
- iTerm2 terminal
- Not inside tmux or Zellij

---

## Error Handling

### Lock Files

pi-teams uses lock files to prevent concurrent modifications:

```
~/.pi/teams/<team-name>/.lock
~/.pi/tasks/<team-name>/.lock
~/.pi/messages/<team-name>/.lock
```

If a lock file is stale (process no longer running), it's automatically removed after 60 seconds.

### Race Conditions

The locking system prevents race conditions when multiple teammates try to update tasks or send messages simultaneously.

### Recovery

If a lock file persists beyond 60 seconds, it's automatically cleaned up. For manual recovery:

```bash
# Remove stale lock
rm ~/.pi/teams/my-team/.lock
```

---

## Performance Considerations

### Idle Polling Overhead

Teammates poll their inboxes every 30 seconds when idle. This is minimal overhead (one file read per poll).

### Lock Timeout

Lock files timeout after 60 seconds. Adjust if you have very slow operations.

### Message Storage

Messages are stored as JSON. For teams with extensive message history, consider periodic cleanup:

```bash
# Archive old messages
mv ~/.pi/messages/my-team/ ~/.pi/messages-archive/my-team-2024-02-22/
```
