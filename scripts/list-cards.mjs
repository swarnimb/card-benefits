// One-off probe: list every UserCard with its issuer/name + benefit count.
// Run: node scripts/list-cards.mjs
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const userCards = await prisma.userCard.findMany({
    include: { card: true, _count: { select: { benefits: true } } },
    orderBy: { displayOrder: "asc" },
  });

  if (userCards.length === 0) {
    console.log("(no user cards in DB)");
  } else {
    console.log(`${userCards.length} user card(s):\n`);
    for (const uc of userCards) {
      const hasUrl = uc.card.scrapeUrl ? "scrapable" : "no-url";
      console.log(
        `  [${uc.card.issuer}] ${uc.card.name}  (${hasUrl}, ${uc._count.benefits} benefits)  uc_id=${uc.id}`
      );
    }
  }

  // Also list any Card rows that exist in DB but are NOT added as UserCards
  const allCards = await prisma.card.findMany({ orderBy: { name: "asc" } });
  const addedIds = new Set(userCards.map((u) => u.cardId));
  const notAdded = allCards.filter((c) => !addedIds.has(c.id));
  if (notAdded.length > 0) {
    console.log(`\n${notAdded.length} Card row(s) in DB but not in user's stack:`);
    for (const c of notAdded) {
      console.log(`  [${c.issuer}] ${c.name}  card_id=${c.id}`);
    }
  }
} finally {
  await prisma.$disconnect();
}
