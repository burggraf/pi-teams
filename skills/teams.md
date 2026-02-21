---
description: Coordinate multiple agents working on a project using shared task lists and messaging via tmux or Zellij.
---

# Agent Teams

Coordinate multiple agents working on a project using shared task lists and messaging via **tmux** or **Zellij**.

## Workflow

1.  **Create a team**: Use `team_create(team_name="my-team")`.
2.  **Spawn teammates**: Use `spawn_teammate` to start additional agents. Give them specific roles and initial prompts.
3.  **Manage tasks**: 
    *   `task_create`: Define work for the team.
    *   `task_list`: List all tasks to monitor progress or find available work.
    *   `task_get`: Get full details of a specific task by ID.
    *   `task_update`: Update a task's status (`pending`, `in_progress`, `completed`, `deleted`) or owner.
4.  **Communicate**: Use `send_message` to give instructions or receive updates. Teammates should use `read_inbox` to check for messages.
5.  **Monitor**: Use `check_teammate` to see if they are still running and if they have sent messages back.
6.  **Cleanup**:
    *   `force_kill_teammate`: Forcibly stop a teammate and remove them from the team.
    *   `process_shutdown_approved`: Orderly removal of a teammate after they've finished.
    *   `team_delete`: Remove a team and all its associated data.

## Teammate Instructions

When you are spawned as a teammate:
- Your status bar will show "Teammate: name @ team".
- You will automatically start by calling `read_inbox` to get your initial instructions.
- Regularly check `read_inbox` for updates from the lead.
- Use `send_message` to "team-lead" to report progress or ask questions.
- Update your assigned tasks using `task_update`.
- If you are idle for more than 30 seconds, you will automatically check your inbox for new messages.

## Best Practices for Teammates

- **Update Task Status**: As you work, use `task_update` to set your tasks to `in_progress` and then `completed`.
- **Frequent Communication**: Send short summaries of your work back to `team-lead` frequently.
- **Context Matters**: When you finish a task, send a message explaining your results and any new files you created.
- **Independence**: If you get stuck, try to solve it yourself first, but don't hesitate to ask `team-lead` for clarification.
- **Orderly Shutdown**: When you've finished all your work and have no more instructions, notify the lead and wait for shutdown approval.

## Best Practices for Team Leads

- **Clear Assignments**: Use `task_create` for all significant work items.
- **Contextual Prompts**: Provide enough context in `spawn_teammate` for the teammate to understand their specific role.
- **Task List Monitoring**: Regularly call `task_list` to see the status of all work.
- **Direct Feedback**: Use `send_message` to provide course corrections or new instructions to teammates.
- **Read Config**: Use `read_config` to see the full team roster and their current status.
