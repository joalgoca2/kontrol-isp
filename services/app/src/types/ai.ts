export type AiRole = "user" | "assistant" | "system";
export type AiProviderType = "mock" | "guided" | "gemini" | "openai" | "anthropic";

export interface AiChatMessage {
  id: string;
  role: AiRole;
  content: string;
  createdAt: string;
}

export interface SendAiMessageInput {
  message: string;
  contextPath?: string;
  history?: {
    role: AiRole;
    content: string;
  }[];
}

export interface AiEngineResponse {
  message: string;
  provider: AiProviderType;
  tokensUsed?: number;
  toolInvocations?: Array<{
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
}

export interface AiConversationLog {
  id: string;
  brandId: string;
  contractId?: string | null;
  channel: string;
  senderIdentifier: string;
  userMessage: string;
  aiResponse: string;
  toolsInvoked?: unknown;
  transferredToHuman: boolean;
  tokensUsed?: number | null;
  createdAt: string | Date;
}

export type AiTemplateType =
  | "BAILEYS_AI"
  | "META_CLOUD_API"
  | "RULES_BOT";

export type AiTone = "AMABLE" | "FORMAL" | "TECNICO";

export type FlowActionType =
  | "DIAGNOSTIC_MIKROTIK"
  | "KICK_PPPOE_SESSION"
  | "BILLING_BALANCE"
  | "PROMISE_PAYMENT"
  | "SCHEDULE_VISIT"
  | "TRANSFER_HUMAN"
  | "CUSTOM_TEXT"
  | "BRANCH_MENU"
  | "GO_BACK";

export interface FlowMenuOption {
  id: string;
  digit: string;
  title: string;
  keywords: string[];
  actionType: FlowActionType;
  condition?: "IS_MORA" | "IS_ACTIVE" | "ALL";
  responseText: string;
  enabled: boolean;
  subOptions?: FlowMenuOption[];
}

export interface FlowTreeNode {
  id: string;
  name: string;
  message: string;
  condition?: "IS_MORA" | "IS_ACTIVE" | "NONE";
  actionType?: FlowActionType;
  children?: FlowTreeOption[];
}

export interface FlowTreeOption {
  id: string;
  digit: string;
  label: string;
  keywords?: string[];
  node: FlowTreeNode;
}

export interface ChatbotWelcomeStep {
  greeting: string;
  requireIdentification: boolean;
  askIdentifierPrompt: string;
  notFoundMessage: string;
}

export interface ChatbotMenuStep {
  menuHeader: string;
  options: FlowMenuOption[];
}

export interface ChatbotFallbackStep {
  triggerKeywords: string[];
  maxUnknownAttempts: number;
  fallbackMessage: string;
  transferMessage: string;
}

export interface ChatbotFlowConfig {
  version: "1.0" | "2.0";
  historyLimit?: number;
  welcomeStep: ChatbotWelcomeStep;
  menuStep: ChatbotMenuStep;
  rootNode?: FlowTreeNode;
  fallbackStep: ChatbotFallbackStep;
}

export interface BrandAiConfig {
  id: string;
  brandId: string;
  templateType: AiTemplateType;
  botName: string;
  tone: AiTone;
  systemPrompt?: string | null;
  flowConfig?: ChatbotFlowConfig | null;
  allowDiagnosticMikrotik: boolean;
  allowKickSession: boolean;
  allowGracePromise: boolean;
  graceHours: number;
  allowScheduleVisits: boolean;
  morningVisitSlots: number;
  afternoonVisitSlots: number;
  allowBillingBalance: boolean;
  allowTransferHuman: boolean;
  allowCheckVisits: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}
