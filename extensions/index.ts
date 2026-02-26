import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import * as paths from "../src/utils/paths";
import * as teams from "../src/utils/teams";
import * as tasks from "../src/utils/tasks";
import * as messaging from "../src/utils/messaging";
import { Member } from "../src/utils/models";
import { getTerminalAdapter } from "../src/adapters/terminal-registry";
import { Iterm2Adapter } from "../src/adapters/iterm2-adapter";
import * as path from "node:path";
import * as fs from "node:fs";

export default function (pi: ExtensionAPI) {
  const isTeammate = !!process.env.PI_AGENT_NAME;
  const agentName = process.env.PI_AGENT_NAME || "team-lead";
  const teamName = process.env.PI_TEAM_NAME;

  const terminal = getTerminalAdapter();

  pi.on("session_start", async (_event, ctx) => {
    paths.ensureDirs();
    if (isTeammate) {
      if (teamName) {
        const pidFile = path.join(paths.teamDir(teamName), `${agentName}.pid`);
        fs.writeFileSync(pidFile, process.pid.toString());
      }
      ctx.ui.notify(`Teammate: ${agentName} (Team: ${teamName})`, "info");
      ctx.ui.setStatus("00-pi-teams", `[${agentName.toUpperCase()}]`);

      if (terminal) {
        const fullTitle = teamName ? `${teamName}: ${agentName}` : agentName;
        const setIt = () => {
          if ((ctx.ui as any).setTitle) (ctx.ui as any).setTitle(fullTitle);
          terminal.setTitle(fullTitle);
        };
        setIt();
        setTimeout(setIt, 500);
        setTimeout(setIt, 2000);
        setTimeout(setIt, 5000);
      }

      setTimeout(() => {
        pi.sendUserMessage(`I am starting my work as '${agentName}' on team '${teamName}'. Checking my inbox for instructions...`);
      }, 1000);

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

  pi.on("turn_start", async (_event, ctx) => {
    if (isTeammate) {
      const fullTitle = teamName ? `${teamName}: ${agentName}` : agentName;
      if ((ctx.ui as any).setTitle) (ctx.ui as any).setTitle(fullTitle);
      if (terminal) terminal.setTitle(fullTitle);
    }
  });

  let firstTurn = true;
  pi.on("before_agent_start", async (event, ctx) => {
    if (isTeammate && firstTurn) {
      firstTurn = false;

      let modelInfo = "";
      if (teamName) {
        try {
          const teamConfig = await teams.readConfig(teamName);
          const member = teamConfig.members.find(m => m.name === agentName);
          if (member && member.model) {
            modelInfo = `\nYou are currently using model: ${member.model}`;
            if (member.thinking) {
              modelInfo += ` with thinking level: ${member.thinking}`;
            }
            modelInfo += `. When reporting your model or thinking level, use these exact values.`;
          }
        } catch (e) {
          // Ignore
        }
      }

      return {
        systemPrompt: event.systemPrompt + `\n\nYou are teammate '${agentName}' on team '${teamName}'.\nYour lead is 'team-lead'.${modelInfo}\nStart by calling read_inbox(team_name="${teamName}") to get your initial instructions.`,
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
        // ignore
      }
    }

    if (member.windowId && terminal) {
      terminal.killWindow(member.windowId);
    }

    if (member.tmuxPaneId && terminal) {
      terminal.kill(member.tmuxPaneId);
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
      separate_windows: Type.Optional(Type.Boolean({ default: false, description: "Open teammates in separate OS windows instead of panes" })),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const config = teams.createTeam(params.team_name, "local-session", "lead-agent", params.description, params.default_model, params.separate_windows);
      return {
        content: [{ type: "text", text: `Team ${params.team_name} created.` }],
        details: { config },
      };
    },
  });

  pi.registerTool({
    name: "spawn_teammate",
    label: "Spawn Teammate",
    description: "Spawn a new teammate in a terminal pane or separate window.",
    parameters: Type.Object({
      team_name: Type.String(),
      name: Type.String(),
      prompt: Type.String(),
      cwd: Type.String(),
      model: Type.Optional(Type.String()),
      thinking: Type.Optional(StringEnum(["off", "minimal", "low", "medium", "high"])),
      plan_mode_required: Type.Optional(Type.Boolean({ default: false })),
      separate_window: Type.Optional(Type.Boolean({ default: false })),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const safeName = paths.sanitizeName(params.name);
      const safeTeamName = paths.sanitizeName(params.team_name);

      if (!teams.teamExists(safeTeamName)) {
        throw new Error(`Team ${params.team_name} does not exist`);
      }

      if (!terminal) {
        throw new Error("No terminal adapter detected.");
      }

      const teamConfig = await teams.readConfig(safeTeamName);
      let chosenModel = params.model || teamConfig.defaultModel;

      if (chosenModel && !chosenModel.includes('/')) {
        if (teamConfig.defaultModel && teamConfig.defaultModel.includes('/')) {
          const [provider] = teamConfig.defaultModel.split('/');
          chosenModel = `${provider}/${chosenModel}`;
        } else {
          if (chosenModel.startsWith('glm-')) {
            chosenModel = `zai/${chosenModel}`;
          } else if (chosenModel.startsWith('claude-')) {
            chosenModel = `anthropic/${chosenModel}`;
          }
        }
      }

      const useSeparateWindow = params.separate_window ?? teamConfig.separateWindows ?? false;
      if (useSeparateWindow && !terminal.supportsWindows()) {
        throw new Error(`Separate windows mode is not supported in ${terminal.name}.`);
      }

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
        thinking: params.thinking,
        planModeRequired: params.plan_mode_required,
      };

      await teams.addMember(safeTeamName, member);
      await messaging.sendPlainMessage(safeTeamName, "team-lead", safeName, params.prompt, "Initial prompt");

      const piBinary = process.argv[1] ? `node ${process.argv[1]}` : "pi";
      let piCmd = piBinary;

      if (chosenModel) {
        const [provider, ...modelParts] = chosenModel.split('/');
        const modelName = modelParts.join('/');
        if (params.thinking) {
          piCmd = `${piBinary} --provider ${provider} --model ${modelName}:${params.thinking}`;
        } else {
          piCmd = `${piBinary} --provider ${provider} --model ${modelName}`;
        }
      } else if (params.thinking) {
        piCmd = `${piBinary} --thinking ${params.thinking}`;
      }

      const env: Record<string, string> = {
        ...process.env,
        PI_TEAM_NAME: safeTeamName,
        PI_AGENT_NAME: safeName,
      };

      let terminalId = "";
      let isWindow = false;

      try {
        if (useSeparateWindow) {
          isWindow = true;
          terminalId = terminal.spawnWindow({
            name: safeName,
            cwd: params.cwd,
            command: piCmd,
            env: env,
            teamName: safeTeamName,
          });
          await teams.updateMember(safeTeamName, safeName, { windowId: terminalId });
        } else {
          if (terminal instanceof Iterm2Adapter) {
            const teammates = teamConfig.members.filter(m => m.agentType === "teammate" && m.tmuxPaneId.startsWith("iterm_"));
            const lastTeammate = teammates.length > 0 ? teammates[teammates.length - 1] : null;
            if (lastTeammate?.tmuxPaneId) {
              terminal.setSpawnContext({ lastSessionId: lastTeammate.tmuxPaneId.replace("iterm_", "") });
            } else {
              terminal.setSpawnContext({});
            }
          }

          terminalId = terminal.spawn({
            name: safeName,
            cwd: params.cwd,
            command: piCmd,
            env: env,
          });
          await teams.updateMember(safeTeamName, safeName, { tmuxPaneId: terminalId });
        }
      } catch (e) {
        throw new Error(`Failed to spawn ${terminal.name} ${isWindow ? 'window' : 'pane'}: ${e}`);
      }

      return {
        content: [{ type: "text", text: `Teammate ${params.name} spawned in ${isWindow ? 'window' : 'pane'} ${terminalId}.` }],
        details: { agentId: member.agentId, terminalId, isWindow },
      };
    },
  });

  pi.registerTool({
    name: "spawn_lead_window",
    label: "Spawn Lead Window",
    description: "Open the team lead in a separate OS window.",
    parameters: Type.Object({
      team_name: Type.String(),
      cwd: Type.Optional(Type.String()),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const safeTeamName = paths.sanitizeName(params.team_name);
      if (!teams.teamExists(safeTeamName)) throw new Error(`Team ${params.team_name} does not exist`);
      if (!terminal || !terminal.supportsWindows()) throw new Error("Windows mode not supported.");

      const teamConfig = await teams.readConfig(safeTeamName);
      const cwd = params.cwd || process.cwd();
      const piBinary = process.argv[1] ? `node ${process.argv[1]}` : "pi";
      let piCmd = piBinary;
      if (teamConfig.defaultModel) {
        const [provider, ...modelParts] = teamConfig.defaultModel.split('/');
        piCmd = `${piBinary} --provider ${provider} --model ${modelParts.join('/')}`;
      }

      const env = { ...process.env, PI_TEAM_NAME: safeTeamName, PI_AGENT_NAME: "team-lead" };
      try {
        const windowId = terminal.spawnWindow({ name: "team-lead", cwd, command: piCmd, env, teamName: safeTeamName });
        await teams.updateMember(safeTeamName, "team-lead", { windowId });
        return { content: [{ type: "text", text: `Lead window spawned: ${windowId}` }], details: { windowId } };
      } catch (e) {
        throw new Error(`Failed: ${e}`);
      }
    }
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
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      await messaging.sendPlainMessage(params.team_name, agentName, params.recipient, params.content, params.summary);
      return {
        content: [{ type: "text", text: `Message sent to ${params.recipient}.` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "broadcast_message",
    label: "Broadcast Message",
    description: "Broadcast a message to all team members except the sender.",
    parameters: Type.Object({
      team_name: Type.String(),
      content: Type.String(),
      summary: Type.String(),
      color: Type.Optional(Type.String()),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      await messaging.broadcastMessage(params.team_name, agentName, params.content, params.summary, params.color);
      return {
        content: [{ type: "text", text: `Message broadcasted to all team members.` }],
        details: {},
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
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
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
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const task = await tasks.createTask(params.team_name, params.subject, params.description);
      return {
        content: [{ type: "text", text: `Task ${task.id} created.` }],
        details: { task },
      };
    },
  });

  pi.registerTool({
    name: "task_submit_plan",
    label: "Submit Plan",
    description: "Submit a plan for a task, updating its status to 'planning'.",
    parameters: Type.Object({
      team_name: Type.String(),
      task_id: Type.String(),
      plan: Type.String(),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const updated = await tasks.submitPlan(params.team_name, params.task_id, params.plan);
      return {
        content: [{ type: "text", text: `Plan submitted for task ${params.task_id}.` }],
        details: { task: updated },
      };
    },
  });

  pi.registerTool({
    name: "task_evaluate_plan",
    label: "Evaluate Plan",
    description: "Evaluate a submitted plan for a task.",
    parameters: Type.Object({
      team_name: Type.String(),
      task_id: Type.String(),
      action: StringEnum(["approve", "reject"]),
      feedback: Type.Optional(Type.String({ description: "Required for rejection" })),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const updated = await tasks.evaluatePlan(params.team_name, params.task_id, params.action as any, params.feedback);
      return {
        content: [{ type: "text", text: `Plan for task ${params.task_id} has been ${params.action}d.` }],
        details: { task: updated },
      };
    },
  });

  pi.registerTool({
    name: "task_list",
    label: "List Tasks",
    description: "List all tasks for a team.",
    parameters: Type.Object({
      team_name: Type.String(),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
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
      status: Type.Optional(StringEnum(["pending", "planning", "in_progress", "completed", "deleted"])),
      owner: Type.Optional(Type.String()),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
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
    name: "team_shutdown",
    label: "Shutdown Team",
    description: "Shutdown the entire team and close all panes/windows.",
    parameters: Type.Object({
      team_name: Type.String(),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const teamName = params.team_name;
      try {
        const config = await teams.readConfig(teamName);
        for (const member of config.members) {
          await killTeammate(teamName, member);
        }
        const dir = paths.teamDir(teamName);
        const tasksDir = paths.taskDir(teamName);
        if (fs.existsSync(tasksDir)) fs.rmSync(tasksDir, { recursive: true });
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
        return { content: [{ type: "text", text: `Team ${teamName} shut down.` }], details: {} };
      } catch (e) {
        throw new Error(`Failed to shutdown team: ${e}`);
      }
    },
  });

  pi.registerTool({
    name: "task_read",
    label: "Read Task",
    description: "Read details of a specific task.",
    parameters: Type.Object({
      team_name: Type.String(),
      task_id: Type.String(),
    }),
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const task = await tasks.readTask(params.team_name, params.task_id);
      return {
        content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
        details: { task },
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
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const config = await teams.readConfig(params.team_name);
      const member = config.members.find(m => m.name === params.agent_name);
      if (!member) throw new Error(`Teammate ${params.agent_name} not found`);

      let alive = false;
      if (member.windowId && terminal) {
        alive = terminal.isWindowAlive(member.windowId);
      } else if (member.tmuxPaneId && terminal) {
        alive = terminal.isAlive(member.tmuxPaneId);
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
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      const config = await teams.readConfig(params.team_name);
      const member = config.members.find(m => m.name === params.agent_name);
      if (member) {
        await killTeammate(params.team_name, member);
        await teams.removeMember(params.team_name, params.agent_name);
      }
      return { content: [{ type: "text", text: `Teammate ${params.agent_name} shutdown processed.` }], details: {} };
    },
  });
}
