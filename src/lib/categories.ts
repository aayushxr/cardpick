// Category to MCC group mapping.
//
// The parser picks one of these categories. The rules engine only ever sees the
// category, never a raw MCC. The MCC list is documentation for humans checking
// why a card behaves the way it does; issuers publish their exclusion lists by
// MCC, so this is where the two vocabularies meet.

import type { Category } from "./types";

export type CategoryInfo = {
  label: string;
  /** Representative MCCs. Not exhaustive. */
  mcc: string[];
  /** One line on where the MCCs came from or what falls in here. */
  note: string;
};

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  airline_direct: {
    label: "Airline (direct)",
    mcc: ["3000-3299", "4511"],
    note: "Booked on the airline's own site or app. Axis Horizon pays 5x here.",
  },
  airline_ota: {
    label: "Flights via OTA",
    mcc: ["4722"],
    note: "MakeMyTrip, Cleartrip, Yatra, ixigo. MCC 4722 is travel agencies, so airline multipliers do not apply.",
  },
  hotel: {
    label: "Hotel",
    mcc: ["3500-3999", "7011"],
    note: "Direct or via OTA. OTA hotel bookings also land on 4722 but issuers treat them as hotel for offers.",
  },
  dining: {
    label: "Dining",
    mcc: ["5812", "5813", "5814"],
    note: "Restaurants, bars, fast food paid in person.",
  },
  food_delivery: {
    label: "Food delivery",
    mcc: ["5812", "5814"],
    note: "Zomato, Swiggy. Same MCCs as dining; split out because the offers differ.",
  },
  grocery_quick_commerce: {
    label: "Grocery / quick commerce",
    mcc: ["5411", "5499"],
    note: "Blinkit, Zepto, Instamart, supermarkets.",
  },
  shopping_online: {
    label: "Online shopping",
    mcc: ["5311", "5651", "5699", "5732", "5999"],
    note: "Amazon, Flipkart, Myntra, Tira.",
  },
  shopping_offline: {
    label: "In-store shopping",
    mcc: ["5311", "5651", "5699", "5732", "5999"],
    note: "Same MCCs as online; rail is what differs.",
  },
  subscription_software: {
    label: "Software / subscription",
    mcc: ["5734", "5817", "5818", "7372"],
    note: "Claude, ChatGPT, GitHub, Netflix, Spotify.",
  },
  ride_hailing: {
    label: "Ride-hailing",
    mcc: ["4121"],
    note: "Uber, Ola, Rapido, Careem. Axis excludes 4121 from earning.",
  },
  fuel: {
    label: "Fuel",
    mcc: ["5541", "5542", "5983"],
    note: "Every card here earns 0 on fuel.",
  },
  utility: {
    label: "Utility",
    mcc: ["4900", "4814", "4816"],
    note: "Electricity, water, gas, broadband, mobile recharge.",
  },
  insurance: {
    label: "Insurance",
    mcc: ["6300", "5960"],
    note: "Premium payments.",
  },
  rent: {
    label: "Rent",
    mcc: ["6513"],
    note: "Rent via CRED, NoBroker, Paytm. Fees on top of markup usually apply too; not modelled.",
  },
  education: {
    label: "Education",
    mcc: ["8211", "8220", "8299"],
    note: "School, college, courses.",
  },
  government: {
    label: "Government",
    mcc: ["9311", "9399", "9222"],
    note: "Tax, challans, passport fees.",
  },
  wallet_load: {
    label: "Wallet load",
    mcc: ["6540"],
    note: "Paytm wallet, Amazon Pay balance, PhonePe wallet.",
  },
  movies: {
    label: "Movies / events",
    mcc: ["7832", "7922"],
    note: "BookMyShow, District, PVR.",
  },
  pharmacy: {
    label: "Pharmacy",
    mcc: ["5912", "5122"],
    note: "Apollo, PharmEasy, 1mg.",
  },
  other: {
    label: "Other",
    mcc: [],
    note: "Anything that does not fit above. Earns at base rate everywhere.",
  },
};

export function categoryLabel(c: Category): string {
  return CATEGORY_INFO[c].label;
}

export function categoryMcc(c: Category): string {
  return CATEGORY_INFO[c].mcc[0] ?? "n/a";
}
