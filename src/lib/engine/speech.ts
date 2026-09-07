// One-line plain-text answer for Siri.
// Example: "Use WOW Black. Zero forex, 4 RP per ₹150, about 98 rupees back. Horizon would cost 121 in markup."

import type { CardResult, TransactionInput } from "../types";

function rupees(n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString("en-IN")} rupees`;
}

function rewardOf(r: CardResult): number {
  return (r.earn?.valueInr ?? 0) + (r.offer?.valueInr ?? 0);
}

export function buildSpeech(input: TransactionInput, ranked: CardResult[], top: CardResult | null): string {
  if (!top) return "No card works for this one.";
  const bits: string[] = [];
  if (input.currency !== "INR" && top.fee.inr === 0) bits.push("Zero forex");
  if (top.earn && top.earn.units > 0) bits.push(`${top.earn.rateLabel.replace(/ \(.*\)$/, "")}`);
  if (top.offer) bits.push(`${Math.round(top.offer.valueInr)} off via ${top.offer.merchant}`);
  if (top.fee.reimbursed) bits.push(`${rupees(top.fee.inr)} markup reimbursed`);

  let outcome: string;
  if (top.net > 0) outcome = `about ${rupees(top.net)} back`;
  else if (top.net === 0) outcome = "nothing back but no fee";
  else outcome = `loses least, about ${rupees(top.net)} in fees`;

  const first = bits.length ? `${bits.join(", ")}, ${outcome}.` : `${outcome[0].toUpperCase()}${outcome.slice(1)}.`;

  const others = ranked.filter((r) => r.eligible && r.cardId !== top.cardId);
  let tail = "";
  // Name the costly card you would most plausibly have reached for: the one
  // with the most reward at stake, then the highest net.
  const costly = others
    .filter((r) => r.fee.inr > 0 && !r.fee.reimbursed && top.fee.inr === 0)
    .sort((a, b) => rewardOf(b) - rewardOf(a) || b.net - a.net)[0];
  if (costly) tail = ` ${costly.short} would cost ${rupees(costly.fee.inr)} in markup.`;
  else if (others[0]) tail = ` ${others[0].short} is next at about ${rupees(others[0].net)}.`;

  return `Use ${top.short}. ${first}${tail}`;
}
