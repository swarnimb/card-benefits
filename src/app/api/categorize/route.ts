import { NextRequest, NextResponse } from "next/server";
import { categorizeMerchants } from "@/lib/categorizer";
import type { CategoryMap } from "@/types/transaction";

// POST /api/categorize — categorize merchant names via cache + Claude Haiku
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { merchants: string[] };

  if (!body.merchants || !Array.isArray(body.merchants)) {
    return NextResponse.json(
      { error: "Request must include a 'merchants' array" },
      { status: 400 }
    );
  }

  if (body.merchants.length === 0) {
    return NextResponse.json({} as CategoryMap);
  }

  if (body.merchants.length > 200) {
    return NextResponse.json(
      { error: "Maximum 200 merchants per request" },
      { status: 400 }
    );
  }

  const categories = await categorizeMerchants(body.merchants);
  return NextResponse.json(categories);
}
