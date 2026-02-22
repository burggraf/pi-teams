### 1. Create Team with Default Model

First, set up a test team with a default model.

Prompt:
"Create a team named 'v070-test' for testing thinking levels. Use 'anthropic/claude-3-5-sonnet-latest' as the default model."

---

### 2. Spawn Teammates with Different Thinking Levels

Test the new thinking parameter by spawning three teammates with different settings.

Prompt:
"Spawn three teammates with different thinking levels:
- 'DeepThinker' with 'high' thinking level. Tell them they are an expert at complex architectural analysis.
- 'MediumBot' with 'medium' thinking level. Tell them they are a balanced worker.
- 'FastWorker' with 'low' thinking level. Tell them they need to work quickly."

---

### 3. Verify Thinking Levels in Team Config

Check that the thinking levels are correctly persisted in the team configuration.

Prompt:
"Read the config for the 'v070-test' team. Verify that DeepThinker has thinking level 'high', MediumBot has 'medium', and FastWorker has 'low'."

---

### 4. Test Environment Variable Propagation

Verify that the PI_DEFAULT_THINKING_LEVEL environment variable is correctly set for each spawned process.

Prompt (run in terminal):
"Run 'ps aux | grep PI_DEFAULT_THINKING_LEVEL' to check that the environment variables were passed to the spawned teammate processes."

---

### 5. Assign Tasks Based on Thinking Levels

Create tasks appropriate for each teammate's thinking level.

Prompt:
"Create a task for DeepThinker: 'Analyze the pi-teams codebase architecture and suggest improvements for scalability'. Set it to in_progress.
Create a task for FastWorker: 'List all TypeScript files in the src directory'. Set it to in_progress."

---

### 6. Verify Teammate Responsiveness

Check that all teammates are responsive and checking their inboxes.

Prompt:
"Check the status of DeepThinker, MediumBot, and FastWorker using the check_teammate tool. Then send a message to FastWorker asking them to confirm they received their task."

---

### 7. Test Minimal and Off Thinking Levels

Spawn additional teammates with lower thinking settings.

Prompt:
"Spawn two more teammates:
- 'MinimalRunner' with 'minimal' thinking level using model 'google/gemini-2.0-flash'.
- 'InstantRunner' with 'off' thinking level using model 'google/gemini-2.0-flash'.
Tell both to report their current thinking setting when they reply."

---

### 8. Verify All Thinking Levels Supported

Check the team config again to ensure all five thinking levels are represented correctly.

Prompt:
"Read the team config again. Verify that DeepThinker shows 'high', MediumBot shows 'medium', FastWorker shows 'low', MinimalRunner shows 'minimal', and InstantRunner shows 'off'."

---

### 9. Test Thinking Level Behavior

Observe how different thinking levels affect response times and depth.

Prompt:
"Send the same simple question to all five teammates: 'What is 2 + 2?' Compare their response times and the depth of their reasoning blocks (if visible)."

---

### Final Clean Up

Prompt:
"Shut down the v070-test team and delete all configuration files."
