// Shared types for cardpick.
// TransactionInput is the only thing the LLM produces. Everything else is
// deterministic and lives in the rules engine.

export type Currency = "INR" | "QAR" | "USD" | "OTHER";
export type Country = "IN" | "QA" | "OTHER";
export type Rail = "upi" | "card_online" | "card_pos" | "tap";

export const CATEGORIES = [
  "airline_direct",
  "airline_ota",
  "hotel",
  "dining",
  "food_delivery",
  "grocery_quick_commerce",
  "shopping_online",
  "shopping_offline",
  "subscription_software",
  "ride_hailing",
  "fuel",
  "utility",
  "insurance",
  "rent",
  "education",
  "government",
  "wallet_load",
  "movies",
  "pharmacy",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type TransactionInput = {
  amount: number; // in the transaction currency
  currency: Currency;
  country: Country; // where the merchant is, not where I am
  merchantName?: string; // free text, used for offer matching
  category: Category;
  rail: Rail;
  expensed: boolean; // Qlub reimburses this at statement value
  isEmi: boolean; // I plan to convert to EMI
  notes?: string;
};

// What the parser returns. Required fields it could not infer come back as null
// and the UI asks one follow-up question.
export type ParsedTransaction = {
  amount: number | null;
  currency: Currency | null;
  country: Country | null;
  merchantName: string | null;
  category: Category | null;
  rail: Rail | null;
  expensed: boolean | null;
  isEmi: boolean | null;
  notes: string | null;
};

// ---------- Card schema (see docs/cards.md) ----------

/** Points earned per slab of `per` rupees, rounded down per transaction. */
export type SlabEarn = { points: number; per: number };

export type OfferType = "flat" | "percent" | "bogo";

export type Offer = {
  /** Display name, for example "Zomato". */
  merchant: string;
  /** Lowercase substrings matched against merchantName. */
  match: string[];
  /** Categories this offer belongs to. Used only for unscored hints when merchantName is missing. */
  categories: Category[];
  type: OfferType;
  /** Flat: rupees off. Percent: percentage off. Bogo: ignored (value = half the amount). */
  value: number;
  /** Rupee cap per use. Omit when the offer lists none; the engine warns "no cap listed". */
  cap?: number;
  /** Minimum spend in rupees. */
  minSpend?: number;
  /** Plain-English frequency shown to the user. Usage is never tracked. */
  frequency: string;
  /** Extra condition, for example weekday 3 = Wednesday (Asia/Kolkata). */
  weekday?: number;
  /** Anything the user should know before relying on the offer. */
  note?: string;
};

export type UnitKey = "horizonMile" | "neoPoint" | "sliceMonie" | "wowRp";

export type Card = {
  id: string;
  name: string;
  /** Short name used in speech and chips, for example "WOW Black". */
  short: string;
  issuer: string;
  network: string;
  kind: "credit" | "debit";
  /** Dominant colour of the physical card, hex. Display only: used behind the artwork and as the fallback when it is missing. */
  color: string;
  /** Path to the card's front-face artwork under public/. Defaults to /cards/<id>.(png|jpg|webp|avif), first found. */
  image?: string;
  /** Currency this card settles in. Spends in this currency carry no forex markup. */
  homeCurrency: Currency;
  supportsUpi: boolean;
  /** Reward unit. null means the card never earns anything. */
  unit: { name: string; plural: string; settingsKey: UnitKey } | null;
  earn: {
    /** Base earn on eligible spend. null = no rewards. */
    base: SlabEarn | null;
    /** Per-category overrides. */
    byCategory?: Partial<Record<Category, SlabEarn>>;
    /** Percent cashback cards (slice). Rate comes from settings. */
    percentFromSettings?: "sliceCashbackRate";
    /** UPI earn tiers. threshold is in INR; above uses the first rule, at or below the second. */
    upi?: { threshold: number; above: SlabEarn; atOrBelow: SlabEarn };
    /** Merchant keyword overrides, for merchants the MCC groups cannot express (IRCTC, FASTag). */
    byMerchant?: { match: string[]; label: string; earn: SlabEarn }[];
    /** True when international transactions (non-INR currency or merchant outside IN) earn nothing. */
    zeroOnInternational?: boolean;
    /** Categories that earn nothing. */
    zeroCategories: Category[];
    /** Merchant keywords that earn nothing (gift cards on Neo). */
    zeroMerchantKeywords?: string[];
    /** True when converting to EMI wipes the reward. */
    forfeitOnEmi: boolean;
  };
  forex: {
    /** Markup percent by transaction currency. Missing currencies use `defaultPct`. */
    byCurrency?: Partial<Record<Currency, number>>;
    defaultPct: number;
    /** GST charged on the markup itself, percent. Axis charges 18. */
    gstOnMarkupPct: number;
  };
  /** Hard rule: only usable in these currencies. Neo is INR only. */
  onlyCurrencies?: Currency[];
  offers: Offer[];
  /** Static reminder shown on the card row. Never used in scoring. */
  reminder?: string;
};

// ---------- Settings (persisted in Redis) ----------

export type Settings = {
  unitValue: Record<UnitKey, number>; // INR per unit
  sliceCashbackRate: number; // percent, 1 or 2
  fxOverride: { USD: number | null; QAR: number | null }; // INR per unit, null = use fetched
  defaultExpensed: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  unitValue: {
    horizonMile: 1.0, // Axis says 1 EDGE Mile = 1 INR on partner transfers
    neoPoint: 0.2, // Axis EDGE Reward Point redeems around 0.20 INR
    sliceMonie: 1.0, // 1 Monie = 1 INR in the slice app
    wowRp: 0.25, // IDFC FIRST Rewards, 0.25 INR general; 0.50 on flights and hotels via the gallery
  },
  sliceCashbackRate: 1, // steps to 2 after 3 lakh cumulative Monies
  fxOverride: { USD: null, QAR: null },
  defaultExpensed: false,
};

export type FxRates = {
  /** INR per one unit of the currency. */
  rates: { USD: number; QAR: number };
  fetchedAt: string; // ISO
  source: string;
  stale: boolean;
};

// ---------- Engine output ----------

export type CardResult = {
  cardId: string;
  name: string;
  short: string;
  color: string;
  image: string;
  rank: number;
  /** false = failed a hard filter. Still listed with dropReason so the UI can explain. */
  eligible: boolean;
  dropReason?: string;
  earn: {
    units: number;
    unitName: string;
    valueInr: number;
    /** Human label, for example "5 miles per ₹100". */
    rateLabel: string;
  } | null;
  offer: {
    merchant: string;
    label: string;
    valueInr: number;
    cap?: number;
    frequency: string;
  } | null;
  /** Offers this card has for the category, shown when merchantName is missing. Not scored. */
  offerHints: string[];
  fee: {
    markupPct: number;
    gstOnMarkupPct: number;
    effectivePct: number;
    inr: number;
    reimbursed: boolean;
  };
  net: number;
  warnings: string[];
  reminder?: string;
  reason: string;
};

export type Recommendation = {
  input: TransactionInput;
  amountInr: number;
  fxRateUsed: number | null;
  ranked: CardResult[];
  top: CardResult | null;
  speech: string;
};
