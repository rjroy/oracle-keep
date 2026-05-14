export type SessionRecord = {
  id: string;
  cwd: string;
  label: string;
  addedAt: string; // ISO 8601
  sessionFile?: string; // Path to the pi .jsonl session file, written after first init
};

export type SessionRegistry = {
  sessions: SessionRecord[];
};

export type SessionListItem = SessionRecord & { isProcessing: boolean };
