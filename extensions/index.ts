import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import * as paths from "../src/utils/paths";
import * as teams from "../src/utils/teams";
import * as tasks from "../src/utils/tasks";
import * as messaging from "../src/utils/messaging";
import { Member } from "../src/utils/models";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export default function (pi: ExtensionAPI) {
  const isTeammate = !!process.env.PI_AGENT_NAME;
  const agentName = process.env.PI_AGENT_NAME || "team-lead";
  const teamName = process.env.PI_TEAM_NAME;

  pi.on("session_start", async (_event, ctx) => {
    paths.ensureDirs();
    if (isTeammate) {
      ctx.ui.notify(`Teammate: ${agentName} (Team: ${teamName})`, "info");
      // Use a shorter, more prominent status at the beginning if possible
      ctx.ui.setStatus("00-pi-teams", `[${agentName.toUpperCase()}]`); 
      
      // Also set the tmux pane title for better visibility
      try {
        execSync(`tmux select-pane -T "${agentName}"`);
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

  // Tools
  pi.registerTool({
    name: "team_create",
    label: "Create Team",
    description: "Create a new agent team.",
    parameters: Type.Object({
      team_name: Type.String(),
      description: Type.Optional(Type.String()),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const config = teams.createTeam(params.team_name, "local-session", "lead-agent", params.description);
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
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      if (!teams.teamExists(params.team_name)) {
        throw new Error(`Team ${params.team_name} does not exist`);
      }

      const member: Member = {
        agentId: `${params.name}@${params.team_name}`,
        name: params.name,
        agentType: "teammate",
        model: "sonnet",
        joinedAt: Date.now(),
        tmuxPaneId: "",
        cwd: params.cwd,
        subscriptions: [],
        prompt: params.prompt,
        color: "blue",
      };

      await teams.addMember(params.team_name, member);
      await messaging.sendPlainMessage(params.team_name, "team-lead", params.name, params.prompt, "Initial prompt");

      const piBinary = process.argv[1] ? `node ${process.argv[1]}` : "pi"; // Assumed on path
      const cmd = `PI_TEAM_NAME=${params.team_name} PI_AGENT_NAME=${params.name} ${piBinary}`;
      
      let paneId = "";
      try {
        const tmuxCmd = `tmux split-window -h -dP -F "#{pane_id}" "cd ${params.cwd} && ${cmd}"`;
        paneId = execSync(tmuxCmd).toString().trim();
        execSync(`tmux select-layout even-horizontal`);
      } catch (e) {
        throw new Error(`Failed to spawn tmux pane: ${e}`);
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
      const dir = paths.teamDir(params.team_name);
      const tasksDir = paths.taskDir(params.team_name);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
      if (fs.existsSync(tasksDir)) fs.rmSync(tasksDir, { recursive: true });
      return {
        content: [{ type: "text", text: `Team ${params.team_name} deleted.` }],
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
      if (member.tmuxPaneId) {
        try {
          execSync(`tmux kill-pane -t ${member.tmuxPaneId}`);
        } catch (e) {
          // ignore
        }
      }
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
          execSync(`tmux has-session -t ${member.tmuxPaneId}`);
          alive = true;
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
      if (member.tmuxPaneId) {
        try {
          execSync(`tmux kill-pane -t ${member.tmuxPaneId}`);
        } catch (e) {
          // ignore
        }
      }
      await teams.removeMember(params.team_name, params.agent_name);
      await tasks.resetOwnerTasks(params.team_name, params.agent_name);
      return {
        content: [{ type: "text", text: `${params.agent_name} removed from team.` }],
      };
    },
  });
}
