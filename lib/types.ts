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
  segments: Array<{
    text: string;
    position: "now" | "later" | "unrelated" | "unknown";
    attention: "light" | "deep" | null;
    reason: string;
  }>;
  fit: { status: "ready" | "no_fit"; reason: string };
  selected: { text: string; attention: "light" | "deep"; reason: string } | null;
  earScript: string | null;
  deskTask: Pick<DeskTask, "problem" | "why"> | null;
  gaps: Array<Pick<GapEntry, "topic" | "reason">>;
  source?: "gpt-5.6" | "demo";
};

export type FocusResource = {
  minutes: number;
  attention: "light" | "deep";
};

export type LearningPosition = {
  targetState: string | null;
  current: string;
  focus: string;
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
  deadline: string | null;
  importance: "low" | "normal" | "high";
  usageContext: string;
  status: "active" | "paused" | "achieved" | "stopped";
  statusReason: string;
  statusChangedAt: string;
  createdAt: string;
};

export type AllocationRecord = {
  id: string;
  depth: "ear" | "desk" | "deep";
  minutes: number;
  note: string;
  recordedAt: string;
};

export type AllocationReflection = {
  judgment: "intentional" | "unintended";
  reason: string;
  recordedAt: string;
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
  source?: "personalized" | "demo" | "learner" | "inferred";
};

export type PositionCorrection = {
  id: string;
  kind: "position" | "dependency";
  previousNodeId: string | null;
  nodeId: string;
  previousDependsOn: string[];
  nextDependsOn: string[];
  reason: string;
  createdAt: string;
};

export type UnderstandingChallenge = {
  id: string;
  checkIndex: number;
  nodeId: string;
  reason: string;
  status: "pending" | "reviewed";
  resolutionCheckIndex: number | null;
  createdAt: string;
};

export type FocusExplanation = {
  basis: Array<{
    label: "学習目的" | "到達状態" | "現在地" | "理解状態";
    value: string;
    certainty: "learner_input" | "confirmed" | "inferred" | "unknown";
  }>;
  uncertainty: string[];
};

export type UnderstandingCheckResult = {
  nodeId: string;
  outcome: "confirmed" | "gap";
  summary: string;
  nextAction: string;
  gap: Omit<LearningGap, "status"> | null;
};

export type NextMove = {
  kind: "advance" | "retry" | "complete";
  title: string;
  reason: string;
  scope: string;
  preserved: string;
};

export type GapRelation = {
  kind: "required" | "unknown";
  explanation: string;
  timing: string;
};

export type TargetAssessment = {
  status: "ready_for_decision" | "checks_remaining" | "no_target";
  basis: string[];
  remaining: string[];
  reason: string;
  finalDecisionOwner: "learner";
};

export type AllocationProgressReview = {
  investedMinutes: number;
  byDepth: Record<"ear" | "desk" | "deep", number>;
  confirmedCount: number;
  gapCount: number;
  judgment: string;
  nextAllocationReason: string;
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
  checkHistory: UnderstandingCheckResult[];
  positionCorrections: PositionCorrection[];
  checkChallenges: UnderstandingChallenge[];
  gaps: LearningGap[];
  allocations: AllocationRecord[];
  allocationReflection: AllocationReflection | null;
  rhythm: { lightMinutes: number; deepMinutes: number; note: string; updatedAt: string } | null;
  targetRevisions: Array<{ previous: string | null; next: string; relatedNodeIds: string[]; reviewNodeIds: string[]; createdAt: string }>;
  focusDecisions: Array<{ previousFocus: FocusRecommendation; reason: string; action: "defer" | "change"; createdAt: string }>;
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
  createdAt?: string;
};

export type PurposeContextChange = {
  purposeId: string;
  before: { deadline: string | null; importance: "low" | "normal" | "high"; usageContext: string };
  after: { deadline: string | null; importance: "low" | "normal" | "high"; usageContext: string };
  changedAt: string;
};

export type LearningPortfolio = {
  version: 4;
  purposes: LearningState[];
  selectedPurposeId: string;
  recommendation: PurposeRecommendation | null;
  recommendationHistory: PurposeRecommendation[];
  contextChanges: PurposeContextChange[];
  updatedAt: string;
};
