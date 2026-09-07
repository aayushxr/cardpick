// The LLM layer. Turns free text into ParsedTransaction and nothing else.
// It never sees the card table and never decides which card to use.
//
// Model: gpt-5.6-luna via the Responses API, strict JSON schema, low reasoning.

import OpenAI from "openai";
import { CATEGORY_INFO } from "./categories";
import { CATEGORIES, type ParsedTransaction } from "./types";

export const PARSER_MODEL = process.env.CARDPICK_PARSER_MODEL ?? "gpt-5.6-luna";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["amount", "currency", "country", "merchantName", "category", "rail", "expensed", "isEmi", "notes"],
  properties: {
    amount: { type: ["number", "null"], description: "Amount in the transaction currency. null if not stated." },
    currency: { type: ["string", "null"], enum: ["INR", "QAR", "USD", "OTHER", null] },
    country: { type: ["string", "null"], enum: ["IN", "QA", "OTHER", null], description: "Where the merchant is, not where the user is." },
    merchantName: { type: ["string", "null"], description: "Merchant or app name as written, for example Zomato, airindia.com, District." },
    category: { type: ["string", "null"], enum: [...CATEGORIES, null] },
    rail: { type: ["string", "null"], enum: ["upi", "card_online", "card_pos", "tap", null] },
    expensed: { type: ["boolean", "null"], description: "true only if the user says the company reimburses it." },
    isEmi: { type: ["boolean", "null"], description: "true only if the user says they will convert to EMI." },
    notes: { type: ["string", "null"], description: "Anything relevant that did not fit, else null." },
  },
} as const;

function categoryGuide(): string {
  return CATEGORIES.map((c) => `- ${c}: ${CATEGORY_INFO[c].note}`).join("\n");
}

const SYSTEM = `You turn a short description of a purchase into a JSON object. You do not pick cards and you do not know reward rates.

Rules:
- amount: number in the currency the user names. "2.5k" is 2500. "35,000" is 35000. Unknown: null.
- currency: INR when rupees, ₹, Rs, or an Indian merchant with no other currency. QAR for riyals or Qatar. USD for dollars. OTHER for anything else. Unknown: null.
- country: where the merchant charges from. Indian apps and .in sites are IN. Qatar merchants are QA. US SaaS subscriptions like Claude, ChatGPT, GitHub, Netflix are OTHER. Unknown: null.
- merchantName: the app, site, or shop named. Keep the user's spelling. null when none.
- category: pick one from the list below. Flights on the airline's own site are airline_direct; on MakeMyTrip, Cleartrip, Yatra, ixigo they are airline_ota. Uber, Ola, Rapido, Careem are ride_hailing. Zomato and Swiggy food are food_delivery; Blinkit, Zepto, Instamart are grocery_quick_commerce. Electricity, water, gas, broadband, recharge are utility. Movie tickets (BookMyShow, District, PVR) are movies.
- rail: upi if the user says UPI, scan, QR, or names a UPI app (GPay, PhonePe, Paytm UPI). card_pos for in-person card swipes or inserts. tap for tap to pay. card_online for websites, apps, subscriptions, and foreign merchants. Default to card_online for online merchants and null only if genuinely unclear.
- expensed: true only if the user says it is reimbursed, expensed, on the company, or for work. Else false.
- isEmi: true only if the user mentions EMI or instalments. Else false.
- notes: short, only if something matters (for example "Wednesday", "gift card", "international flight"). Else null.

Categories:
${categoryGuide()}`;

export async function parseTransaction(text: string, client?: OpenAI): Promise<ParsedTransaction> {
  const openai = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: PARSER_MODEL,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: SYSTEM },
      { role: "user", content: text },
    ],
    text: {
      format: { type: "json_schema", name: "transaction_input", strict: true, schema },
    },
  });
  const raw = response.output_text;
  const parsed = JSON.parse(raw) as ParsedTransaction;
  return normalise(parsed);
}

function normalise(p: ParsedTransaction): ParsedTransaction {
  return {
    amount: typeof p.amount === "number" && p.amount > 0 ? p.amount : null,
    currency: p.currency ?? null,
    country: p.country ?? null,
    merchantName: p.merchantName?.trim() || null,
    category: p.category ?? null,
    rail: p.rail ?? null,
    expensed: p.expensed ?? null,
    isEmi: p.isEmi ?? null,
    notes: p.notes?.trim() || null,
  };
}

/** Which required fields are still missing after parsing. */
export function missingFields(p: ParsedTransaction): (keyof ParsedTransaction)[] {
  const out: (keyof ParsedTransaction)[] = [];
  if (p.amount === null) out.push("amount");
  if (p.currency === null) out.push("currency");
  if (p.country === null) out.push("country");
  if (p.category === null) out.push("category");
  if (p.rail === null) out.push("rail");
  return out;
}
