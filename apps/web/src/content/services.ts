/**
 * Public service-page content. Facts only — no invented brands, ratings, or
 * guarantees. Symptoms are generic diagnostics language, not claims.
 */
export interface ServiceContent {
  slug: string;
  bookingSlug: string;
  name: string;
  title: string;
  intro: string;
  symptoms: string[];
  category: "appliance" | "hvac";
}

export const SERVICES: ServiceContent[] = [
  {
    slug: "refrigerator",
    bookingSlug: "refrigerator",
    name: "Refrigerator Repair",
    title: "Refrigerator Repair in Greater Houston",
    intro:
      "A refrigerator problem can't wait. We diagnose cooling, leaking, icing, and noise issues across all major brands and give you a clear quote before any repair begins.",
    symptoms: [
      "Not cooling, or cooling unevenly",
      "Freezer cold but fridge warm",
      "Leaking water inside or under the unit",
      "Ice maker not making ice",
      "Loud humming, clicking, or buzzing",
      "Frost building up in the freezer",
    ],
    category: "appliance",
  },
  {
    slug: "washer",
    bookingSlug: "washer",
    name: "Washer Repair",
    title: "Washing Machine Repair in Greater Houston",
    intro:
      "From a washer that won't drain to one that walks across the laundry room, we find the cause and fix it — with the quote approved by you first.",
    symptoms: [
      "Won't start, fill, or drain",
      "Leaking water during a cycle",
      "Drum not spinning or agitating",
      "Excessive shaking or banging",
      "Door or lid won't lock / unlock",
      "Error codes on the display",
    ],
    category: "appliance",
  },
  {
    slug: "dryer",
    bookingSlug: "dryer",
    name: "Dryer Repair",
    title: "Dryer Repair in Greater Houston",
    intro:
      "A dryer that takes two cycles to dry — or produces no heat at all — usually has a specific, fixable cause. We diagnose it and quote the repair up front.",
    symptoms: [
      "No heat, or clothes take multiple cycles",
      "Drum not turning",
      "Won't start or stops mid-cycle",
      "Squealing, thumping, or grinding noises",
      "Overheating or a burning smell",
      "Error codes on the display",
    ],
    category: "appliance",
  },
  {
    slug: "dishwasher",
    bookingSlug: "dishwasher",
    name: "Dishwasher Repair",
    title: "Dishwasher Repair in Greater Houston",
    intro:
      "Standing water, dirty dishes after a full cycle, or a door that leaks on the kitchen floor — we repair the full range of dishwasher faults.",
    symptoms: [
      "Not draining, standing water in the tub",
      "Dishes come out dirty or filmy",
      "Leaking from the door or underneath",
      "Won't start or stops mid-cycle",
      "No water filling the tub",
      "Racks, spray arms, or dispenser problems",
    ],
    category: "appliance",
  },
  {
    slug: "oven-range",
    bookingSlug: "oven",
    name: "Oven & Range Repair",
    title: "Oven, Range & Cooktop Repair in Greater Houston",
    intro:
      "Gas or electric, wall oven or slide-in range: we service heating problems, ignition faults, control issues, and more — quoted before we repair.",
    symptoms: [
      "Oven not heating or heating unevenly",
      "Burners won't ignite or stay lit",
      "Temperature doesn't match the setting",
      "Broiler or bake element not working",
      "Control panel or display errors",
      "Self-clean or door-lock problems",
    ],
    category: "appliance",
  },
  {
    slug: "microwave",
    bookingSlug: "microwave",
    name: "Microwave Repair",
    title: "Microwave Repair in Greater Houston",
    intro:
      "Built-in and over-the-range microwaves are worth repairing. We diagnose heating, turntable, and control problems and tell you honestly whether repair makes sense.",
    symptoms: [
      "Runs but doesn't heat",
      "Sparking inside the cavity",
      "Turntable not rotating",
      "Buttons or display not responding",
      "Door switch problems",
      "Unusual noise while running",
    ],
    category: "appliance",
  },
  {
    slug: "ice-maker",
    bookingSlug: "ice_maker",
    name: "Ice Maker Repair",
    title: "Ice Maker Repair in Greater Houston",
    intro:
      "Standalone or in-fridge, an ice maker that stops producing usually has a specific water, temperature, or mechanical cause we can isolate and fix.",
    symptoms: [
      "No ice, or very slow production",
      "Small, hollow, or cloudy cubes",
      "Ice tastes or smells off",
      "Leaking water",
      "Ice maker frozen over",
      "Dispenser not dispensing",
    ],
    category: "appliance",
  },
  {
    slug: "water-filtration",
    bookingSlug: "water_filtration",
    name: "Water Filtration",
    title: "Water Filtration Service in Greater Houston",
    intro:
      "We service and install point-of-use water filtration — the systems that feed refrigerators, ice makers, and drinking-water taps.",
    symptoms: [
      "Filter change overdue or stuck",
      "Slow water flow from the dispenser",
      "Bad taste or odor in filtered water",
      "Leaks around filter housings",
      "New filtration installation",
    ],
    category: "appliance",
  },
  {
    slug: "commercial",
    bookingSlug: "other",
    name: "Commercial Appliance Repair",
    title: "Commercial Appliance Repair in Greater Houston",
    intro:
      "When business equipment stops, revenue stops. We repair commercial appliances of every kind across Greater Houston — with the same diagnosis-first honesty and a quote before any work begins.",
    symptoms: [
      "Commercial refrigerators and freezers not holding temperature",
      "Commercial washers and dryers down",
      "Commercial ovens and ranges not heating properly",
      "Ice machines producing slowly or not at all",
      "Commercial dishwashers not cleaning or draining",
      "Any other business appliance — ask us",
    ],
    category: "appliance",
  },
  {
    slug: "ac-repair",
    bookingSlug: "ac_repair",
    name: "AC Repair",
    title: "AC Repair in Greater Houston",
    intro:
      "In a Houston summer, cooling problems are urgent. We diagnose airflow, refrigerant-circuit, electrical, and thermostat issues and quote the fix before work begins.",
    symptoms: [
      "Blowing warm or weak air",
      "AC won't turn on",
      "Short-cycling on and off",
      "Ice on the refrigerant lines",
      "Water leaking around the indoor unit",
      "Unusual noises from the unit",
    ],
    category: "hvac",
  },
  {
    slug: "heating",
    bookingSlug: "heating_repair",
    name: "Heating Repair",
    title: "Heating Repair in Greater Houston",
    intro:
      "When a cold snap hits, a furnace or heat pump that won't heat needs attention fast. We find the fault and give you a clear path to warm again.",
    symptoms: [
      "No heat or weak heat",
      "Furnace won't ignite",
      "Blower runs but air stays cold",
      "Short-cycling",
      "Burning smell or unusual noise",
      "Thermostat not responding",
    ],
    category: "hvac",
  },
  {
    slug: "maintenance",
    bookingSlug: "hvac_maintenance",
    name: "HVAC Maintenance",
    title: "HVAC Maintenance in Greater Houston",
    intro:
      "Seasonal maintenance keeps cooling and heating systems efficient and catches small problems before they become July breakdowns.",
    symptoms: [
      "Seasonal tune-up (cooling or heating)",
      "Coil and condensate line cleaning",
      "Filter and airflow check",
      "Refrigerant-circuit inspection",
      "Electrical and safety checks",
      "Thermostat check and setup",
    ],
    category: "hvac",
  },
];

export function getService(slug: string): ServiceContent | undefined {
  return SERVICES.find((s) => s.slug === slug);
}

export const APPLIANCE_SERVICES = SERVICES.filter((s) => s.category === "appliance");
export const HVAC_SERVICES = SERVICES.filter((s) => s.category === "hvac");
