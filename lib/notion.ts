import { getNextBusinessDayIsoDate, getTodayIsoDate, mapPreferredStartToNotionOption } from "@/lib/dates";
import type { NotionPartnerApplicantResult, PartnerApplicant } from "@/lib/types";

const NOTION_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

type NotionCreatePageResponse = {
  id: string;
  url?: string;
};

function getNotionApiKey(): string {
  const apiKey = process.env.NOTION_API_KEY;

  if (!apiKey) {
    throw new Error("Missing NOTION_API_KEY environment variable.");
  }

  return apiKey;
}

function getPartnerApplicantsDataSourceId(): string {
  const dataSourceId = process.env.NOTION_PARTNER_APPLICANTS_DATA_SOURCE_ID;

  if (!dataSourceId) {
    throw new Error("Missing NOTION_PARTNER_APPLICANTS_DATA_SOURCE_ID environment variable.");
  }

  return dataSourceId.replace(/^collection:\/\//, "");
}

async function notionRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${NOTION_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getNotionApiKey()}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : response.statusText;
    throw new Error(`Notion API error (${response.status}): ${message}`);
  }

  return payload as T;
}

function richText(content?: string) {
  return {
    rich_text: content
      ? [
          {
            type: "text",
            text: {
              content,
            },
          },
        ]
      : [],
  };
}

function title(content: string) {
  return {
    title: [
      {
        type: "text",
        text: {
          content,
        },
      },
    ],
  };
}

function select(name?: string) {
  return name
    ? {
        select: {
          name,
        },
      }
    : {
        select: null,
      };
}

function checkbox(checked: boolean) {
  return {
    checkbox: checked,
  };
}

function date(start: string) {
  return {
    date: {
      start,
    },
  };
}

function email(address: string) {
  return {
    email: address,
  };
}

function mapWantsStrategyCall(value?: string): string {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized === "yes") return "Yes";
  if (normalized === "no") return "No";
  if (normalized.includes("maybe")) return "Maybe";
  if (normalized.includes("sched")) return "Scheduled";
  if (normalized.includes("complete")) return "Completed";

  return "Maybe";
}

function mapSalesExperience(value?: string): string {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized === "yes") return "Yes";
  if (normalized === "no") return "No";
  if (normalized.includes("kind") || normalized.includes("some")) return "Kind of";

  return "Kind of";
}

function buildNotionNotes(applicant: PartnerApplicant, hubspotContactId: string): string {
  return [
    "Partner applicant submitted Tally form for Join the #1 B2B Funding Platform.",
    `HubSpot contact ID: ${hubspotContactId}.`,
    `Current work / hustle: ${applicant.currentWork || "Not provided"}.`,
    `Previous experience: ${applicant.previousExperience || "Not provided"}.`,
    `Preferred start: ${applicant.preferredStart || "Not provided"}.`,
    `Wants strategy call: ${applicant.wantsStrategyCall || "Not provided"}.`,
    "No company created because no real business/entity was provided.",
    "No deal created because this is a partner applicant, not a funding applicant.",
  ].join(" ");
}

function buildPageContent(applicant: PartnerApplicant, hubspotContactId: string): Record<string, unknown>[] {
  return [
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Intake Summary" } }],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Partner applicant submitted Tally form for Join the #1 B2B Funding Platform.",
            },
          },
        ],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: `Name: ${applicant.fullName || "Not provided"}` } }],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: `Email: ${applicant.email || "Not provided"}` } }],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: `Current work / hustle: ${applicant.currentWork || "Not provided"}` } }],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: `Sales experience: ${applicant.salesExperience || "Not provided"}` } }],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: `Previous experience: ${applicant.previousExperience || "Not provided"}` } }],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: `Preferred start: ${applicant.preferredStart || "Not provided"}` } }],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: `Wants strategy call: ${applicant.wantsStrategyCall || "Not provided"}` } }],
      },
    },
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "CRM Context" } }],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: {
              content: `HubSpot contact ID: ${hubspotContactId}. No company or deal should be created from this partner applicant intake unless later information clearly supports it.`,
            },
          },
        ],
      },
    },
  ];
}

export async function createNotionPartnerApplicant(
  applicant: PartnerApplicant,
  hubspotContactId: string,
): Promise<NotionPartnerApplicantResult> {
  const today = getTodayIsoDate();
  const followUpDate = getNextBusinessDayIsoDate();

  const payload = {
    parent: {
      data_source_id: getPartnerApplicantsDataSourceId(),
    },
    icon: {
      type: "emoji",
      emoji: "🤝",
    },
    properties: {
      Name: title(applicant.fullName || applicant.email),
      Email: email(applicant.email),
      "Lead Source": select("Tally Form"),
      Status: {
        status: {
          name: "New Lead",
        },
      },
      "Sequence Stage": {
        status: {
          name: "Not Started",
        },
      },
      "Partner Lane Chosen": select("Affiliate / Content"),
      "Onboarding Path": select("Beginner"),
      "Sales Experience": select(mapSalesExperience(applicant.salesExperience)),
      "Current Position": richText(applicant.currentWork),
      "Previous Experience": richText(applicant.previousExperience),
      "Preferred Start": select(mapPreferredStartToNotionOption(applicant.preferredStart)),
      "Wants Strategy Call": select(mapWantsStrategyCall(applicant.wantsStrategyCall)),
      "Consent to Contact": checkbox(true),
      "Application Date": date(today),
      "Last Touch Date": date(today),
      "Follow-up Date": date(followUpDate),
      "Interest Reason": richText(applicant.interestReason),
      Notes: richText(buildNotionNotes(applicant, hubspotContactId)),
    },
    children: buildPageContent(applicant, hubspotContactId),
  };

  const page = await notionRequest<NotionCreatePageResponse>("/pages", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    pageId: page.id,
    url: page.url,
  };
}
