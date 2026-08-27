/**
 * Pure mappers from ExactPoint identifiers to MHub vertical-pack keys —
 * confirmed against the pack's exact key list (2026-08-27). Unmapped values
 * OMIT the attr entirely (rolls up as unattributed) rather than sending an
 * invented key that would pollute the analytics dimensions.
 */

const SERVICE_TYPE_PACK_KEYS: Record<string, string> = {
  refrigerator: "refrigerator_repair",
  freezer: "freezer_repair",
  washer: "washer_repair",
  dryer: "dryer_repair",
  dishwasher: "dishwasher_repair",
  oven: "oven_range_repair",
  stove_range: "oven_range_repair",
  cooktop: "cooktop_repair",
  microwave: "microwave_repair",
  ice_maker: "ice_maker_repair",
  water_filtration: "water_filtration",
  hvac_diagnostic: "hvac_diagnostics",
  ac_repair: "ac_repair",
  heating_repair: "heating_repair",
  hvac_maintenance: "hvac_maintenance",
  thermostat: "thermostat_repair",
};

export function toPackServiceType(serviceTypeSlug: string | null | undefined): string | undefined {
  if (!serviceTypeSlug) return undefined;
  return SERVICE_TYPE_PACK_KEYS[serviceTypeSlug];
}

/**
 * MHub's Houston zone set has no zone_east — our east zone (Channelview/
 * Baytown, the ship-channel corridor) folds into zone_southeast per MHub.
 * Zones are owner-editable, so unknown slugs are omitted, never invented.
 */
const ZONE_PACK_KEYS: Record<string, string> = {
  central: "zone_central",
  west: "zone_west",
  northwest: "zone_northwest",
  north: "zone_north",
  northeast: "zone_northeast",
  east: "zone_southeast",
  southwest: "zone_southwest",
  south: "zone_south",
  southeast: "zone_southeast",
};

export function toPackZone(zoneSlug: string | null | undefined): string | undefined {
  if (!zoneSlug) return undefined;
  return ZONE_PACK_KEYS[zoneSlug];
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
