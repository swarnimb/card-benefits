import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import * as fs from "fs";
import * as path from "path";

type SeedBenefit = {
  name: string;
  description: string;
  type: string;
  trackingType: string;
  category?: string;
  rate?: number;
  rateType?: string;
  capAmount?: number;
  capPeriod?: string;
  resetMonth?: number;
  externalUrl?: string;
};

type SeedCard = {
  bankName: string;
  cardName: string;
  cardType: string;
  annualFee: number;
  imageColor: string;
  benefits: SeedBenefit[];
};

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const cardsDir = path.join(__dirname, "..", "data", "cards");
  const files = fs.readdirSync(cardsDir).filter((f) => f.endsWith(".json"));

  console.log(`Found ${files.length} card files to seed`);

  for (const file of files) {
    const filePath = path.join(cardsDir, file);
    const data: SeedCard = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const card = await prisma.card.upsert({
      where: {
        bankName_cardName: {
          bankName: data.bankName,
          cardName: data.cardName,
        },
      },
      update: {
        cardType: data.cardType,
        annualFee: data.annualFee,
        imageColor: data.imageColor,
      },
      create: {
        bankName: data.bankName,
        cardName: data.cardName,
        cardType: data.cardType,
        annualFee: data.annualFee,
        imageColor: data.imageColor,
      },
    });

    // Delete existing benefits for this card (re-seed cleanly)
    await prisma.benefit.deleteMany({ where: { cardId: card.id } });

    // Create all benefits
    for (const benefit of data.benefits) {
      await prisma.benefit.create({
        data: {
          cardId: card.id,
          name: benefit.name,
          description: benefit.description,
          type: benefit.type,
          trackingType: benefit.trackingType,
          category: benefit.category ?? null,
          rate: benefit.rate ?? null,
          rateType: benefit.rateType ?? null,
          capAmount: benefit.capAmount ?? null,
          capPeriod: benefit.capPeriod ?? null,
          resetMonth: benefit.resetMonth ?? null,
          externalUrl: benefit.externalUrl ?? null,
        },
      });
    }

    console.log(
      `  Seeded: ${data.bankName} ${data.cardName} (${data.benefits.length} benefits)`
    );
  }

  const cardCount = await prisma.card.count();
  const benefitCount = await prisma.benefit.count();
  console.log(`\nDone: ${cardCount} cards, ${benefitCount} benefits total`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
