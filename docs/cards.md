# Cards

`src/lib/cards.ts` is the only file you edit to describe your own cards. The engine reads it and nothing else. Every rate in it should carry a one-line comment saying where the number came from, because the whole point of the tool is that nothing in a recommendation is guessed.

Values per point are not in the card table. They live in settings, because they depend on how you redeem.

## Schema

The `Card` type is in `src/lib/types.ts`. The fields, in the order you meet them:

| Field | What it does |
| --- | --- |
| `id` | Stable key. Used in tests and in the API response. |
| `name`, `short` | Full name for the list, short name for the top pick and the Siri line. |
| `issuer`, `network`, `kind` | Display only. |
| `homeCurrency` | Spends in this currency never carry a forex markup. QNB is `QAR`, everything else is `INR`. |
| `supportsUpi` | If false the card is dropped whenever the rail is UPI. |
| `unit` | Name of the reward unit and which settings key holds its rupee value. `null` means the card never earns. |
| `earn.base` | Points per slab of rupees. `{ points: 2, per: 100 }` is 2 per ₹100. Slabs round down per transaction. |
| `earn.byCategory` | Category overrides, for example 5 per ₹100 on `airline_direct`. |
| `earn.percentFromSettings` | For cashback cards. Points to the settings key holding the percent. slice uses this. |
| `earn.upi` | UPI-only tiers with a rupee threshold. WOW Black earns 3 per ₹150 above ₹2,000 and 1 per ₹150 at or below. |
| `earn.byMerchant` | Merchant keyword overrides for things the MCC groups cannot express, like IRCTC and FASTag on WOW. |
| `earn.zeroCategories` | Categories that earn nothing. The card is dropped if it is here, has no offer, and another card earns. |
| `earn.zeroMerchantKeywords` | Merchant keywords that earn nothing, like gift cards on Neo. |
| `earn.forfeitOnEmi` | When true and the input has `isEmi`, earn is 0, a warning is shown, and the card sorts last among the eligible. |
| `forex.defaultPct` | Markup percent on any currency not in `byCurrency`. |
| `forex.byCurrency` | Per-currency markup. QNB is 0 on QAR, 2 on USD, 3 on INR. |
| `forex.gstOnMarkupPct` | GST charged on the markup itself. Axis charges 18, so 3.5% becomes 4.13%. |
| `onlyCurrencies` | Hard rule. Neo is `["INR"]` and is dropped everywhere else. |
| `offers` | Merchant offers, see below. |
| `reminder` | Static text on the card row. Never scored. WOW shows its ₹40,000 limit here. |

## Offers

Offers are why a 0.1% card like Neo sometimes wins. Each offer has:

| Field | What it does |
| --- | --- |
| `merchant` | Display name. |
| `match` | Lowercase substrings matched against `merchantName`. |
| `categories` | Categories the offer belongs to. When the merchant does not match, offers in the same category are shown as hints only and never scored. |
| `type` | `flat` (rupees off), `percent`, or `bogo` (valued at half the amount). |
| `value` | Rupees for flat, percent for percent. Ignored for bogo. |
| `cap` | Rupee cap per use. Leave it out if the issuer lists none; the engine then warns "no cap listed". |
| `minSpend` | Below this the offer is not applied and a hint says why. |
| `frequency` | Plain English, shown to the user. Usage is not tracked. |
| `weekday` | 0 to 6, Sunday first, in Asia/Kolkata. MakeMyTrip on Neo is 3. |
| `note` | Anything else worth reading before you rely on it. |

## An annotated example

```ts
{
  id: "wow",
  name: "IDFC FIRST WOW! Black",
  short: "WOW Black",
  issuer: "IDFC FIRST Bank",
  network: "Mastercard",
  kind: "credit",
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
      threshold: 2000, // 3 RP per ₹150 above ₹2,000, 1 RP per ₹150 at or below
      above: { points: 3, per: 150 },
      atOrBelow: { points: 1, per: 150 },
    },
    byMerchant: [
      { match: ["irctc", "railway", "fastag"], label: "railway / FASTag", earn: { points: 1, per: 150 } },
    ],
    zeroCategories: ["fuel"],
    forfeitOnEmi: true, // EMI transactions earn nothing
  },
  forex: {
    defaultPct: 0, // zero forex markup
    gstOnMarkupPct: 0,
  },
  offers: [],
  reminder: "Credit limit ₹40,000 (FD-backed)",
}
```

A ₹2,500 electricity bill on this card: category `utility` overrides base, so 2,500 / 150 = 16 slabs at 1 RP = 16 RP. At the default ₹0.25 per RP that is ₹4. No markup because the currency is INR.

## Adding a card

1. Copy the closest existing entry in `cards.ts`.
2. Change every number and write where it came from in the trailing comment.
3. If the card has its own reward unit, add a key to `UnitKey` in `types.ts`, a default in `DEFAULT_SETTINGS`, and a row in `SettingsForm.tsx`.
4. Add a test in `tests/engine.test.ts` for the one purchase where you expect it to win.
5. Run `pnpm test`.
