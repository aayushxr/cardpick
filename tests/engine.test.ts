import { describe, expect, it } from "vitest";
import { recommend, slabUnits, type RateMap } from "../src/lib/engine";
import { DEFAULT_SETTINGS, type Settings, type TransactionInput } from "../src/lib/types";

// Fixed rates so the numbers in this file never drift with the market.
const RATES: RateMap = { INR: 1, USD: 95, QAR: 26 };
const WEDNESDAY = new Date("2026-09-09T10:00:00+05:30"); // 9 Sep 2026 is a Wednesday
const MONDAY = new Date("2026-09-07T10:00:00+05:30");

function tx(over: Partial<TransactionInput>): TransactionInput {
  return {
    amount: 100,
    currency: "INR",
    country: "IN",
    category: "other",
    rail: "card_online",
    expensed: false,
    isEmi: false,
    ...over,
  };
}

function run(input: TransactionInput, settings: Settings = DEFAULT_SETTINGS, now = MONDAY) {
  return recommend(input, { settings, rates: RATES, now });
}

function byId(r: ReturnType<typeof run>, id: string) {
  const c = r.ranked.find((x) => x.cardId === id);
  if (!c) throw new Error(`missing ${id}`);
  return c;
}

describe("slab rounding", () => {
  it("₹259 on Horizon general = 4 miles", () => {
    expect(slabUnits(259, { points: 2, per: 100 })).toBe(4);
    const r = run(tx({ amount: 259, category: "shopping_online" }));
    expect(byId(r, "horizon").earn?.units).toBe(4);
  });
  it("₹99 = 0 with the slab warning", () => {
    expect(slabUnits(99, { points: 2, per: 100 })).toBe(0);
    const r = run(tx({ amount: 99, category: "shopping_online" }));
    const h = byId(r, "horizon");
    expect(h.earn?.units).toBe(0);
    expect(h.warnings).toContain("This ticket is under ₹100 on the slab, earns 0 on Horizon");
  });
  it("leftover rupees are never carried across transactions", () => {
    expect(slabUnits(150, { points: 2, per: 100 }) * 2).toBe(4);
    expect(slabUnits(300, { points: 2, per: 100 })).toBe(6);
  });
});

describe("Uber ₹413 in India", () => {
  it("on card: Horizon earns 0 with the MCC 4121 warning and is dropped because others earn", () => {
    const r = run(tx({ amount: 413, category: "ride_hailing", merchantName: "Uber", rail: "card_online" }));
    const h = byId(r, "horizon");
    expect(h.eligible).toBe(false);
    expect(h.warnings).toContain("Ride-hailing earns 0 on Horizon (MCC 4121)");
    expect(r.top?.cardId).toBe("slice");
  });
  it("on UPI: Horizon is dropped for no UPI, slice wins", () => {
    const r = run(tx({ amount: 413, category: "ride_hailing", merchantName: "Uber", rail: "upi" }));
    expect(byId(r, "horizon").dropReason).toBe("Horizon has no UPI");
    expect(r.top?.cardId).toBe("slice");
    expect(byId(r, "slice").net).toBeCloseTo(4.13, 2);
  });
});

describe("Uber QAR 17 in Doha", () => {
  // Owner's call (Sep 2026): rank purely by net. slice and WOW both have zero
  // markup and earn something, so they outrank QNB, which earns nothing.
  const r = run(tx({ amount: 17, currency: "QAR", country: "QA", category: "ride_hailing", merchantName: "Uber", rail: "card_pos" }));
  it("Horizon is last with the forex warning (dropped: ride-hailing earns 0 while others earn)", () => {
    const shown = r.ranked.filter((x) => x.eligible || x.cardId === "horizon");
    expect(shown[shown.length - 1].cardId).toBe("horizon");
    const h = byId(r, "horizon");
    expect(h.eligible).toBe(false);
    expect(h.warnings.some((w) => w.startsWith("Forex markup"))).toBe(true);
    expect(h.warnings.some((w) => w.includes("₹0 on"))).toBe(true);
  });
  it("QNB has no fee and no reward, so net 0", () => {
    const q = byId(r, "qnb");
    expect(q.fee.inr).toBe(0);
    expect(q.net).toBe(0);
  });
  it("Neo is dropped outside INR", () => {
    expect(byId(r, "neo").eligible).toBe(false);
  });
  it("WOW Black earns 8 RP at zero forex and outranks QNB", () => {
    const w = byId(r, "wow");
    expect(w.earn?.units).toBe(8);
    expect(w.fee.inr).toBe(0);
    expect(w.rank).toBeLessThan(byId(r, "qnb").rank);
  });
});

