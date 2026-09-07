# Scoring

The engine is `src/lib/engine/score.ts`. It is deterministic, has no network access, and never sees the free-text description. Its input is a `TransactionInput` (see the README), the settings, and a rate map. This page describes what it does, in order, and matches the code.

## 0. Convert to INR

If the currency is not INR the amount is converted using the settings override for that currency, else the fetched rate. If neither exists the engine asks for an INR amount instead of guessing. All slabs, caps and fees are computed on this INR figure.

## 1. Hard filters

A card is dropped, with the reason shown, when:

- the rail is UPI and the card has no UPI (Horizon, Wealth debit, QNB);
- the card is restricted to certain currencies and this is not one of them (Neo outside INR);
- the category is in the card's zero-earn list, the card has no applicable offer, and at least one other card earns something.

The last one is applied after every card is scored, because it depends on the others.

EMI is not a drop. If `isEmi` is true and the card forfeits rewards on EMI (Horizon, WOW Black), the card stays in the list with zero earn, a warning, and a forced last place among the eligible cards.

## 2. Reward value

Reward value is earn plus offer.

Earn is slab-rounded. ₹259 at 2 per ₹100 is 2 slabs, so 4 units. ₹99 is 0 slabs and 0 units, and the card gets a "under ₹100 on the slab" warning. Leftover rupees are never carried across transactions. The rule used is picked in this order: merchant keyword override, category override, UPI tier (only when the rail is UPI), base. Cashback cards (slice) skip slabs and earn a straight percentage from settings.

Earn units are multiplied by the value per unit from settings.

Offer matching uses `merchantName` first. If the merchant matches an offer, the offer is valued (flat, percent or half the amount for 1+1), capped at its rupee cap if it has one, and blocked if the spend is under the minimum or the weekday condition fails. When more than one offer matches, the highest value wins. If the merchant does not match anything, offers in the same category are listed as hints on the card ("If this is Zomato: flat ₹120 off...") and contribute nothing to the score. That is deliberate: the offer only exists at that one merchant.

## 3. Fees

Fee is the forex markup on the INR amount. The markup percent comes from the card's per-currency table or its default. Cards whose home currency matches the transaction currency pay nothing. Where the issuer charges GST on the markup (Axis, 18%), the effective rate is markup × 1.18, so 3.5% becomes 4.13%.

If the transaction is expensed, the fee is still computed and displayed, marked "reimbursed by Qlub", but scored as zero.

## 4. Net and ranking

Net = reward value minus the fee used for ranking.

Eligible cards are sorted by: EMI-forfeit cards last, then higher net, then fewer warnings, then higher reward. Dropped cards follow, in their original order, with their drop reason.

## 5. Warnings

Shown on the card whenever relevant:

- `<Category> earns 0 on <card> (MCC <n>)`
- `This ticket is under ₹<slab> on the slab, earns 0 on <card>`
- `EMI forfeits rewards on <card>`
- `Forex markup ₹X on this card, ₹0 on <best zero-forex card>` (added after ranking, naming the highest-ranked eligible card with no fee)
- `Offer cap ₹X, check you haven't used it this month`
- `<Merchant> offer has no cap listed, check before paying`
- any `note` on the offer

## The Siri line

`speech` is built from the top card: zero forex if applicable, the earn rate, the offer, whether the fee is reimbursed, and the rounded net. It then names one other card: the one with the most reward at stake that would have charged a markup, or failing that the runner-up and its net.

## Things it does not do

- Track offer usage. You keep count.
- Track the WOW credit limit. It is a reminder on the row.
- Feed Fold history into the score. That panel is history, not advice.
- Model slice Spark deals.
