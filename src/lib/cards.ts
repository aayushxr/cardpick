// The card table. This is the one file you edit to add your own cards.
//
// Every number here came from the issuer's published terms as of September 2026
// or from the owner's own statements. Each rate carries a short comment saying
// where it came from. Values per point live in settings, not here, because they
// change with how you redeem.
//
// Rules of the table:
//   - "per ₹100" and "per ₹150" earns are per-transaction slabs rounded down.
//     ₹259 at 2 per ₹100 earns 4, not 5.18. Leftover rupees are never carried.
//   - Offers are surfaced with their cap and frequency. Usage is not tracked.
//   - Issuer quirks (GST on markup, UPI support, INR-only) are card properties.
//     The engine has no branches keyed on a card id.
//   - Artwork: put the card's front face at public/cards/<id>.png (or jpg,
//     webp, avif). `color` is the fallback when the file is missing.

import type { Card } from "./types";

export const CARDS: Card[] = [
  // ---------------------------------------------------------------------
  {
    id: "horizon",
    name: "Axis Horizon",
    short: "Horizon",
    issuer: "Axis Bank",
    network: "Visa",
    kind: "credit",
    color: "#3a0b2a", // Axis Horizon artwork: near-black with a magenta horizon; fallback behind the artwork
    homeCurrency: "INR",
    supportsUpi: false, // Visa credit, no RuPay variant
    unit: { name: "EDGE Mile", plural: "EDGE Miles", settingsKey: "horizonMile" },
    earn: {
      base: { points: 2, per: 100 }, // Axis Horizon T&C: 2 EDGE Miles per ₹100 on all other eligible spend
      byCategory: {
        airline_direct: { points: 5, per: 100 }, // 5 EDGE Miles per ₹100 on direct airline spend
      },
      // Axis exclusion list by MCC: 4121 cabs, fuel, utilities, insurance, rent,
      // education, government, wallet loads.
      zeroCategories: [
        "ride_hailing",
        "fuel",
        "utility",
        "insurance",
        "rent",
        "education",
        "government",
        "wallet_load",
      ],
      forfeitOnEmi: true, // Axis: EDGE Miles reversed when a transaction is converted to EMI
    },
    forex: {
      defaultPct: 3.5, // Axis Horizon foreign currency markup
      gstOnMarkupPct: 18, // GST on the markup, effective 4.13%
      byCurrency: { INR: 0 },
    },
    offers: [],
  },

  // ---------------------------------------------------------------------
  {
    id: "neo",
    name: "Axis Neo",
    short: "Neo",
    issuer: "Axis Bank",
    network: "RuPay",
    kind: "credit",
    color: "#b3004f", // Axis Neo artwork: magenta; fallback behind the artwork
    homeCurrency: "INR",
    supportsUpi: true, // RuPay credit on UPI
    unit: { name: "EDGE point", plural: "EDGE points", settingsKey: "neoPoint" },
    earn: {
      base: { points: 1, per: 200 }, // Axis Neo: 1 EDGE Reward Point per ₹200, roughly 0.1%
      zeroCategories: ["rent", "fuel", "wallet_load", "education", "insurance"], // Axis Neo exclusion list
      zeroMerchantKeywords: ["gift card", "giftcard"], // Neo excludes gift card purchases
      forfeitOnEmi: false,
    },
    forex: {
      defaultPct: 3.5, // Axis Neo markup; the card is INR-only anyway
      gstOnMarkupPct: 18,
      byCurrency: { INR: 0 },
    },
    onlyCurrencies: ["INR"], // never recommend Neo outside INR
    // Axis Neo merchant offers. Caps and frequency straight from the Axis offer page.
    // The engine does not track usage; it shows the cap and frequency and you keep count.
    offers: [
      {
        merchant: "Zomato",
        match: ["zomato"],
        categories: ["food_delivery"],
        type: "flat",
        value: 120,
        minSpend: 499,
        frequency: "2 times per month",
      },
      {
        merchant: "Blinkit",
        match: ["blinkit"],
        categories: ["grocery_quick_commerce"],
        type: "percent",
        value: 10,
        cap: 250,
        minSpend: 750,
        frequency: "once per month",
      },
      {
        merchant: "BookMyShow",
        match: ["bookmyshow", "book my show", "bms"],
        categories: ["movies"],
        type: "percent",
        value: 10,
        cap: 100,
        frequency: "every ticket, max ₹100 per month",
      },
      {
        merchant: "Paytm utility bills",
        match: ["paytm"],
        categories: ["utility"],
        type: "percent",
        value: 5,
        cap: 150,
        minSpend: 299,
        frequency: "once per month",
        note: "Utility bill payments through Paytm only",
      },
      {
        merchant: "Myntra",
        match: ["myntra"],
        categories: ["shopping_online"],
        type: "flat",
        value: 150,
        minSpend: 999,
        frequency: "selected styles",
        note: "Selected styles only",
      },
      {
        merchant: "Swiggy",
        match: ["swiggy"],
        categories: ["food_delivery"],
        type: "percent",
        value: 10,
        frequency: "no frequency listed",
      },
      {
        merchant: "Tira",
        match: ["tira"],
        categories: ["shopping_online"],
        type: "percent",
        value: 10,
        cap: 1000,
        frequency: "no frequency listed",
      },
      {
        merchant: "Cleartrip flights",
        match: ["cleartrip"],
        categories: ["airline_ota"],
        type: "percent",
        value: 7,
        cap: 2000,
        frequency: "no frequency listed",
        note: "Domestic and international flights",
      },
      {
        merchant: "Cleartrip hotels",
        match: ["cleartrip"],
        categories: ["hotel"],
        type: "percent",
        value: 18,
        cap: 4000,
        frequency: "no frequency listed",
      },
      {
        merchant: "MakeMyTrip",
        match: ["makemytrip", "make my trip", "mmt"],
        categories: ["airline_ota", "hotel"],
        type: "percent",
        value: 15,
        frequency: "Wednesdays only",
        weekday: 3,
        note: "Instant savings up to 15% on flights and hotels. Axis lists no rupee cap.",
      },
    ],
  },

  // ---------------------------------------------------------------------
  {
    id: "slice",
    name: "slice UPI credit card",
    short: "slice",
    issuer: "slice",
    network: "RuPay",
    kind: "credit",
    color: "#e8237f", // slice card colour, from the owner
    homeCurrency: "INR",
    supportsUpi: true, // works on any UPI app and as a card
    unit: { name: "Monie", plural: "Monies", settingsKey: "sliceMonie" },
    earn: {
      base: null,
      percentFromSettings: "sliceCashbackRate", // 1% flat, 2% after 3 lakh cumulative Monies; set in settings
      zeroCategories: [], // owner confirmed: no category exclusions
      forfeitOnEmi: false,
    },
    forex: {
      defaultPct: 0, // slice: zero forex markup
      gstOnMarkupPct: 0,
    },
    offers: [], // Spark weekly deals are deliberately not modelled
  },

  // ---------------------------------------------------------------------
  {
    id: "wow",
    name: "IDFC FIRST WOW! Black",
    short: "WOW Black",
    issuer: "IDFC FIRST Bank",
    network: "Mastercard",
    kind: "credit",
    color: "#161616", // IDFC WOW! Black: black; approximate, display only
    homeCurrency: "INR",
    supportsUpi: true, // RuPay virtual card linked for UPI
    unit: { name: "RP", plural: "RP", settingsKey: "wowRp" },
    earn: {
      base: { points: 4, per: 150 }, // IDFC WOW: 4 RP per ₹150 online, offline, international
      byCategory: {
        utility: { points: 1, per: 150 }, // IDFC WOW: 1 RP per ₹150 on utilities
        insurance: { points: 1, per: 150 }, // IDFC WOW: 1 RP per ₹150 on insurance
      },
      upi: {
        threshold: 2000, // IDFC WOW UPI: 3 RP per ₹150 above ₹2,000, 1 RP per ₹150 at or below
        above: { points: 3, per: 150 },
        atOrBelow: { points: 1, per: 150 },
      },
      byMerchant: [
        {
          match: ["irctc", "railway", "fastag"],
          label: "railway / FASTag",
          earn: { points: 1, per: 150 }, // IDFC WOW: 1 RP per ₹150 on railway and FASTag
        },
      ],
      zeroCategories: ["fuel"], // IDFC WOW: fuel earns nothing
      forfeitOnEmi: true, // IDFC WOW: EMI transactions earn nothing
    },
    forex: {
      defaultPct: 0, // IDFC WOW: zero forex markup
      gstOnMarkupPct: 0,
    },
    offers: [],
    reminder: "Credit limit ₹40,000 (FD-backed)",
  },

  // ---------------------------------------------------------------------
  {
    id: "wealth",
    name: "IDFC FIRST Wealth debit",
    short: "Wealth debit",
    issuer: "IDFC FIRST Bank",
    network: "Visa Infinite",
    kind: "debit",
    color: "#12395a", // IDFC Wealth debit artwork: deep blue; approximate, display only
    homeCurrency: "INR",
    supportsUpi: false, // a debit card on UPI is just the bank account; no card benefit applies
    unit: null, // no base rewards
    earn: {
      base: null,
      zeroCategories: [],
      forfeitOnEmi: false,
    },
    forex: {
      defaultPct: 2, // IDFC Wealth debit: 2% on international POS and ecom
      gstOnMarkupPct: 0, // no GST on markup listed
      byCurrency: { INR: 0 },
    },
    // IDFC FIRST Wealth debit bank offers. Assumed once per month unless stated.
    offers: [
      {
        merchant: "Swiggy",
        match: ["swiggy"],
        categories: ["food_delivery"],
        type: "percent",
        value: 25,
        cap: 125,
        minSpend: 499,
        frequency: "once per month",
      },
      {
        merchant: "Zepto",
        match: ["zepto"],
        categories: ["grocery_quick_commerce"],
        type: "percent",
        value: 20,
        cap: 125,
        minSpend: 599,
        frequency: "once per month",
      },
      {
        merchant: "Instamart",
        match: ["instamart"],
        categories: ["grocery_quick_commerce"],
        type: "percent",
        value: 10,
        cap: 75,
        minSpend: 500,
        frequency: "once per month",
      },
      {
        merchant: "Yatra",
        match: ["yatra"],
        categories: ["airline_ota", "hotel"],
        type: "percent",
        value: 20,
        minSpend: 1000,
        frequency: "once per month",
        note: "Flights, hotels, bus. No rupee cap listed.",
      },
      {
        merchant: "ixigo",
        match: ["ixigo"],
        categories: ["airline_ota"],
        type: "percent",
        value: 8,
        cap: 1000,
        frequency: "once per month",
        note: "Flights only",
      },
      {
        merchant: "Apollo",
        match: ["apollo"],
        categories: ["pharmacy"],
        type: "flat",
        value: 200,
        minSpend: 2000,
        frequency: "once per month",
      },
      {
        merchant: "Flo",
        match: ["flo"],
        categories: ["shopping_online"],
        type: "bogo",
        value: 0,
        frequency: "once per month",
        note: "Buy one bedsheet, get one free",
      },
      {
        merchant: "District movies",
        match: ["district"],
        categories: ["movies"],
        type: "bogo",
        value: 0,
        cap: 500,
        frequency: "once per month",
        note: "1+1 on movie tickets",
      },
      {
        merchant: "District dining",
        match: ["district"],
        categories: ["dining"],
        type: "percent",
        value: 15,
        cap: 750,
        frequency: "once per month",
      },
      {
        merchant: "District shopping",
        match: ["district"],
        categories: ["shopping_online", "shopping_offline"],
        type: "percent",
        value: 15,
        cap: 750,
        frequency: "once per month",
      },
    ],
  },

  // ---------------------------------------------------------------------
  {
    id: "qnb",
    name: "QNB debit",
    short: "QNB debit",
    issuer: "QNB",
    network: "Mastercard",
    kind: "debit",
    color: "#1a3fb5", // QNB debit artwork: blue; fallback behind qnb.png
    homeCurrency: "QAR",
    supportsUpi: false,
    unit: null, // no rewards
    earn: {
      base: null,
      zeroCategories: [],
      forfeitOnEmi: false,
    },
    forex: {
      byCurrency: {
        QAR: 0, // QNB: QAR transactions carry no fee
        USD: 2, // QNB: 2% on USD
        INR: 3, // QNB: 3% on everything that is not GCC or USD
      },
      defaultPct: 3, // QNB: 3% on other currencies (1.25% for GCC currencies, none of which are in the enum)
      gstOnMarkupPct: 0,
    },
    offers: [],
  },
];

export function cardById(id: string): Card | undefined {
  return CARDS.find((c) => c.id === id);
}
