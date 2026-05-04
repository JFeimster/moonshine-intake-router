# Moonshine Intake Router

Minimal Next.js/Vercel intake router for Moonshine Capital partner applicant submissions.

This app receives Tally webhook submissions, normalizes partner applicant data, searches/creates HubSpot contacts, adds a HubSpot note, and creates a matching Notion record in the Partner Applicants CRM.

It intentionally avoids:

- Gmail labels
- Google Apps Script
- Zapier
- Make
- Resend / SendGrid / Mailgun / Postmark
- applicant-facing automated email in v1
- company creation
- deal creation

No automation clown car. Just the intake pipe. 🧰

---

## Tech Stack

- Next.js App Router
- TypeScript
- Vercel
- HubSpot Private App API
- Notion API
- Tally webhook

---

## Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | `GET` | Confirms the app is online |
| `/api/tally/partner-applicant` | `GET` | Shows endpoint metadata |
| `/api/tally/partner-applicant` | `POST` | Receives Tally partner applicant webhooks |

---

## Environment Variables

Create these in Vercel under:

```text
Project → Settings → Environment Variables
```

```env
HUBSPOT_PRIVATE_APP_TOKEN=
HUBSPOT_OWNER_ID=
NOTION_API_KEY=
NOTION_PARTNER_APPLICANTS_DATA_SOURCE_ID=2484bc1b-d63c-80ff-804e-000be60930c0
TALLY_WEBHOOK_SECRET=
```

### Notes

- `HUBSPOT_PRIVATE_APP_TOKEN` should come from a HubSpot private app with contact and note/engagement permissions.
- `HUBSPOT_OWNER_ID` should be the HubSpot owner ID assigned to new partner applicant contacts.
- `NOTION_API_KEY` should be an internal Notion integration token with access to the Partner Applicants CRM database.
- `NOTION_PARTNER_APPLICANTS_DATA_SOURCE_ID` should be the Notion data source ID, not the database page URL.
- `TALLY_WEBHOOK_SECRET` is used to validate incoming webhook requests.

Known Notion Partner Applicants CRM data source ID:

```text
2484bc1b-d63c-80ff-804e-000be60930c0
```

---

## Tally Webhook Setup

After deploying to Vercel, use this webhook URL in Tally:

```text
https://YOUR-VERCEL-DOMAIN.vercel.app/api/tally/partner-applicant
```

Preferred secret method, if Tally supports custom headers:

```text
x-tally-secret: YOUR_SECRET
```

Fallback method:

```text
https://YOUR-VERCEL-DOMAIN.vercel.app/api/tally/partner-applicant?secret=YOUR_SECRET
```

---

## Partner Applicant Processing Logic

When a Tally webhook hits `POST /api/tally/partner-applicant`, the router:

1. Validates the webhook secret.
2. Parses the JSON payload.
3. Normalizes Tally answers into:
   - `fullName`
   - `firstName`
   - `lastName`
   - `email`
   - `currentWork`
   - `salesExperience`
   - `previousExperience`
   - `preferredStart`
   - `interestReason`
   - `wantsStrategyCall`
4. Validates that name and email exist.
5. Searches HubSpot by email.
6. Creates a HubSpot contact if none exists.
7. Updates only safe blank/relevant HubSpot fields if the contact already exists.
8. Adds a HubSpot note with the full intake summary.
9. Creates a Notion page in Partner Applicants CRM.
10. Returns a JSON response with contact/page IDs and any non-fatal errors.

---

## HubSpot Rules

- Search first by email.
- Avoid duplicate contacts.
- Do not create companies.
- Do not create deals.
- Use notes for context.
- Use structured fields only where clean.
- Do not guarantee approval, earnings, funding, terms, or outcomes.

New contacts are created with:

```text
lifecyclestage = lead
hs_lead_status = AFFILIATE_PARTNER
hubspot_owner_id = HUBSPOT_OWNER_ID
```

---

## Notion Mapping

The router creates a Notion page in Partner Applicants CRM with these fields:

| Notion Property | Value |
|---|---|
| Name | Applicant full name |
| Email | Applicant email |
| Lead Source | Tally Form |
| Status | New Lead |
| Sequence Stage | Not Started |
| Partner Lane Chosen | Affiliate / Content |
| Onboarding Path | Beginner |
| Sales Experience | Mapped from submission |
| Current Position | Mapped from submission |
| Previous Experience | Mapped from submission |
| Preferred Start | Mapped from submission; “Within a month” becomes “This month” |
| Wants Strategy Call | Mapped from submission |
| Consent to Contact | Checked |
| Application Date | Today, Eastern Time |
| Last Touch Date | Today, Eastern Time |
| Follow-up Date | Next business day, Eastern Time |
| Interest Reason | Mapped from submission |
| Notes | CRM context and routing note |

---

## Local Development

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

---

## Test the Webhook Locally

Example `curl` request:

```bash
curl -X POST "http://localhost:3000/api/tally/partner-applicant?secret=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "fields": [
        { "label": "What’s your name, rockstar?", "value": "Junaid Ahmed" },
        { "label": "Where should we send your onboarding link and resources?", "value": "remoteincome42@example.com" },
        { "label": "What best describes your current work or hustle?", "value": ["Affiliate / network marketer", "Gig worker / freelancer"] },
        { "label": "Q5: Ever worked in sales, finance, or helping business owners before?", "value": "Yes" },
        { "label": "🔥 Nice. Give us the quick and dirty — tell us what you’ve done.", "value": "ERC affiliation through BLC" },
        { "label": "Q6: How soon are you looking to start earning as a Partner?", "value": "Within a month" },
        { "label": "Q7: Why are you interested in becoming a Moonshine Capital Partner?", "value": "Cause it is much better than other affiliate programs." },
        { "label": "Q9: Want a 1-on-1 strategy call to get started fast?", "value": "No" }
      ]
    }
  }'
```

---

## Expected Success Response

```json
{
  "ok": true,
  "action": "created",
  "hubspotContactId": "123456789",
  "notionPageId": "abc123",
  "message": "Partner applicant processed successfully."
}
```

If Notion or HubSpot note creation fails after the contact is created/updated, the route may return `207` with non-fatal errors so the core intake does not disappear into the void.

---

## Deployment

1. Import this repo into Vercel.
2. Add environment variables.
3. Deploy.
4. Visit `/api/health` to confirm the app is online.
5. Add the deployed `/api/tally/partner-applicant` URL to Tally webhooks.
6. Submit a test form.
7. Check Vercel logs, HubSpot, and Notion.

---

## Future Improvements

Possible next layers:

- Add idempotency tracking so duplicate webhook retries do not create duplicate Notion records.
- Add a lightweight admin/debug page.
- Add Gmail draft creation through a separate workflow if needed.
- Add funding applicant webhook route.
- Add Giggle / BankBreezy routing route.
- Add HubSpot task creation for next-day follow-up.
- Add internal notification through an existing tool instead of signing up for a new email provider.

---

## Current Scope

This version is intentionally narrow:

```text
Tally partner applicant webhook
→ HubSpot contact search/create/update
→ HubSpot intake note
→ Notion Partner Applicants CRM page
→ JSON response + Vercel logs
```

That is enough to test the pipe without summoning a twelve-headed automation hydra.
