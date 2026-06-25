import { NextRequest, NextResponse } from "next/server";
import { dataMode, rangeFromParams } from "@/lib/types";
import { mockOrders } from "@/lib/mock";
import { liveOrders } from "@/lib/hike";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { start, end } = rangeFromParams(req.nextUrl.searchParams);
  try {
    const data =
      dataMode() === "live"
        ? await liveOrders(start, end)
        : mockOrders(start, end);
    return NextResponse.json({ mode: dataMode(), ...data });
  } catch (err) {
    console.error("orders route error:", err);
    return NextResponse.json(
      { error: "Couldn't load order metrics. Check the Hike connection." },
      { status: 502 },
    );
  }
}
