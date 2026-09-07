# Changelog

One line per change that affects behaviour. Newest first.

## 2026-09-07

- First release. Six cards (Axis Horizon, Axis Neo, slice, IDFC WOW Black, IDFC Wealth debit, QNB debit), deterministic engine, gpt-5.6-luna parser, PWA, settings in Upstash Redis, `/api/ask` for the iOS Shortcut, optional Fold history panel.
- Ranking is purely by net. In QAR, zero-forex cards that earn (slice, WOW Black) outrank QNB debit, which earns nothing.
- slice earns its flat rate on every category, including utilities. Owner's call.
- Offers listed without a rupee cap (Neo Swiggy, Neo MakeMyTrip, Wealth Yatra) are scored uncapped with a "no cap listed" warning.
- Category-only offer matches (no merchant named) are shown as hints and never scored.
- Horizon break-even against zero-forex cards on a USD 200 subscription sits near ₹2.57 per mile once GST on the markup is included, not the ₹2.07 you get by ignoring GST.
