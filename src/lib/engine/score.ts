// The rules engine. Deterministic, no network, no LLM.
//
// Steps, in the order docs/scoring.md describes them:
//   1. Hard filters (UPI support, currency restriction).
//   2. Reward value: slab-rounded earn times value per unit, plus the best
//      matching merchant offer.
//   3. Fees: forex markup plus GST on the markup where the issuer charges it.
//      Expensed transactions keep the fee visible but score it as zero.
//   4. Net = reward minus fee. Rank by net, then fewer warnings, then reward.
//   5. Cross-card warnings and the late "zero earn while another card earns" drop.

import { CARDS } from "../cards";
import { categoryLabel, categoryMcc } from "../categories";
import type { Card, CardResult, Recommendation, Settings, SlabEarn, TransactionInput } from "../types";
import { fmtInr, round2, slabUnits, toInr, type RateMap } from "./money";
import { findOffers } from "./offers";
import { buildSpeech } from "./speech";

export type ScoreOptions = {
  settings: Settings;
  rates: RateMap;
  now?: Date;
  /** INR amount for currency OTHER, where no rate exists. */
  amountInrOverride?: number;
  cards?: Card[];
};

export class NeedInrAmountError extends Error {
  constructor() {
    super("Amount in INR needed for this currency");
    this.name = "NeedInrAmountError";
  }
}

type Scored = CardResult & {
  _emiForfeit: boolean;
  _zeroCategory: boolean;
  _rewardTotal: number;
};

function pickRule(card: Card, input: TransactionInput, amountInr: number): { rule: SlabEarn; label: string } | null {
  const e = card.earn;
  const m = (input.merchantName ?? "").toLowerCase();
  const byMerchant = e.byMerchant?.find((o) => o.match.some((k) => m.includes(k)));
  if (byMerchant) return { rule: byMerchant.earn, label: byMerchant.label };
  const byCat = e.byCategory?.[input.category];
  if (byCat) return { rule: byCat, label: categoryLabel(input.category).toLowerCase() };
  if (input.rail === "upi" && e.upi) {
    const rule = amountInr > e.upi.threshold ? e.upi.above : e.upi.atOrBelow;
    const side = amountInr > e.upi.threshold ? "above" : "at or below";
    return { rule, label: `UPI ${side} ${fmtInr(e.upi.threshold)}` };
  }
  if (e.base) return { rule: e.base, label: "base" };
  return null;
}

function scoreCard(card: Card, input: TransactionInput, amountInr: number, opts: Required<Pick<ScoreOptions, "settings" | "now">>): Scored {
  const { settings, now } = opts;
  const warnings: string[] = [];
  const base: Scored = {
    cardId: card.id,
    name: card.name,
    short: card.short,
    color: card.color,
    image: card.image ?? `/cards/${card.id}.png`,
    rank: 0,
    eligible: true,
    earn: null,
    offer: null,
    offerHints: [],
    fee: { markupPct: 0, gstOnMarkupPct: 0, effectivePct: 0, inr: 0, reimbursed: false },
    net: 0,
    warnings,
    reminder: card.reminder,
    reason: "",
    _emiForfeit: false,
    _zeroCategory: false,
    _rewardTotal: 0,
  };

  // 1. Hard filters that never depend on other cards.
  if (input.rail === "upi" && !card.supportsUpi) {
    return { ...base, eligible: false, dropReason: `${card.short} has no UPI`, reason: `${card.short} cannot be used on UPI.` };
  }
  if (card.onlyCurrencies && !card.onlyCurrencies.includes(input.currency)) {
    return {
      ...base,
      eligible: false,
      dropReason: `${card.short} is ${card.onlyCurrencies.join("/")} only`,
      reason: `${card.short} is never recommended outside ${card.onlyCurrencies.join("/")}.`,
    };
  }

  // 2a. Earn.
  let earnValue = 0;
  let earn: CardResult["earn"] = null;
  if (card.unit) {
    const unitValue = settings.unitValue[card.unit.settingsKey];
    const merchant = (input.merchantName ?? "").toLowerCase();
    const zeroMerchant = card.earn.zeroMerchantKeywords?.find((k) => merchant.includes(k));
    if (input.isEmi && card.earn.forfeitOnEmi) {
      base._emiForfeit = true;
      warnings.push(`EMI forfeits rewards on ${card.short}`);
      earn = { units: 0, unitName: card.unit.plural, valueInr: 0, rateLabel: "0 on EMI" };
    } else if (zeroMerchant) {
      base._zeroCategory = true;
      warnings.push(`${zeroMerchant} purchases earn 0 on ${card.short}`);
      earn = { units: 0, unitName: card.unit.plural, valueInr: 0, rateLabel: `0 on ${zeroMerchant}` };
    } else if (card.earn.zeroCategories.includes(input.category)) {
      base._zeroCategory = true;
      warnings.push(`${categoryLabel(input.category)} earns 0 on ${card.short} (MCC ${categoryMcc(input.category)})`);
      earn = { units: 0, unitName: card.unit.plural, valueInr: 0, rateLabel: `0 on ${categoryLabel(input.category).toLowerCase()}` };
    } else if (card.earn.percentFromSettings) {
      const pct = settings[card.earn.percentFromSettings];
      const units = round2((amountInr * pct) / 100);
      earnValue = units * unitValue;
      earn = { units, unitName: card.unit.plural, valueInr: round2(earnValue), rateLabel: `${pct}% cashback` };
    } else {
      const picked = pickRule(card, input, amountInr);
      if (picked) {
        const units = slabUnits(amountInr, picked.rule);
        earnValue = units * unitValue;
        if (amountInr < picked.rule.per) {
          warnings.push(`This ticket is under ${fmtInr(picked.rule.per)} on the slab, earns 0 on ${card.short}`);
        }
        earn = {
          units,
          unitName: units === 1 ? card.unit.name : card.unit.plural,
          valueInr: round2(earnValue),
          rateLabel: `${picked.rule.points} ${picked.rule.points === 1 ? card.unit.name : card.unit.plural} per ${fmtInr(picked.rule.per)}${picked.label === "base" ? "" : ` (${picked.label})`}`,
        };
      }
    }
  }

  // 2b. Offer.
  const { best, hints } = findOffers(card, input, amountInr, now);
  let offer: CardResult["offer"] = null;
  if (best && best.valueInr > 0) {
    offer = {
      merchant: best.offer.merchant,
      label: best.label,
      valueInr: round2(best.valueInr),
      cap: best.offer.cap,
      frequency: best.offer.frequency,
    };
    warnings.push(...best.warnings);
  }
  const offerValue = offer?.valueInr ?? 0;

  // 3. Fees.
  const markupPct = input.currency === card.homeCurrency ? 0 : (card.forex.byCurrency?.[input.currency] ?? card.forex.defaultPct);
  const gstPct = markupPct > 0 ? card.forex.gstOnMarkupPct : 0;
  const effectivePct = round2(markupPct * (1 + gstPct / 100));
  const feeInr = round2((amountInr * markupPct * (1 + gstPct / 100)) / 100);
  const fee = { markupPct, gstOnMarkupPct: gstPct, effectivePct, inr: feeInr, reimbursed: input.expensed && feeInr > 0 };
  const feeForRank = input.expensed ? 0 : feeInr;

  // 4. Net.
  const rewardTotal = round2(earnValue + offerValue);
  const net = round2(rewardTotal - feeForRank);

  return {
    ...base,
    earn,
    offer,
    offerHints: hints,
    fee,
    net,
    _rewardTotal: rewardTotal,
    reason: buildReason(card, earn, offer, fee, net, input),
  };
}

