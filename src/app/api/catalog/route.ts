import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/auth";
import type { CatalogCard } from "@/types/card";

const CATALOG_PATH = join(process.cwd(), "data", "card-catalog.json");

/** GET /api/catalog — Returns the static card catalog from data/card-catalog.json. */
export async function GET(_request: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const catalog: CatalogCard[] = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
    return NextResponse.json(catalog);
  } catch (err) {
    console.error("GET /api/catalog error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
