import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "moonshine-intake-router",
    message: "Intake router is online.",
    timestamp: new Date().toISOString(),
  });
}
