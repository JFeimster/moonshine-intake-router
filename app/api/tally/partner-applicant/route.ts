import { NextRequest, NextResponse } from "next/server";

import { createHubSpotContactNote, upsertHubSpotPartnerContact } from "@/lib/hubspot";
import { createNotionPartnerApplicant } from "@/lib/notion";
import {
  buildPartnerApplicantSummary,
  normalizeTallyPartnerApplicant,
  validatePartnerApplicant,
} from "@/lib/normalizeTally";
import type { IntakeRouterErrorResponse, IntakeRouterSuccessResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProcessingError = {
  step: string;
  message: string;
};

function getWebhookSecret(): string | undefined {
  return process.env.TALLY_WEBHOOK_SECRET?.trim() || undefined;
}

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = getWebhookSecret();

  if (!configuredSecret) {
    return true;
  }

  const headerSecret = request.headers.get("x-tally-secret")?.trim();
  const querySecret = request.nextUrl.searchParams.get("secret")?.trim();

  return headerSecret === configuredSecret || querySecret === configuredSecret;
}

function errorResponse(status: number, message: string, errors: string[]): NextResponse<IntakeRouterErrorResponse> {
  return NextResponse.json(
    {
      ok: false,
      message,
      errors,
    },
    { status },
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return errorResponse(401, "Unauthorized Tally webhook request.", [
      "Webhook secret did not match x-tally-secret header or ?secret= query parameter.",
    ]);
  }

  let rawPayload: unknown;

  try {
    rawPayload = await request.json();
  } catch {
    return errorResponse(400, "Invalid JSON payload.", ["Request body could not be parsed as JSON."]);
  }

  const applicant = normalizeTallyPartnerApplicant(rawPayload);
  const validationErrors = validatePartnerApplicant(applicant);

  if (validationErrors.length > 0) {
    return errorResponse(422, "Invalid partner applicant submission.", validationErrors);
  }

  const processingErrors: ProcessingError[] = [];

  try {
    const hubspotResult = await upsertHubSpotPartnerContact(applicant);
    const noteBody = buildPartnerApplicantSummary(applicant);

    try {
      await createHubSpotContactNote(hubspotResult.contactId, noteBody);
    } catch (error) {
      processingErrors.push({
        step: "hubspot_note",
        message: getErrorMessage(error),
      });
    }

    let notionPageId: string | undefined;

    try {
      const notionResult = await createNotionPartnerApplicant(applicant, hubspotResult.contactId);
      notionPageId = notionResult.pageId;
    } catch (error) {
      processingErrors.push({
        step: "notion_page",
        message: getErrorMessage(error),
      });
    }

    // TODO: Add optional Gmail draft/internal notification support through a separate workflow later.
    // This router intentionally avoids Resend, SendGrid, Mailgun, Postmark, Zapier, Make, Gmail labels, and Google Apps Script.

    const responseBody: IntakeRouterSuccessResponse = {
      ok: true,
      action: hubspotResult.action,
      hubspotContactId: hubspotResult.contactId,
      notionPageId,
      message:
        processingErrors.length === 0
          ? "Partner applicant processed successfully."
          : "Partner applicant processed with non-fatal follow-up errors. Check errors in response and Vercel logs.",
    };

    if (processingErrors.length > 0) {
      return NextResponse.json(
        {
          ...responseBody,
          errors: processingErrors,
        },
        { status: 207 },
      );
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("Partner applicant intake failed", {
      message,
      applicantEmail: applicant.email,
      applicantName: applicant.fullName,
    });

    return errorResponse(500, "Partner applicant intake failed.", [message]);
  }
}

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "moonshine-intake-router",
    endpoint: "/api/tally/partner-applicant",
    method: "POST",
    message: "Send Tally partner applicant webhook submissions to this endpoint.",
  });
}
