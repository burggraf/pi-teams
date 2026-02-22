import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import * as paths from "../src/utils/paths";
import * as teams from "../src/utils/teams";
import * as tasks from "../src/utils/tasks";
import * as messaging from "../src/utils/messaging";
import { Member } from "../src/utils/models";
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export default function (pi: ExtensionAPI) {
  const isTeammate = !!process.env.PI_AGENT_NAME;
  const agentName = process.env.PI_AGENT_NAME || "team-lead";
  const teamName = process.env.PI_TEAM_NAME;

  pi.on("session_start", async (_event, ctx) => {
    paths.ensureDirs();
    if (isTeammate) {
      if (teamName) {
        const pidFile = path.join(paths.teamDir(teamName), `${agentName}.pid`);
        fs.writeFileSync(pidFile, process.pid.toString());
      }
      ctx.ui.notify(`Teammate: ${agentName} (Team: ${teamName})`, "info");
      // Use a shorter, more prominent status at the beginning if possible
      ctx.ui.setStatus("00-pi-teams", `[${agentName.toUpperCase()}]`); 
      
      // Also set the tmux pane title for better visibility
      try {
        if (process.env.TMUX) {
          spawnSync("tmux", ["select-pane", "-T", agentName]);
        } else if (process.env.TERM_PROGRAM === "iTerm.app") {
          spawnSync("osascript", ["-e", `tell application "iTerm2" to tell current session of current window to set name to "${agentName}"`]);
        }
      } catch (e) {
        // ignore
      }
      
      // Auto-trigger the first turn for teammates
      setTimeout(() => {
        pi.sendUserMessage(`I am starting my work as '${agentName}' on team '${teamName}'. Checking my inbox for instructions...`);
      }, 1000);

      // Periodically check for new messages when idle
      setInterval(async () => {
        if (ctx.isIdle() && teamName) {
          const unread = await messaging.readInbox(teamName, agentName, true, false);
          if (unread.length > 0) {
            pi.sendUserMessage(`I have ${unread.length} new message(s) in my inbox. Reading them now...`);
          }
        }
      }, 30000);
    } else if (teamName) {
      ctx.ui.setStatus("pi-teams", `Lead @ ${teamName}`);
    }
  });

  let firstTurn = true;
  pi.on("before_agent_start", async (event, ctx) => {
    if (isTeammate && firstTurn) {
      firstTurn = false;
      return {
        systemPrompt: event.systemPrompt + `\n\nYou are teammate '${agentName}' on team '${teamName}'.\nYour lead is 'team-lead'.\nStart by calling read_inbox(team_name="${teamName}") to get your initial instructions.`,
      };
    }
  });

  async function killTeammate(teamName: string, member: Member) {
    if (member.name === "team-lead") return;

    const pidFile = path.join(paths.teamDir(teamName), `${member.name}.pid`);
    if (fs.existsSync(pidFile)) {
      try {
        const pid = fs.readFileSync(pidFile, "utf-8").trim();
        process.kill(parseInt(pid), "SIGKILL");
        fs.unlinkSync(pidFile);
      } catch (e) {
        // ignore if process already dead
      }
    }

    if (member.tmuxPaneId) {
      try {
        if (member.tmuxPaneId.startsWith("iterm_")) {
          const itermId = member.tmuxPaneId.replace("iterm_", "");
          const script = `tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if id of aSession is "${itermId}" then
          close aSession
          return "Closed"
        end if
      end repeat
    end repeat
  end repeat
end tell`;
          spawnSync("osascript", ["-e", script]);
        } else if (member.tmuxPaneId.startsWith("zellij_")) {
          // Zellij is expected to close on process exit (using --close-on-exit)
        } else {
          // Use -t with the pane_id
          spawnSync("tmux", ["kill-pane", "-t", member.tmuxPaneId.trim()]);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // Tools
  pi.registerTool({
    name: "team_create",
    label: "Create Team",
    description: "Create a new agent team.",
    parameters: Type.Object({
      team_name: Type.String(),
      description: Type.Optional(Type.String()),
      default_model: Type.Optional(Type.String()),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const config = teams.createTeam(params.team_name, "local-session", "lead-agent", params.description, params.default_model);
      return {
        content: [{ type: "text", text: `Team ${params.team_name} created.` }],
        details: { config },
      };
    },
  });

  pi.registerTool({
    name: "spawn_teammate",
    label: "Spawn Teammate",
    description: "Spawn a new teammate in a tmux pane.",
    parameters: Type.Object({
      team_name: Type.String(),
      name: Type.String(),
      prompt: Type.String(),
      cwd: Type.String(),
      model: Type.Optional(Type.String()),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const safeName = paths.sanitizeName(params.name);
      const safeTeamName = paths.sanitizeName(params.team_name);

      if (!teams.teamExists(safeTeamName)) {
        throw new Error(`Team ${params.team_name} does not exist`);
      }

      const teamConfig = await teams.readConfig(safeTeamName);
      const chosenModel = params.model || teamConfig.defaultModel;

      const member: Member = {
        agentId: `${safeName}@${safeTeamName}`,
        name: safeName,
        agentType: "teammate",
        model: chosenModel,
        joinedAt: Date.now(),
        tmuxPaneId: "",
        cwd: params.cwd,
        subscriptions: [],
        prompt: params.prompt,
        color: "blue",
      };

      await teams.addMember(safeTeamName, member);
      await messaging.sendPlainMessage(safeTeamName, "team-lead", safeName, params.prompt, "Initial prompt");

      const piBinary = process.argv[1] ? `node ${process.argv[1]}` : "pi"; // Assumed on path
      const piCmd = piBinary;
      
      let paneId = "";
      try {
        if (process.env.ZELLIJ && !process.env.TMUX) {
          const zellijArgs = [
            "run", 
            "--name", safeName, 
            "--cwd", params.cwd, 
            "--close-on-exit",
            "--", 
            "env", `PI_TEAM_NAME=${safeTeamName}`, `PI_AGENT_NAME=${safeName}`,
            "sh", "-c", piCmd
          ];
          spawnSync("zellij", zellijArgs);
          paneId = `zellij_${safeName}`;
        } else if (process.env.TERM_PROGRAM === "iTerm.app" && !process.env.TMUX && !process.env.ZELLIJ) {
          const itermCmd = `cd '${params.cwd}' && PI_TEAM_NAME=${safeTeamName} PI_AGENT_NAME=${safeName} ${piCmd}`;
          const teammates = teamConfig.members.filter(m => m.agentType === "teammate" && m.tmuxPaneId.startsWith("iterm_"));
          const lastTeammate = teammates.length > 0 ? teammates[teammates.length - 1] : null;
          
          let script = "";
          if (!lastTeammate) {
            // First teammate: split current session vertically (side-by-side)
            script = `tell application "iTerm2"
  tell current session of current window
    set newSession to split vertically with default profile
    tell newSession
      write text "${itermCmd.replace(/"/g, '\\"')}"
      return id
    end tell
  end tell
end tell`;
          } else {
            // Subsequent teammate: split the last teammate's session horizontally (stacking them)
            const lastSessionId = lastTeammate.tmuxPaneId.replace("iterm_", "");
            script = `tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if id of aSession is "${lastSessionId}" then
          tell aSession
            set newSession to split horizontally with default profile
            tell newSession
              write text "${itermCmd.replace(/"/g, '\\"')}"
              return id
            end tell
          end tell
        end if
      end repeat
    end repeat
  end repeat
end tell`;
          }
          const result = spawnSync("osascript", ["-e", script]);
          if (result.status !== 0) throw new Error(`osascript failed with status ${result.status}: ${result.stderr.toString()}`);
          paneId = `iterm_${result.stdout.toString().trim()}`;
        } else {
          const tmuxArgs = [
            "split-window", 
            "-h", "-dP", 
            "-F", "#{pane_id}", 
            "-c", params.cwd, 
            "env", `PI_TEAM_NAME=${safeTeamName}`, `PI_AGENT_NAME=${safeName}`,
            "sh", "-c", piCmd
          ];
          const result = spawnSync("tmux", tmuxArgs);
          if (result.status !== 0) throw new Error(`tmux failed with status ${result.status}: ${result.stderr.toString()}`);
          paneId = result.stdout.toString().trim();
          spawnSync("tmux", ["set-window-option", "main-pane-width", "60%"]);
          spawnSync("tmux", ["select-layout", "main-vertical"]);
        }
      } catch (e) {
        throw new Error(`Failed to spawn ${process.env.ZELLIJ && !process.env.TMUX ? "zellij" : (process.env.TERM_PROGRAM === "iTerm.app" ? "iTerm2" : "tmux")} pane: ${e}`);
      }


      // Update member with paneId
      await teams.updateMember(params.team_name, params.name, { tmuxPaneId: paneId });

      return {
        content: [{ type: "text", text: `Teammate ${params.name} spawned in pane ${paneId}.` }],
        details: { agentId: member.agentId, paneId },
      };
    },
  });

  pi.registerTool({
    name: "send_message",
    label: "Send Message",
    description: "Send a message to a teammate.",
    parameters: Type.Object({
      team_name: Type.String(),
      recipient: Type.String(),
      content: Type.String(),
      summary: Type.String(),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      await messaging.sendPlainMessage(params.team_name, agentName, params.recipient, params.content, params.summary);
      return {
        content: [{ type: "text", text: `Message sent to ${params.recipient}.` }],
      };
    },
  });

  pi.registerTool({
    name: "read_inbox",
    label: "Read Inbox",
    description: "Read messages from an agent's inbox.",
    parameters: Type.Object({
      team_name: Type.String(),
      agent_name: Type.Optional(Type.String({ description: "Whose inbox to read. Defaults to your own." })),
      unread_only: Type.Optional(Type.Boolean({ default: true })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const targetAgent = params.agent_name || agentName;
      const msgs = await messaging.readInbox(params.team_name, targetAgent, params.unread_only);
      return {
        content: [{ type: "text", text: JSON.stringify(msgs, null, 2) }],
        details: { messages: msgs },
      };
    },
  });

  pi.registerTool({
    name: "task_create",
    label: "Create Task",
    description: "Create a new team task.",
    parameters: Type.Object({
      team_name: Type.String(),
      subject: Type.String(),
      description: Type.String(),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const task = await tasks.createTask(params.team_name, params.subject, params.description);
      return {
        content: [{ type: "text", text: `Task ${task.id} created.` }],
        details: { task },
      };
    },
  });

  pi.registerTool({
    name: "task_list",
    label: "List Tasks",
    description: "List all team tasks.",
    parameters: Type.Object({
      team_name: Type.String(),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const taskList = await tasks.listTasks(params.team_name);
      return {
        content: [{ type: "text", text: JSON.stringify(taskList, null, 2) }],
        details: { tasks: taskList },
      };
    },
  });

  pi.registerTool({
    name: "task_update",
    label: "Update Task",
    description: "Update a task's status or owner.",
    parameters: Type.Object({
      team_name: Type.String(),
      task_id: Type.String(),
      status: Type.Optional(StringEnum(["pending", "in_progress", "completed", "deleted"])),
      owner: Type.Optional(Type.String()),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const updated = await tasks.updateTask(params.team_name, params.task_id, {
        status: params.status as any,
        owner: params.owner,
      });
      return {
        content: [{ type: "text", text: `Task ${params.task_id} updated.` }],
        details: { task: updated },
      };
    },
  });

  pi.registerTool({
    name: "team_delete",
    label: "Delete Team",
    description: "Delete a team and all its data.",
    parameters: Type.Object({
      team_name: Type.String(),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const teamName = params.team_name;
      try {
        const config = await teams.readConfig(teamName);
        for (const member of config.members) {
          if (member.name !== "team-lead") {
            ctx.ui.notify(`Stopping teammate: ${member.name}`, "info");
            await killTeammate(teamName, member);
          }
        }
      } catch (e) {
        // config might not exist, ignore
      }

      const dir = paths.teamDir(teamName);
      const tasksDir = paths.taskDir(teamName);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
      if (fs.existsSync(tasksDir)) fs.rmSync(tasksDir, { recursive: true });
      return {
        content: [{ type: "text", text: `Team ${teamName} deleted.` }],
      };
    },
  });

  pi.registerTool({
    name: "read_config",
    label: "Read Config",
    description: "Read the current team configuration.",
    parameters: Type.Object({
      team_name: Type.String(),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const config = await teams.readConfig(params.team_name);
      return {
        content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
        details: { config },
      };
    },
  });

  pi.registerTool({
    name: "task_get",
    label: "Get Task",
    description: "Get full details of a specific task by ID.",
    parameters: Type.Object({
      team_name: Type.String(),
      task_id: Type.String(),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const task = await tasks.readTask(params.team_name, params.task_id);
      return {
        content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
        details: { task },
      };
    },
  });

  pi.registerTool({
    name: "force_kill_teammate",
    label: "Force Kill Teammate",
    description: "Forcibly kill a teammate's tmux target.",
    parameters: Type.Object({
      team_name: Type.String(),
      agent_name: Type.String(),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const config = await teams.readConfig(params.team_name);
      const member = config.members.find(m => m.name === params.agent_name);
      if (!member) throw new Error(`Teammate ${params.agent_name} not found`);
      
      await killTeammate(params.team_name, member);

      await teams.removeMember(params.team_name, params.agent_name);
      await tasks.resetOwnerTasks(params.team_name, params.agent_name);
      return {
        content: [{ type: "text", text: `${params.agent_name} has been stopped.` }],
      };
    },
  });

  pi.registerTool({
    name: "check_teammate",
    label: "Check Teammate",
    description: "Check a single teammate's status.",
    parameters: Type.Object({
      team_name: Type.String(),
      agent_name: Type.String(),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const config = await teams.readConfig(params.team_name);
      const member = config.members.find(m => m.name === params.agent_name);
      if (!member) throw new Error(`Teammate ${params.agent_name} not found`);

      let alive = false;
      if (member.tmuxPaneId) {
        try {
          if (member.tmuxPaneId.startsWith("zellij_")) {
            // Assume alive if it's zellij for now
            alive = true;
          } else if (member.tmuxPaneId.startsWith("iterm_")) {
            const itermId = member.tmuxPaneId.replace("iterm_", "");
            const script = `tell application "iTerm2"
  repeat with aWindow in windows
    repeat with aTab in tabs of aWindow
      repeat with aSession in sessions of aTab
        if id of aSession is "${itermId}" then
          return "Alive"
        end if
      end repeat
    end repeat
  end repeat
end tell`;
            const result = spawnSync("osascript", ["-e", script]);
            alive = result.stdout.toString().includes("Alive");
          } else {
            execSync(`tmux has-session -t ${member.tmuxPaneId}`);
            alive = true;
          }
        } catch (e) {
          alive = false;
        }
      }

      const unreadCount = (await messaging.readInbox(params.team_name, params.agent_name, true, false)).length;

      return {
        content: [{ type: "text", text: JSON.stringify({ alive, unreadCount }, null, 2) }],
        details: { alive, unreadCount },
      };
    },
  });

  pi.registerTool({
    name: "process_shutdown_approved",
    label: "Process Shutdown Approved",
    description: "Process a teammate's shutdown.",
    parameters: Type.Object({
      team_name: Type.String(),
      agent_name: Type.String(),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const config = await teams.readConfig(params.team_name);
      const member = config.members.find(m => m.name === params.agent_name);
      if (!member) throw new Error(`Teammate ${params.agent_name} not found`);

      await killTeammate(params.team_name, member);

      await teams.removeMember(params.team_name, params.agent_name);
      await tasks.resetOwnerTasks(params.team_name, params.agent_name);
      return {
        content: [{ type: "text", text: `${params.agent_name} removed from team.` }],
      };
    },
  });
}
