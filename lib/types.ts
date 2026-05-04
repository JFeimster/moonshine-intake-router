export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type UnknownRecord = Record<string, unknown>;

export type PartnerApplicant = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  currentWork?: string;
  salesExperience?: string;
  previousExperience?: string;
  preferredStart?: string;
  interestReason?: string;
  wantsStrategyCall?: string;
  rawPayload: unknown;
};

export type HubSpotContact = {
  id: string;
  properties?: Record<string, string | null | undefined>;
};

export type HubSpotContactAction = "created" | "updated" | "existing";

export type HubSpotContactResult = {
  action: HubSpotContactAction;
  contactId: string;
};

export type NotionPartnerApplicantResult = {
  pageId: string;
  url?: string;
};

export type IntakeRouterSuccessResponse = {
  ok: true;
  action: HubSpotContactAction;
  hubspotContactId: string;
  notionPageId?: string;
  message: string;
};

export type IntakeRouterErrorResponse = {
  ok: false;
  message: string;
  errors: string[];
};

export type IntakeRouterResponse =
  | IntakeRouterSuccessResponse
  | IntakeRouterErrorResponse;
