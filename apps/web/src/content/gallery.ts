/**
 * Our Work gallery — every image is a real ExactPoint job photo supplied by
 * the owner (spec §49). Alt text describes what's visible; no invented
 * locations, customers, or claims.
 */
export interface WorkPhoto {
  src: string;
  alt: string;
  /** true → suitable as a larger feature tile */
  feature?: boolean;
}

export interface WorkCategory {
  slug: string;
  title: string;
  blurb: string;
  photos: WorkPhoto[];
}

export const WORK_GALLERY: WorkCategory[] = [
  {
    slug: "hvac",
    title: "HVAC",
    blurb: "Cooling and heating — diagnostics, repair, and installs from attic furnaces to outdoor condensers.",
    photos: [
      { src: "/images/work/hvac-gauges-condenser.jpg", alt: "Refrigerant manifold gauges connected to an outdoor AC condenser during service", feature: true },
      { src: "/images/work/hvac-trane-condenser.jpg", alt: "Outdoor AC condenser unit after service" },
      { src: "/images/work/hvac-ruud-condenser.jpg", alt: "High-efficiency outdoor AC unit beside a brick wall" },
      { src: "/images/work/hvac-smart-thermostat.jpg", alt: "Smart touchscreen thermostat installed on a wall" },
      { src: "/images/work/hvac-lennox-furnace.jpg", alt: "Furnace with diagnostic panel during heating service" },
      { src: "/images/work/hvac-attic-ductwork.jpg", alt: "Flexible ductwork in an attic during an airflow inspection" },
    ],
  },
  {
    slug: "refrigerators",
    title: "Refrigerators",
    blurb: "From compressors and evaporators to ice makers and temperature control.",
    photos: [
      { src: "/images/work/fridge-stainless-kitchen.jpg", alt: "Stainless side-by-side refrigerator back in service in a kitchen", feature: true },
      { src: "/images/work/fridge-display-panel.jpg", alt: "Refrigerator temperature display panel after repair" },
      { src: "/images/work/fridge-evaporator.jpg", alt: "Freezer evaporator area open during a defrost-system repair" },
      { src: "/images/work/fridge-coil-clean.jpg", alt: "Refrigerator condenser coil area after cleaning" },
    ],
  },
  {
    slug: "laundry",
    title: "Washers & Dryers",
    blurb: "Front-load, top-load, stacked pairs — drainage, drums, belts, and controls.",
    photos: [
      { src: "/images/work/laundry-lg-pair.jpg", alt: "Front-load washer and dryer pair on pedestals after service", feature: true },
      { src: "/images/work/laundry-white-pair.jpg", alt: "Washer and dryer pair in a laundry closet after repair" },
      { src: "/images/work/laundry-whirlpool-frontload.jpg", alt: "Front-load washer after service" },
      { src: "/images/work/laundry-speed-queen.jpg", alt: "Top-load washer after repair" },
    ],
  },
  {
    slug: "cooking",
    title: "Cooking Appliances",
    blurb: "Ovens, ranges, and cooktops — gas and electric, home and commercial.",
    photos: [
      { src: "/images/work/cooking-gas-range.jpg", alt: "Stainless gas range after repair", feature: true },
      { src: "/images/work/cooking-pro-range.jpg", alt: "Professional-style range and double oven serviced in a kitchen" },
      { src: "/images/work/cooking-wall-oven.jpg", alt: "Built-in wall oven after service" },
      { src: "/images/work/cooking-commercial-oven.jpg", alt: "Commercial convection oven during a service visit" },
    ],
  },
];

export const HOME_WORK_PREVIEW: WorkPhoto[] = [
  WORK_GALLERY[0]!.photos[0]!,
  WORK_GALLERY[1]!.photos[0]!,
  WORK_GALLERY[3]!.photos[0]!,
];
