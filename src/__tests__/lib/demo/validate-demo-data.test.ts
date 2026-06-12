import { describe, it, expect } from "vitest";
import { validateDemoCards, DemoDataError } from "@/lib/demo/validate-demo-data";
import { DEMO_CARDS, type DemoCard } from "@/lib/demo/demo-data";

/** Deep-copies the real dataset so each error case can corrupt one record safely. */
function cloneCards(): DemoCard[] {
  return structuredClone(DEMO_CARDS);
}

/** Finds a benefit by name across the cloned dataset (throws if the dataset drifts). */
function findBenefit(cards: DemoCard[], cardName: string, benefitName: string) {
  const card = cards.find((c) => c.name === cardName);
  const benefit = card?.benefits.find((b) => b.name === benefitName);
  if (!card || !benefit) throw new Error(`test setup: ${cardName} / ${benefitName} not in dataset`);
  return { card, benefit };
}

describe("validateDemoCards", () => {
  it("accepts the real demo dataset (happy path)", () => {
    expect(() => validateDemoCards(DEMO_CARDS)).not.toThrow();
  });

  it("rejects an empty dataset", () => {
    expect(() => validateDemoCards([])).toThrow(DemoDataError);
  });

  it("fails loudly naming the record when a partial directive is missing usedAmount", () => {
    const cards = cloneCards();
    const { benefit } = findBenefit(cards, "Platinum Card", "Uber Cash");
    benefit.usage = { state: "partial" };

    expect(() => validateDemoCards(cards)).toThrow(DemoDataError);
    expect(() => validateDemoCards(cards)).toThrow(/Amex Platinum Card — Uber Cash/);
    expect(() => validateDemoCards(cards)).toThrow(/requires usage\.usedAmount/);
  });

  it("fails loudly when a partial usedAmount is out of range (>= value)", () => {
    const cards = cloneCards();
    const { benefit } = findBenefit(cards, "Gold Card", "Resy Credit");
    benefit.usage = { state: "partial", usedAmount: 50 }; // == value, not strictly less

    expect(() => validateDemoCards(cards)).toThrow(/Amex Gold Card — Resy Credit/);
    expect(() => validateDemoCards(cards)).toThrow(/0 < usedAmount < value/);
  });

  it("fails loudly when a maxed directive sits on an uncapped (value: null) benefit", () => {
    const cards = cloneCards();
    const { benefit } = findBenefit(cards, "Sapphire Reserve", "Annual Travel Credit");
    benefit.value = null;

    expect(() => validateDemoCards(cards)).toThrow(/Chase Sapphire Reserve — Annual Travel Credit/);
    expect(() => validateDemoCards(cards)).toThrow(/"maxed" requires a non-null value/);
  });

  it("fails loudly when a statement-anchored benefit's card has no statementDay", () => {
    const cards = cloneCards();
    const { card } = findBenefit(cards, "Gold Card", "Dunkin' Credit");
    card.statementDay = null;

    expect(() => validateDemoCards(cards)).toThrow(/Amex Gold Card — Dunkin' Credit/);
    expect(() => validateDemoCards(cards)).toThrow(/requires card\.statementDay/);
  });

  it("fails loudly when an anniversary-anchored benefit's card has no anniversaryDate", () => {
    const cards = cloneCards();
    const { card } = findBenefit(cards, "Venture X", "Travel Portal Credit");
    card.anniversaryDate = null;

    expect(() => validateDemoCards(cards)).toThrow(/Capital One Venture X — Travel Portal Credit/);
    expect(() => validateDemoCards(cards)).toThrow(/requires card\.anniversaryDate/);
  });

  it("fails loudly when expiresSoon is set on a setAndForget benefit", () => {
    const cards = cloneCards();
    const { benefit } = findBenefit(cards, "Platinum Card", "CLEAR Plus Credit");
    benefit.expiresSoon = true;

    expect(() => validateDemoCards(cards)).toThrow(/Amex Platinum Card — CLEAR Plus Credit/);
    expect(() => validateDemoCards(cards)).toThrow(/invalid on a setAndForget benefit/);
  });
});
