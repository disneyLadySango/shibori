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

export type DeskEvaluation = {
  verdict: "mastered" | "retry";
  feedback: string;
  modelAnswer: string;
  nextAction: string;
  gap: { topic: string; reason: string } | null;
  source?: "gpt-5.6" | "demo";
};

export type LearningSession = {
  material: string;
  projection: Projection;
  deskAnswer: string;
  evaluation: DeskEvaluation | null;
  updatedAt: string;
};

export type LearningPurpose = {
  id: string;
  statement: string;
  role: string;
  why: string;
  priority: "normal";
  createdAt: string;
};

export type LearningPathNode = {
  id: string;
  title: string;
  dependsOn: string[];
  status: "unknown" | "unconfirmed" | "confirmed" | "gap";
};

export type FocusRecommendation = {
  id: string;
  kind: "explore" | "learn" | "reinforce";
  title: string;
  reason: string;
  nodeId: string | null;
};

export type UnderstandingCheckResult = {
  nodeId: string;
  outcome: "confirmed" | "gap";
  summary: string;
  nextAction: string;
  gap: Omit<LearningGap, "status"> | null;
};

export type LearningGap = {
  id: string;
  topic: string;
  reason: string;
  impact: string;
  returnNodeId: string;
  status: "recommended" | "deferred" | "resolved";
};

export type LearningState = {
  version: 2;
  purpose: LearningPurpose;
  phase: "exploring" | "learning";
  targetState: string | null;
  path: LearningPathNode[];
  currentNodeId: string | null;
  focus: FocusRecommendation | null;
  lastCheck: UnderstandingCheckResult | null;
  gaps: LearningGap[];
  updatedAt: string;
};

export type LearningPlanProposal = {
  mode: "exploring" | "learning";
  targetState: string | null;
  path: LearningPathNode[];
  currentNodeId: string | null;
  focus: FocusRecommendation;
  check: {
    nodeId: string | null;
    prompt: string;
    reason: string;
  };
};

export type PurposeRecommendation = {
  purposeId: string;
  reason: string;
  basis: string[];
};

export type LearningPortfolio = {
  version: 3;
  purposes: LearningState[];
  selectedPurposeId: string;
  recommendation: PurposeRecommendation | null;
  updatedAt: string;
};
