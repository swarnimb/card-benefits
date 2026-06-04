import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { Prisma } from "@prisma/client";
import { requireAuth, getUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { CatalogCard } from "@/types/card";

const CATALOG_PATH = join(process.cwd(), "data", "card-catalog.json");
const DEFAULT_CUSTOM_COLOR = "#64748b";

function readCatalog(): CatalogCard[] {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
}

type CardRow = { id: string; issuer: string; name: string };
type CardResolution = { card: CardRow } | { error: string; status: number };

async function resolveOrCreateCard(
  body: Record<string, unknown>
): Promise<CardResolution> {
  const { catalogCardId, customIssuer, customName } = body;

  if (catalogCardId && typeof catalogCardId === "string") {
    const entry = readCatalog().find((c) => c.id === catalogCardId);
    if (!entry) return { error: "Catalog card not found", status: 404 };

    let dbCard = await prisma.card.findFirst({
      where: { issuer: entry.issuer, name: entry.name },
    });
    if (!dbCard) {
      dbCard = await prisma.card.create({
        data: {
          issuer: entry.issuer,
          name: entry.name,
          scrapeUrl: entry.scrapeUrl,
          defaultColor: entry.defaultColor,
        },
      });
    } else if (dbCard.scrapeUrl !== entry.scrapeUrl || dbCard.defaultColor !== entry.defaultColor) {
      dbCard = await prisma.card.update({
        where: { id: dbCard.id },
        data: { scrapeUrl: entry.scrapeUrl, defaultColor: entry.defaultColor },
      });
    }
    return { card: dbCard };
  }

  const MAX_FIELD_LENGTH = 100;
  if (
    customIssuer && typeof customIssuer === "string" &&
    customName && typeof customName === "string"
  ) {
    if (customIssuer.length > MAX_FIELD_LENGTH || customName.length > MAX_FIELD_LENGTH) {
      return { error: "customIssuer and customName must be 100 characters or less", status: 400 };
    }
    const dbCard = await prisma.card.create({
      data: {
        issuer: customIssuer,
        name: customName,
        scrapeUrl: null,
        defaultColor: DEFAULT_CUSTOM_COLOR,
      },
    });
    return { card: dbCard };
  }

  return { error: "Missing catalogCardId or customIssuer+customName", status: 400 };
}

/** GET /api/user-cards — Returns all cards for the authenticated user. */
export async function GET(_request: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = getUserId();
    const userCards = await prisma.userCard.findMany({
      where: { userId },
      orderBy: { displayOrder: "asc" },
      include: { card: true, _count: { select: { benefits: true } } },
    });

    return NextResponse.json(
      userCards.map((uc) => ({
        id: uc.id,
        cardId: uc.cardId,
        displayOrder: uc.displayOrder,
        lastVerifiedAt: uc.lastVerifiedAt?.toISOString() ?? null,
        statementDay: uc.statementDay,
        anniversaryDate: uc.anniversaryDate?.toISOString() ?? null,
        benefitCount: uc._count.benefits,
        card: {
          id: uc.card.id,
          issuer: uc.card.issuer,
          name: uc.card.name,
          defaultColor: uc.card.defaultColor,
          scrapeUrl: uc.card.scrapeUrl,
          annualFee: uc.card.annualFee,
        },
      }))
    );
  } catch (err) {
    console.error("GET /api/user-cards error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/user-cards — Adds a card from catalog or creates a custom card. */
export async function POST(request: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    body = raw as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const resolution = await resolveOrCreateCard(body);
    if ("error" in resolution) {
      return NextResponse.json({ error: resolution.error }, { status: resolution.status });
    }
    const userId = getUserId();
    const userCard = await prisma.userCard.create({
      data: { userId, cardId: resolution.card.id, displayOrder: 0 },
    });
    const { id: cardId, issuer, name } = resolution.card;
    return NextResponse.json(
      { id: userCard.id, cardId, card: { issuer, name } },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "You already have this card" }, { status: 409 });
    }
    console.error("POST /api/user-cards error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
