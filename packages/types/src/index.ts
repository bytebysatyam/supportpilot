export const USER_ROLES = ["ADMIN", "SUPPORT_AGENT", "CUSTOMER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  "GENERAL",
  "BILLING",
  "TECHNICAL",
  "ACCOUNT",
  "PRODUCT",
  "FEATURE_REQUEST",
  "OTHER",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const AI_TYPES = [
  "CLASSIFICATION",
  "SUMMARY",
  "PRIORITY_SUGGESTION",
  "DRAFT_RESPONSE",
] as const;
export type AnalysisType = (typeof AI_TYPES)[number];

export const STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> =
  {
    OPEN: ["IN_PROGRESS", "CLOSED"],
    IN_PROGRESS: ["OPEN", "WAITING_ON_CUSTOMER", "RESOLVED"],
    WAITING_ON_CUSTOMER: ["IN_PROGRESS", "RESOLVED"],
    RESOLVED: ["IN_PROGRESS", "CLOSED"],
    CLOSED: [],
  };

export type Person = { id: string; name: string; email: string };
export type SessionUser = Person & { role: UserRole };
export type Session = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
};
export type Ticket = {
  id: string;
  ticketNumber: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  createdAt: string;
  updatedAt: string;
  customer: Person;
  assignedAgent: Person | null;
};
export type TicketDetail = Ticket & {
  description: string;
  firstResponseDueAt: string | null;
  firstRespondedAt: string | null;
  resolutionDueAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  team: { id: string; name: string } | null;
};
export type TicketList = {
  items: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
export type TicketMessage = {
  id: string;
  body: string;
  isInternal: boolean;
  authorType: "CUSTOMER" | "AGENT" | "SYSTEM";
  createdAt: string;
  author: { id: string; name: string; role: UserRole } | null;
};
export type TimelineItem =
  | { type: "MESSAGE"; occurredAt: string; data: TicketMessage }
  | {
      type: "AUDIT";
      occurredAt: string;
      data: {
        id: string;
        action: string;
        metadata: unknown;
        actor: { id: string; name: string; role: UserRole } | null;
      };
    };
export type SlaIndicator = {
  dueAt: string | null;
  met: boolean;
  breached: boolean;
  atRisk: boolean;
};
export type SlaSnapshot = {
  firstResponse: SlaIndicator & {
    respondedAt: string | null;
    closedWithoutReply: boolean;
  };
  resolution: SlaIndicator & { resolvedAt: string | null };
};
export type AiResult =
  | { category: TicketCategory; confidence: number; rationale: string }
  | { priority: TicketPriority; confidence: number; rationale: string }
  | { summary: string; keyPoints: string[] }
  | { response: string; tone: "professional" | "empathetic" | "concise" };
export type AiAnalysis = {
  id: string;
  type: AnalysisType;
  status: "PENDING" | "COMPLETED" | "FAILED";
  result: AiResult | null;
  provider: string | null;
  model: string | null;
  errorMessage: string | null;
  createdAt: string;
};
export type DashboardSummary = {
  open: number;
  unassigned: number;
  urgent: number;
  breached: number;
  atRisk: number;
  assignedToMe: number;
  asOf: string;
};
export type StaffMember = SessionUser & {
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  _count: { assignedTickets: number };
};
export type Assignment = {
  id: string;
  assignedAt: string;
  unassignedAt: string | null;
  agent: Person;
  assignedBy: Person | null;
};