function buildReason(card: Card, earn: CardResult["earn"], offer: CardResult["offer"], fee: CardResult["fee"], net: number, input: TransactionInput): string {
  const bits: string[] = [];
  if (earn && earn.units > 0) bits.push(`${earn.units} ${earn.unitName} worth ${fmtInr(earn.valueInr)}`);
  if (offer) bits.push(`${fmtInr(offer.valueInr)} off via ${offer.merchant}`);
  if (fee.inr > 0) bits.push(fee.reimbursed ? `${fmtInr(fee.inr)} markup, reimbursed` : `${fmtInr(fee.inr)} markup`);
  else if (input.currency !== "INR") bits.push("zero forex");
  if (!bits.length) bits.push("earns nothing here");
  return `${card.short}: ${bits.join(", ")}. Net ${fmtInr(net)}.`;
}

export function recommend(input: TransactionInput, opts: ScoreOptions): Recommendation {
  const now = opts.now ?? new Date();
  const cards = opts.cards ?? CARDS;

  let amountInr: number;
  let fxRateUsed: number | null = null;
  if (input.currency === "INR") {
    amountInr = input.amount;
  } else if (opts.rates[input.currency]) {
    fxRateUsed = opts.rates[input.currency]!;
    amountInr = toInr(input.amount, input.currency, opts.rates);
  } else if (opts.amountInrOverride !== undefined) {
    amountInr = opts.amountInrOverride;
  } else {
    throw new NeedInrAmountError();
  }
  amountInr = round2(amountInr);

  const scored = cards.map((c) => scoreCard(c, input, amountInr, { settings: opts.settings, now }));

  // 5a. Late hard filter: zero-earn category with no offer while another card earns.
  const anyoneEarns = scored.some((s) => s.eligible && s._rewardTotal > 0);
  for (const s of scored) {
    if (s.eligible && s._zeroCategory && !s.offer && anyoneEarns) {
      s.eligible = false;
      s.dropReason = s.warnings[0] ?? `${s.short} earns 0 here`;
    }
  }

  // 5b. Forex warning relative to the best zero-forex card.
  const eligible = scored.filter((s) => s.eligible);
  sortInPlace(eligible);
  const bestZeroForex = eligible.find((s) => s.fee.inr === 0 && input.currency !== "INR");
  for (const s of scored) {
    if (s.fee.inr > 0 && bestZeroForex && bestZeroForex.cardId !== s.cardId) {
      s.warnings.push(`Forex markup ${fmtInr(s.fee.inr)} on this card, ₹0 on ${bestZeroForex.short}`);
    }
  }

  const dropped = scored.filter((s) => !s.eligible);
  const ranked = [...eligible, ...dropped].map((s, i) => {
    const { _emiForfeit, _zeroCategory, _rewardTotal, ...rest } = s;
    void _emiForfeit;
    void _zeroCategory;
    void _rewardTotal;
    return { ...rest, rank: i + 1 };
  });

  const top = ranked.find((r) => r.eligible) ?? null;
  return {
    input,
    amountInr,
    fxRateUsed,
    ranked,
    top,
    speech: buildSpeech(input, ranked, top),
  };
}

function sortInPlace(list: Scored[]): void {
  list.sort((a, b) => {
    // EMI-forfeit cards go last among the eligible, per the spec.
    if (a._emiForfeit !== b._emiForfeit) return a._emiForfeit ? 1 : -1;
    if (b.net !== a.net) return b.net - a.net;
    if (a.warnings.length !== b.warnings.length) return a.warnings.length - b.warnings.length;
    return b._rewardTotal - a._rewardTotal;
  });
}
