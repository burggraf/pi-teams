### 1. Set Up the Team with Plan Approval

First, create a team and spawn a teammate who is required to provide a plan before making changes.

Prompt:
"Create a team named 'v060-test' for refactoring the project. Spawn a teammate named 'architect' and require plan approval before they make any changes. Tell them to start by identifying one small refactoring opportunity in any file."

---

### 2. Submit and Review a Plan

Wait for the architect to identifying a task and move into planning status.

Prompt (Wait for architect's turn):
"Check the task list. If refactor-bot has submitted a plan for a task, read it. If it involves actual code changes, reject it with feedback: 'Please include a test case in your plan for this change.' If they haven't submitted a plan yet, tell them to do so for task #1."

---

### 3. Evaluate a Plan (Approve)

Wait for the architect to revise the plan and re-submit.

Prompt (Wait for architect's turn):
"Check the task list for task #1. If the plan now includes a test case, approve it and tell the architect to begin implementation. If not, tell them they must include a test case."

---

### 4. Broadcast a Message

Test the new team-wide messaging capability.

Prompt:
"Broadcast to the entire team: 'New project-wide rule: all new files must include a header comment with the project name. Please update any work in progress.'"

---

### 5. Automated Hooks

Test the shell-based hook system. First, create a hook script, then mark a task as completed.

Prompt:
"Create a shell script at '.pi/team-hooks/task_completed.sh' that echoes the task ID and status to a file called 'hook_results.txt'. Then, mark task #1 as 'completed' and verify that 'hook_results.txt' has been created."

---

### 6. Verify Team Status

Ensure the task_list and read_inbox tools are correctly reflecting all the new states and communications.

Prompt:
"Check the task list and read the team configuration. Does task #1 show as 'completed'? Does the architect show as 'teammate' in the roster? Check your own inbox for any final reports."

---

### Final Clean Up

Prompt:
"We're done with the test. Shut down the team and delete all configuration files."
