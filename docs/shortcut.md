# iOS Shortcut

One dictation, one HTTP call, one spoken answer. The Shortcut talks to `POST /api/ask`.

## The endpoint

```
POST https://swipe.aayu.sh/api/ask
Authorization: Bearer <CARDPICK_SECRET>
Content-Type: application/json

{ "text": "Zomato order 600 rupees on UPI" }
```

Response, 200:

```json
{
  "speech": "Use Neo. 1 EDGE point per ₹200, 120 off via Zomato, about 121 rupees back. slice is next at about 6 rupees.",
  "top": { "cardId": "neo", "short": "Neo", "net": 120.6, "...": "full CardResult" },
  "ranked": [ { "rank": 1, "cardId": "neo", "...": "..." }, { "rank": 2, "cardId": "slice", "...": "..." } ],
  "parsed": { "amount": 600, "currency": "INR", "country": "IN", "merchantName": "Zomato", "category": "food_delivery", "rail": "upi", "expensed": false, "isEmi": false, "notes": null },
  "amountInr": 600,
  "fx": { "stale": false, "fetchedAt": "2026-09-07T04:00:00.000Z" }
}
```

`speech` is always present, even on errors, so the Shortcut can read it out without branching:

| Status | When | `speech` |
| --- | --- | --- |
| 200 | Worked | The recommendation |
| 400 | Empty text | "I didn't catch what you're buying." |
| 401 | Wrong or missing bearer | no body, fix the header |
| 422 | Amount missing, or no FX rate for the currency | Asks for the amount |
| 502 | Parser failed | "The parser failed, try again." |

If the parser could not infer currency, country, category or rail, the endpoint fills sensible defaults (INR, India, other, card online) and appends "I assumed ..." to `speech`. The web UI asks a follow-up instead. Use the web UI when it matters.

Each entry in `ranked` is a `CardResult`: `cardId`, `name`, `short`, `rank`, `eligible`, `dropReason`, `earn` (units, unitName, valueInr, rateLabel), `offer` (merchant, label, valueInr, cap, frequency), `offerHints`, `fee` (markupPct, gstOnMarkupPct, effectivePct, inr, reimbursed), `net`, `warnings`, `reminder`, `reason`.

## Building the Shortcut

1. Open Shortcuts, tap +, name it "Which card".
2. Add **Dictate Text**. Language English (India). Stop listening: after pause.
3. Add **Get Contents of URL**.
   - URL: `https://swipe.aayu.sh/api/ask`
   - Method: POST
   - Headers: `Authorization` = `Bearer <your secret>`
   - Request Body: JSON, one field `text` = Dictated Text (pick the variable from the previous step).
4. Add **Get Dictionary Value**. Get: Value for `speech` in Contents of URL.
5. Add **Speak Text** with Dictionary Value. Wait until finished: on. Optionally add **Show Result** with the same variable so it stays on screen.
6. Tap the Shortcut's settings, enable "Show on Apple Watch" and "Use with Siri" if you want "Hey Siri, which card".

To also see the whole ranked list, add a second **Get Dictionary Value** for `ranked` and **Show Result**. It prints the JSON, which is readable enough on a phone.

## Testing from a terminal

```bash
curl -s https://swipe.aayu.sh/api/ask \
  -H "Authorization: Bearer $CARDPICK_SECRET" \
  -H "content-type: application/json" \
  -d '{"text":"Uber in Doha, 17 riyals"}' | jq .speech
```

## Skipping the parser

If you already have a structured input, call `POST /api/recommend` with a `TransactionInput` body and the same bearer header. No LLM call is made. Add `amountInr` when the currency is `OTHER`.
