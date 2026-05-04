import type { PartnerApplicant, UnknownRecord } from "@/lib/types";

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => stringifyValue(item))
      .filter(Boolean)
      .join(", ");

    return joined || undefined;
  }

  if (isRecord(value)) {
    if (typeof value.value === "string") return value.value;
    if (typeof value.text === "string") return value.text;
    if (typeof value.label === "string") return value.label;
    if (typeof value.name === "string") return value.name;

    return JSON.stringify(value);
  }

  return String(value).trim() || undefined;
}

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[#🔥?.,!–—:'’“”\-/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAnswers(payload: unknown): Record<string, string> {
  const answers: Record<string, string> = {};

  function walk(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    if (!isRecord(value)) return;

    const title = stringifyValue(value.title) ?? stringifyValue(value.question) ?? stringifyValue(value.label) ?? stringifyValue(value.name);
    const answer = stringifyValue(value.answer) ?? stringifyValue(value.value) ?? stringifyValue(value.response);

    if (title && answer) {
      answers[normalizeKey(title)] = answer;
    }

    for (const nestedValue of Object.values(value)) {
      if (typeof nestedValue === "object" && nestedValue !== null) {
        walk(nestedValue);
      }
    }
  }

  walk(payload);

  if (isRecord(payload)) {
    for (const [key, value] of Object.entries(payload)) {
      const stringValue = stringifyValue(value);
      if (stringValue && !answers[normalizeKey(key)]) {
        answers[normalizeKey(key)] = stringValue;
      }
    }
  }

  return answers;
}

function findAnswer(answers: Record<string, string>, patterns: RegExp[]): string | undefined {
  for (const [key, value] of Object.entries(answers)) {
    if (patterns.some((pattern) => pattern.test(key))) {
      return value;
    }
  }

  return undefined;
}

function splitName(fullName?: string): { firstName: string; lastName: string } {
  const cleaned = fullName?.trim().replace(/\s+/g, " ") ?? "";
  if (!cleaned) return { firstName: "", lastName: "" };

  const parts = cleaned.split(" ");
  const firstName = parts.shift() ?? "";
  const lastName = parts.join(" ");

  return { firstName, lastName };
}

function normalizeEmail(email?: string): string {
  return email?.trim().toLowerCase() ?? "";
}

export function normalizeTallyPartnerApplicant(payload: unknown): PartnerApplicant {
  const answers = extractAnswers(payload);

  const fullName = findAnswer(answers, [
    /what s your name/,
    /whats your name/,
    /your name/,
    /^name$/,
    /full name/,
  ]);

  const email = normalizeEmail(
    findAnswer(answers, [
      /where should we send/,
      /onboarding link/,
      /^email$/,
      /email address/,
      /primary email/,
    ]),
  );

  const currentWork = findAnswer(answers, [
    /what best describes/,
    /current work/,
    /current hustle/,
    /hustle/,
  ]);

  const salesExperience = findAnswer(answers, [
    /ever worked in sales/,
    /sales finance/,
    /helping business owners/,
    /sales experience/,
  ]);

  const previousExperience = findAnswer(answers, [
    /quick and dirty/,
    /tell us what you ve done/,
    /tell us what youve done/,
    /previous experience/,
    /what you ve done/,
    /what youve done/,
  ]);

  const preferredStart = findAnswer(answers, [
    /how soon/,
    /start earning/,
    /preferred start/,
    /start timeline/,
  ]);

  const interestReason = findAnswer(answers, [
    /why are you interested/,
    /interested in becoming/,
    /interest reason/,
  ]);

  const wantsStrategyCall = findAnswer(answers, [
    /1 on 1 strategy call/,
    /one on one strategy call/,
    /strategy call/,
  ]);

  const { firstName, lastName } = splitName(fullName);

  return {
    fullName: fullName?.trim() ?? "",
    firstName,
    lastName,
    email,
    currentWork,
    salesExperience,
    previousExperience,
    preferredStart,
    interestReason,
    wantsStrategyCall,
    rawPayload: payload,
  };
}

export function validatePartnerApplicant(applicant: PartnerApplicant): string[] {
  const errors: string[] = [];

  if (!applicant.email) {
    errors.push("Missing applicant email.");
  }

  if (applicant.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) {
    errors.push("Applicant email is invalid.");
  }

  if (!applicant.fullName) {
    errors.push("Missing applicant name.");
  }

  return errors;
}

export function buildPartnerApplicantSummary(applicant: PartnerApplicant): string {
  return [
    "## Partner Applicant Intake Note",
    "",
    `Applicant: ${applicant.fullName || "Not provided"}`,
    `Email: ${applicant.email || "Not provided"}`,
    "Source: Tally form — Join the #1 B2B Funding Platform",
    "Submission type: Partner applicant",
    "",
    "Current work / hustle:",
    `- ${applicant.currentWork || "Not provided"}`,
    "",
    "Sales / finance / business-owner experience:",
    `- ${applicant.salesExperience || "Not provided"}`,
    applicant.previousExperience ? `- ${applicant.previousExperience}` : "- Experience detail not provided",
    "",
    `Start timeline: ${applicant.preferredStart || "Not provided"}`,
    "",
    "Reason for interest:",
    `- ${applicant.interestReason || "Not provided"}`,
    "",
    `Strategy call requested: ${applicant.wantsStrategyCall || "Not provided"}`,
    "",
    "Operational note:",
    "Applicant appears to be a partner / affiliate applicant, not a funding applicant. No company should be created unless a real business/entity is provided. No deal should be created because this is not a funding request.",
  ].join("\n");
}
