import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scrapeCard } from "@/lib/scraper";
import { ScraperError } from "@/lib/scraper/generic";
import { parseBenefits, ParserError } from "@/lib/parser";
import type { DraftBenefit } from "@/types/benefit";

const CUSTOM_CARD_SCRAPE_ERROR = "Custom card — no scrape URL. Add benefits manually.";

/** POST /api/user-cards/[id]/scrape — Scrapes and parses benefits, returns drafts (no DB write). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = getUserId();

  let userCard;
  try {
    userCard = await prisma.userCard.findUnique({ where: { id }, include: { card: true } });
  } catch (err) {
    console.error(`POST /api/user-cards/${id}/scrape DB lookup error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!userCard || userCard.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!userCard.card.scrapeUrl) {
    return NextResponse.json({ benefits: [], scrapeError: CUSTOM_CARD_SCRAPE_ERROR });
  }

  let rawText: string;
  try {
    rawText = await scrapeCard(userCard.card.issuer, userCard.card.scrapeUrl);
  } catch (err) {
    if (err instanceof ScraperError) {
      return NextResponse.json({ benefits: [], scrapeError: err.message });
    }
    console.error(`POST /api/user-cards/${id}/scrape unexpected scrape error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  let benefits: DraftBenefit[];
  try {
    benefits = await parseBenefits(rawText);
  } catch (err) {
    if (err instanceof ParserError) {
      return NextResponse.json({ benefits: [], parseError: err.message });
    }
    console.error(`POST /api/user-cards/${id}/scrape unexpected parse error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ benefits });
}