describe("Claude subscription USD 200", () => {
  const base = tx({ amount: 200, currency: "USD", country: "OTHER", category: "subscription_software", merchantName: "Claude", rail: "card_online" });
  it("expensed: Horizon wins with 380 miles, fee shown but zeroed", () => {
    const r = run({ ...base, expensed: true });
    const h = byId(r, "horizon");
    expect(h.earn?.units).toBe(380);
    expect(h.fee.inr).toBeCloseTo(784.7, 1);
    expect(h.fee.reimbursed).toBe(true);
    expect(h.net).toBe(380);
    expect(r.top?.cardId).toBe("horizon");
  });
  it("not expensed: Horizon loses to zero-forex cards; WOW nets ₹126", () => {
    const r = run(base);
    expect(byId(r, "wow").net).toBe(126);
    expect(byId(r, "horizon").net).toBeCloseTo(380 - 784.7, 1);
    expect(r.top?.cardId).not.toBe("horizon");
  });
  it("not expensed: Horizon only wins once the mile value clears the fee plus the best zero-forex net", () => {
    const best = run(base).top!;
    // Horizon needs 380 * v - 784.7 > best.net
    const threshold = (784.7 + best.net) / 380;
    const below = { ...DEFAULT_SETTINGS, unitValue: { ...DEFAULT_SETTINGS.unitValue, horizonMile: threshold - 0.05 } };
    const above = { ...DEFAULT_SETTINGS, unitValue: { ...DEFAULT_SETTINGS.unitValue, horizonMile: threshold + 0.05 } };
    expect(run(base, below).top?.cardId).not.toBe("horizon");
    expect(run(base, above).top?.cardId).toBe("horizon");
    // With GST on the markup the break-even sits near ₹2.57, not the ₹2.07
    // you get by ignoring GST and slice.
    expect(threshold).toBeGreaterThan(2.4);
  });
});

describe("Zomato ₹600 order", () => {
  it("Neo wins via ₹120 offer with the 2/month warning", () => {
    const r = run(tx({ amount: 600, category: "food_delivery", merchantName: "Zomato", rail: "upi" }));
    expect(r.top?.cardId).toBe("neo");
    const n = byId(r, "neo");
    expect(n.offer?.valueInr).toBe(120);
    expect(n.warnings.some((w) => w.includes("2 times per month"))).toBe(true);
  });
  it("Zomato ₹450 misses the ₹499 minimum and the offer is not applied", () => {
    const r = run(tx({ amount: 450, category: "food_delivery", merchantName: "Zomato", rail: "upi" }));
    expect(byId(r, "neo").offer).toBeNull();
    expect(byId(r, "neo").offerHints.some((h) => h.includes("₹499 minimum"))).toBe(true);
  });
});

describe("District movie tickets ₹800", () => {
  it("Wealth debit wins via 1+1", () => {
    const r = run(tx({ amount: 800, category: "movies", merchantName: "District", rail: "card_online" }));
    expect(r.top?.cardId).toBe("wealth");
    expect(byId(r, "wealth").offer?.valueInr).toBe(400);
  });
  it("1+1 cap of ₹500 binds on a ₹1,400 booking", () => {
    const r = run(tx({ amount: 1400, category: "movies", merchantName: "District", rail: "card_online" }));
    expect(byId(r, "wealth").offer?.valueInr).toBe(500);
  });
});

