import type { SkillCategory } from "@exactpoint/domain";

/**
 * Initial configuration seeds. Everything here is owner-editable at runtime —
 * these are starting defaults, not hard-coded business rules.
 */

export interface ServiceTypeSeed {
  slug: string;
  name: string;
  category: SkillCategory;
  defaultDurationMinutes: number;
  sortOrder: number;
}

/** Skills mirror service types 1:1 initially; the owner can restructure later. */
export const SERVICE_TYPE_SEEDS: ServiceTypeSeed[] = [
  { slug: "refrigerator", name: "Refrigerator", category: "appliance", defaultDurationMinutes: 90, sortOrder: 1 },
  { slug: "freezer", name: "Freezer", category: "appliance", defaultDurationMinutes: 90, sortOrder: 2 },
  { slug: "washer", name: "Washer", category: "appliance", defaultDurationMinutes: 75, sortOrder: 3 },
  { slug: "dryer", name: "Dryer", category: "appliance", defaultDurationMinutes: 75, sortOrder: 4 },
  { slug: "dishwasher", name: "Dishwasher", category: "appliance", defaultDurationMinutes: 75, sortOrder: 5 },
  { slug: "oven", name: "Oven", category: "appliance", defaultDurationMinutes: 90, sortOrder: 6 },
  { slug: "stove_range", name: "Stove / Range", category: "appliance", defaultDurationMinutes: 90, sortOrder: 7 },
  { slug: "cooktop", name: "Cooktop", category: "appliance", defaultDurationMinutes: 75, sortOrder: 8 },
  { slug: "microwave", name: "Microwave", category: "appliance", defaultDurationMinutes: 60, sortOrder: 9 },
  { slug: "ice_maker", name: "Ice Maker", category: "appliance", defaultDurationMinutes: 60, sortOrder: 10 },
  { slug: "water_filtration", name: "Water Filtration", category: "appliance", defaultDurationMinutes: 60, sortOrder: 11 },
  { slug: "hvac_diagnostic", name: "HVAC Diagnostic", category: "hvac", defaultDurationMinutes: 90, sortOrder: 20 },
  { slug: "ac_repair", name: "AC Repair", category: "hvac", defaultDurationMinutes: 120, sortOrder: 21 },
  { slug: "heating_repair", name: "Heating Repair", category: "hvac", defaultDurationMinutes: 120, sortOrder: 22 },
  { slug: "hvac_maintenance", name: "HVAC Maintenance", category: "hvac", defaultDurationMinutes: 90, sortOrder: 23 },
  { slug: "thermostat", name: "Thermostat", category: "hvac", defaultDurationMinutes: 60, sortOrder: 24 },
];

export interface ZoneSeed {
  slug: string;
  name: string;
  color: string;
  priority: number;
  zips: string[];
}

/**
 * Initial Greater Houston zones with representative ZIPs (owner-editable under
 * Settings → Service Zones; polygons are added there in Phase 6). Each ZIP may
 * belong to only one zone.
 */
export const ZONE_SEEDS: ZoneSeed[] = [
  {
    slug: "central",
    name: "Central Houston",
    color: "#4f46e5",
    priority: 0,
    zips: ["77002", "77003", "77004", "77005", "77006", "77007", "77008", "77009", "77010", "77019", "77098"],
  },
  {
    slug: "west",
    name: "West Houston",
    color: "#0891b2",
    priority: 0,
    zips: ["77024", "77042", "77055", "77063", "77077", "77079", "77094", "77449", "77450", "77493", "77494"],
  },
  {
    slug: "northwest",
    name: "Northwest Houston",
    color: "#059669",
    priority: 0,
    zips: ["77040", "77041", "77065", "77070", "77095", "77375", "77377", "77429", "77433"],
  },
  {
    slug: "north",
    name: "North Houston",
    color: "#65a30d",
    priority: 0,
    zips: ["77373", "77379", "77380", "77381", "77382", "77384", "77385", "77386", "77388", "77389"],
  },
  {
    slug: "northeast",
    name: "Northeast Houston",
    color: "#ca8a04",
    priority: 0,
    zips: ["77338", "77339", "77345", "77346", "77396"],
  },
  {
    slug: "east",
    name: "East Houston",
    color: "#ea580c",
    priority: 0,
    zips: ["77015", "77049", "77520", "77521", "77523", "77530"],
  },
  {
    slug: "southwest",
    name: "Southwest Houston",
    color: "#dc2626",
    priority: 0,
    zips: ["77083", "77459", "77477", "77478", "77479", "77489", "77498"],
  },
  {
    slug: "south",
    name: "South Houston",
    color: "#db2777",
    priority: 0,
    zips: ["77034", "77075", "77581", "77584", "77587", "77588"],
  },
  {
    slug: "southeast",
    name: "Southeast Houston",
    color: "#9333ea",
    priority: 0,
    zips: ["77058", "77059", "77062", "77502", "77503", "77504", "77505", "77506", "77536", "77573", "77586", "77598"],
  },
];

/** Soft-preference scoring weights — starting values, owner-tunable. */
export const DEFAULT_SCHEDULING_WEIGHTS = {
  customerPreference: 30,
  zoneAffinity: 20,
  routeProximity: 20,
  travelEfficiency: 15,
  scheduleCompactness: 10,
  workloadBalance: 10,
  technicianContinuity: 5,
  preferredZoneDay: 5,
  penaltyPerAdditionalTravelMinute: -0.5,
  penaltyRouteFragmentation: -10,
  penaltyIdleGap: -5,
  penaltyCrossTownTravel: -15,
} as const;
