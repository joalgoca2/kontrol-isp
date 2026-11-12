export type NodeStatus = "ONLINE" | "OFFLINE" | "WARNING" | "UNREACHABLE";

export interface MikrotikNode {
  id: string;
  brandId: string;
  name: string;
  code: string;
  location: string;
  host: string;
  port: number;
  username: string;
  passwordEncrypted: string;
  fallbackHost?: string | null;
  useTls: boolean;
  isActive: boolean;
  status: NodeStatus;
  lastCheckAt?: string | Date | null;
  latencyMs?: number | null;
  activeSessions: number;
  cpuUsage?: number | null;
  routerOsVersion?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MikrotikNodeWithCounts extends MikrotikNode {
  _count?: {
    contracts: number;
  };
}

export interface MikrotikNodesPaginatedResponse {
  nodes: MikrotikNodeWithCounts[];
  total: number;
  totalPages: number;
  onlineCount: number;
  offlineCount: number;
  withoutContractsCount: number;
}

export interface MikrotikActiveSession {
  id: string;
  name: string;
  service: string;
  callerId?: string;
  address: string;
  uptime: string;
  encoding?: string;
  sessionId?: string;
  radius?: boolean;
}

export type TrafficLightColor = "GREEN" | "YELLOW" | "RED";

export interface MikrotikLiveDiagnostic {
  connected: boolean;
  targetHost: string;
  targetPort: number;
  sessionFound: boolean;
  session?: MikrotikActiveSession | null;
  secretFound?: boolean;
  secretDisabled?: boolean;
  secretProfile?: string | null;
  secretRemoteAddress?: string | null;
  lastLoggedOut?: string | null;
  lastCallerId?: string | null;
  lastDisconnectReason?: string | null;
  latencyMs?: number;
  error?: string | null;
  trafficLight?: TrafficLightColor;
  trafficSummary?: string;
  trafficRecommendation?: string;
}

export interface MikrotikSecret {
  id: string;
  name: string;
  service?: string;
  profile?: string;
  disabled: boolean;
  comment?: string;
  remoteAddress?: string;
  lastCallerId?: string;
  lastLoggedOut?: string;
  lastDisconnectReason?: string;
}

export interface ContractAuditOrphanInCrm {
  contractId: string;
  contractNumber: string;
  clientName: string;
  clientPhone?: string | null;
  pppoeUser: string;
  pppoePassword?: string | null;
  planName?: string | null;
  planProfile?: string | null;
  serviceStatus: string;
  billingStatus: string;
  detectedRetiredInRouter?: boolean;
  routerSecretName?: string;
}

export interface ContractAuditOrphanInRouter {
  name: string;
  profile?: string;
  disabled: boolean;
  comment?: string;
  remoteAddress?: string;
  lastLoggedOut?: string;
}

export interface ContractAuditSynced {
  contractId: string;
  contractNumber: string;
  clientName: string;
  pppoeUser: string;
  serviceStatus: string;
  disabledInRouter: boolean;
  profileInRouter?: string;
}

export interface ContractAuditResult {
  nodeId: string;
  nodeName: string;
  totalCrmActive: number;
  totalRouterSecrets: number;
  syncedCount: number;
  detectedRetiredCount: number;
  orphansInCrm: ContractAuditOrphanInCrm[];
  orphansInRouter: ContractAuditOrphanInRouter[];
  synced: ContractAuditSynced[];
}

