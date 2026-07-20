export type UserContext = {
  role: string;
  goal: string;
  why: string;
  updatedAt: string;
};

export type Material = { id: string; rawText: string; createdAt: string };
export type Segment = { id: string; materialId: string; text: string; mode: "ear" | "desk"; reason: string };
export type EarEpisode = { id: string; materialId: string; script: string; audioUrl?: string };
export type DeskTask = { id: string; materialId: string; problem: string; why: string; status: "todo" | "done" };
export type GapEntry = {
  id: string;
  topic: string;
  reason: string;
  source: "detected" | "user_reported";
  resolved: boolean;
};

export type Projection = {
  segments: Array<Pick<Segment, "text" | "mode" | "reason">>;
  earScript: string;
  deskTask: Pick<DeskTask, "problem" | "why">;
  gaps: Array<Pick<GapEntry, "topic" | "reason">>;
  source?: "gpt-5.6" | "demo";
};
