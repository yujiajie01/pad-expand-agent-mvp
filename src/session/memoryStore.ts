import { randomUUID } from "node:crypto";
import { createInitialState, type AgentState } from "../graph/state";

type SessionRecord = {
  id: string;
  state: AgentState;
  createdAt: string;
  updatedAt: string;
};

export class MemorySessionStore {
  private sessions = new Map<string, SessionRecord>();

  createSession(initialState?: AgentState): SessionRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    const record: SessionRecord = {
      id,
      state: initialState ?? createInitialState(),
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, record);
    return record;
  }

  getSession(id: string): SessionRecord | undefined {
    return this.sessions.get(id);
  }

  updateState(id: string, state: AgentState): SessionRecord | undefined {
    const current = this.sessions.get(id);
    if (!current) return undefined;
    const updated: SessionRecord = {
      ...current,
      state,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(id, updated);
    return updated;
  }
}

