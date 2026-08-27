/**
 * Pure mappers from ExactPoint identifiers to MHub vertical-pack keys.
 * Pack convention (per MHub): appliance types are `<type>_repair`
 * (e.g. refrigerator_repair), HVAC types keep our slugs (ac_repair, …),
 * zones are `zone_<slug>` (zone_west = West Houston/Katy).
 */

const SERVICE_TYPE_PACK_KEYS: Record<string, string> = {
  refrigerator: "refrigerator_repair",
  freezer: "freezer_repair",
  washer: "washer_repair",
  dryer: "dryer_repair",
  dishwasher: "dishwasher_repair",
  oven: "oven_repair",
  stove_range: "range_repair",
  cooktop: "cooktop_repair",
  microwave: "microwave_repair",
  ice_maker: "ice_maker_repair",
  water_filtration: "water_filtration",
  hvac_diagnostic: "hvac_diagnostic",
  ac_repair: "ac_repair",
  heating_repair: "heating_repair",
  hvac_maintenance: "hvac_maintenance",
  thermostat: "thermostat",
};

export function toPackServiceType(serviceTypeSlug: string | null | undefined): string {
  if (!serviceTypeSlug) return "other";
  return SERVICE_TYPE_PACK_KEYS[serviceTypeSlug] ?? "other";
}

export function toPackZone(zoneSlug: string | null | undefined): string | undefined {
  return zoneSlug ? `zone_${zoneSlug}` : undefined;
}

/** Our customers.phone is digits (optionally +…); MHub call-matching wants E.164. */
export function toE164(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  return undefined;
}
