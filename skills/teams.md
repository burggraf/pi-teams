---
description: Coordinate multiple agents working on a project using shared task lists and messaging via tmux or iTerm2.
---

# Agent Teams

Coordinate multiple agents working on a project using shared task lists and messaging.

## Workflow

1.  **Create a team**: Use `team_create(team_name="my-team")`.
2.  **Spawn teammates**: Use `spawn_teammate` to start additional agents. Give them specific roles and initial prompts.
3.  **Manage tasks**: Use `task_create` to define work, and `task_update` to assign it to teammates.
4.  **Communicate**: Use `send_message` to give instructions or receive updates. Teammates should use `read_inbox` to check for messages.
5.  **Monitor**: Use `check_teammate` to see if they are still running and if they have sent messages back.

## Teammate Instructions

When you are spawned as a teammate:
- Your status bar will show "Teammate: name @ team".
- Always start by calling `read_inbox` to get your initial instructions.
- Regularly check `read_inbox` for updates from the lead.
- Use `send_message` to "team-lead" to report progress or ask questions.
- Update your assigned tasks using `task_update`.

## Best Practices for Teammates

- **Update Task Status**: As you work, use `task_update` to set your tasks to `in_progress` and then `completed`.
- **Frequent Communication**: Send short summaries of your work back to `team-lead` frequently.
- **Context Matters**: When you finish a task, send a message explaining your results and any new files you created.
- **Independence**: If you get stuck, try to solve it yourself first, but don't hesitate to ask `team-lead` for clarification.
