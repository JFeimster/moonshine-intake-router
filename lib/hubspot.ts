import type { HubSpotContact, HubSpotContactResult, PartnerApplicant } from "@/lib/types";

type HubSpotSearchResponse = {
  results?: HubSpotContact[];
};

type HubSpotCreateOrUpdateResponse = {
  id: string;
  properties?: Record<string, string | null>;
};

type HubSpotAssociationResponse = {
  id?: string;
};

const HUBSPOT_BASE_URL = "https://api.hubapi.com";

function getHubSpotToken(): string {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!token) {
    throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN environment variable.");
  }

  return token;
}

function getHubSpotOwnerId(): string | undefined {
  return process.env.HUBSPOT_OWNER_ID?.trim() || undefined;
}

async function hubspotRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getHubSpotToken()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : response.statusText;
    throw new Error(`HubSpot API error (${response.status}): ${message}`);
  }

  return payload as T;
}

export async function searchHubSpotContactByEmail(email: string): Promise<HubSpotContact | null> {
  const payload = await hubspotRequest<HubSpotSearchResponse>("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "EQ",
              value: email,
            },
          ],
        },
      ],
      properties: ["firstname", "lastname", "email", "lifecyclestage", "hs_lead_status", "hubspot_owner_id"],
      limit: 1,
    }),
  });

  return payload.results?.[0] ?? null;
}

function buildSafeContactProperties(applicant: PartnerApplicant, existing?: HubSpotContact | null): Record<string, string> {
  const ownerId = getHubSpotOwnerId();
  const existingProperties = existing?.properties ?? {};
  const properties: Record<string, string> = {};

  if (!existingProperties.firstname && applicant.firstName) {
    properties.firstname = applicant.firstName;
  }

  if (!existingProperties.lastname && applicant.lastName) {
    properties.lastname = applicant.lastName;
  }

  if (!existing) {
    properties.email = applicant.email;
    properties.lifecyclestage = "lead";
    properties.hs_lead_status = "AFFILIATE_PARTNER";

    if (ownerId) {
      properties.hubspot_owner_id = ownerId;
    }

    return properties;
  }

  if (!existingProperties.hs_lead_status) {
    properties.hs_lead_status = "AFFILIATE_PARTNER";
  }

  if (!existingProperties.hubspot_owner_id && ownerId) {
    properties.hubspot_owner_id = ownerId;
  }

  return properties;
}

export async function createHubSpotPartnerContact(applicant: PartnerApplicant): Promise<HubSpotContactResult> {
  const properties = buildSafeContactProperties(applicant, null);

  const contact = await hubspotRequest<HubSpotCreateOrUpdateResponse>("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });

  return {
    action: "created",
    contactId: contact.id,
  };
}

export async function updateHubSpotPartnerContact(
  contact: HubSpotContact,
  applicant: PartnerApplicant,
): Promise<HubSpotContactResult> {
  const properties = buildSafeContactProperties(applicant, contact);

  if (Object.keys(properties).length === 0) {
    return {
      action: "existing",
      contactId: contact.id,
    };
  }

  const updatedContact = await hubspotRequest<HubSpotCreateOrUpdateResponse>(`/crm/v3/objects/contacts/${contact.id}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });

  return {
    action: "updated",
    contactId: updatedContact.id,
  };
}

export async function upsertHubSpotPartnerContact(applicant: PartnerApplicant): Promise<HubSpotContactResult> {
  const existingContact = await searchHubSpotContactByEmail(applicant.email);

  if (existingContact) {
    return updateHubSpotPartnerContact(existingContact, applicant);
  }

  return createHubSpotPartnerContact(applicant);
}

export async function createHubSpotContactNote(contactId: string, noteBody: string): Promise<string> {
  const timestamp = new Date().toISOString();

  const note = await hubspotRequest<HubSpotAssociationResponse>("/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_timestamp: timestamp,
        hs_note_body: noteBody,
      },
      associations: [
        {
          to: {
            id: contactId,
          },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 202,
            },
          ],
        },
      ],
    }),
  });

  if (!note.id) {
    throw new Error("HubSpot note was created without returning an ID.");
  }

  return note.id;
}
