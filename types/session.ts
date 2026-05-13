export type SessionRecord = {
  id: string;
  cwd: string;
  label: string;
  addedAt: string; // ISO 8601
};

export type SessionRegistry = {
  sessions: SessionRecord[];
};

export type SessionListItem = SessionRecord & { isProcessing: boolean };