describe("Chennai to Doha flight ₹35,000", () => {
  it("airindia.com: Horizon 1,750 miles, wins by a wide margin", () => {
    const r = run(tx({ amount: 35000, category: "airline_direct", merchantName: "airindia.com", rail: "card_online" }));
    expect(r.top?.cardId).toBe("horizon");
    expect(byId(r, "horizon").earn?.units).toBe(1750);
    const second = r.ranked[1];
    expect(byId(r, "horizon").net - second.net).toBeGreaterThan(1000);
  });
  it("MakeMyTrip on a Wednesday: Horizon 2x vs Neo MMT offer, both shown", () => {
    const r = run(tx({ amount: 35000, category: "airline_ota", merchantName: "MakeMyTrip", rail: "card_online" }), DEFAULT_SETTINGS, WEDNESDAY);
    const h = byId(r, "horizon");
    const n = byId(r, "neo");
    expect(h.earn?.units).toBe(700);
    expect(n.offer?.merchant).toBe("MakeMyTrip");
    expect(n.offer?.valueInr).toBe(5250);
    expect(n.warnings.some((w) => w.includes("no cap listed"))).toBe(true);
    expect(h.eligible).toBe(true);
    expect(n.eligible).toBe(true);
  });
  it("MakeMyTrip on a Monday: the offer is a hint, not scored", () => {
    const r = run(tx({ amount: 35000, category: "airline_ota", merchantName: "MakeMyTrip", rail: "card_online" }), DEFAULT_SETTINGS, MONDAY);
    expect(byId(r, "neo").offer).toBeNull();
    expect(byId(r, "neo").offerHints.some((h) => h.includes("Wednesdays only"))).toBe(true);
    expect(r.top?.cardId).toBe("horizon");
  });
});

describe("Electricity bill ₹2,500", () => {
  it("no merchant: WOW earns 1 RP per ₹150, Horizon is dropped, Paytm shows as a hint on Neo", () => {
    const r = run(tx({ amount: 2500, category: "utility", rail: "card_online" }));
    expect(byId(r, "wow").earn?.units).toBe(16);
    expect(byId(r, "horizon").eligible).toBe(false);
    expect(byId(r, "neo").offer).toBeNull();
    expect(byId(r, "neo").offerHints.some((h) => h.includes("Paytm"))).toBe(true);
    // Owner's call (Sep 2026): slice has no category exclusions, so it earns 1% here.
    expect(r.top?.cardId).toBe("slice");
  });
  it("via Paytm: Neo 5% up to ₹150 beats everything", () => {
    const r = run(tx({ amount: 2500, category: "utility", merchantName: "Paytm", rail: "upi" }));
    expect(r.top?.cardId).toBe("neo");
    expect(byId(r, "neo").offer?.valueInr).toBe(125);
  });
});

describe("EMI", () => {
  it("Horizon on EMI is shown last among eligible with the warning", () => {
    const r = run(tx({ amount: 30000, category: "shopping_online", merchantName: "Amazon", isEmi: true }));
    const h = byId(r, "horizon");
    expect(h.eligible).toBe(true);
    expect(h.earn?.units).toBe(0);
    expect(h.warnings).toContain("EMI forfeits rewards on Horizon");
    const eligible = r.ranked.filter((x) => x.eligible);
    const lastTwo = eligible.slice(-2).map((x) => x.cardId).sort();
    expect(lastTwo).toEqual(["horizon", "wow"]);
  });
});

describe("expensed", () => {
  it("fees are zeroed for ranking but still displayed", () => {
    const r = run(tx({ amount: 100, currency: "USD", country: "OTHER", category: "shopping_online", expensed: true }));
    const h = byId(r, "horizon");
    expect(h.fee.inr).toBeGreaterThan(0);
    expect(h.fee.reimbursed).toBe(true);
    expect(h.net).toBe(h.earn!.valueInr);
  });
});

describe("speech", () => {
  it("names the top card and the markup another card would cost", () => {
    const r = run(tx({ amount: 200, currency: "USD", country: "OTHER", category: "subscription_software", merchantName: "Claude" }));
    expect(r.speech.startsWith(`Use ${r.top!.short}.`)).toBe(true);
    // Horizon is the costly card with the most reward at stake, so it is the one named.
    expect(r.speech).toMatch(/Horizon would cost 785 rupees in markup/);
  });
});

describe("currency OTHER", () => {
  it("throws when no rate and no INR override", () => {
    expect(() => run(tx({ amount: 50, currency: "OTHER", country: "OTHER" }))).toThrow(/INR/);
  });
  it("uses the INR override when given", () => {
    const r = recommend(tx({ amount: 50, currency: "OTHER", country: "OTHER", category: "dining" }), { settings: DEFAULT_SETTINGS, rates: RATES, now: MONDAY, amountInrOverride: 4000 });
    expect(r.amountInr).toBe(4000);
    expect(byId(r, "qnb").fee.markupPct).toBe(3);
  });
});
