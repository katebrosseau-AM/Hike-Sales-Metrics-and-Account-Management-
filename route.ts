import { NextRequest, NextResponse } from "next/server";
import { dataMode, rangeFromParams } from "@/lib/types";
import { mockDeals } from "@/lib/mock";
import { liveDeals } from "@/lib/hubspot";

// Always run on the server, never statically cached, so the date filter
// and live numbers stay current.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { start, end } = rangeFromParams(req.nextUrl.searchParams);
  try {
    const data =
      dataMode() === "live"
        ? await liveDeals(start, end)
        : mockDeals(start, end);
    return NextResponse.json({ mode: dataMode(), ...data });
  } catch (err) {
    // Surface a clean message to the UI; keep details in server logs.
    console.error("deals route error:", err);
    return NextResponse.json(
      { error: "Couldn't load deal metrics. Check the HubSpot connection." },
      { status: 502 },
    );
  }
}
