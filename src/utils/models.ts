export interface Member {
  agentId: string;
  name: string;
  agentType: string;
  model: string;
  joinedAt: number;
  tmuxPaneId: string;
  cwd: string;
  subscriptions: any[];
  prompt?: string;
  color?: string;
  planModeRequired?: boolean;
  backendType?: string;
  isActive?: boolean;
}

export interface TeamConfig {
  name: string;
  description: string;
  createdAt: number;
  leadAgentId: string;
  leadSessionId: string;
  members: Member[];
}

export interface TaskFile {
  id: string;
  subject: string;
  description: string;
  activeForm?: string;
  status: "pending" | "in_progress" | "completed" | "deleted";
  blocks: string[];
  blockedBy: string[];
  owner?: string;
  metadata?: Record<string, any>;
}

export interface InboxMessage {
  from: string;
  text: string;
  timestamp: string;
  read: boolean;
  summary?: string;
  color?: string;
}
