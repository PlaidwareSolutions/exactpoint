/**
 * Verified business facts for Exact Point Appliance & HVAC Services.
 * Only facts supplied by the owner belong here — never invent claims
 * (years in business, ratings, licenses, 24/7 availability, etc.).
 */
export const BUSINESS = {
  legalName: "ExactPoint Appliance & HVAC Services",
  displayName: "ExactPoint Appliance & HVAC",
  shortName: "ExactPoint",
  domain: "exactpointrepairs.com",
  phone: "281-915-8264",
  phoneHref: "tel:+12819158264",
  email: "info@exactpointrepairs.com",
  serviceArea: "Greater Houston, Texas",
  timezone: "America/Chicago",
  diagnosticFeeCents: 8000,
  laborWarrantyMonths: 2,
  paymentMethods: ["Zelle", "Cash", "Check"],
  sameDayService: true,
  emergencyService: "subject to availability",
  /** Owner-supplied 2026-08-16: licensed, registered, and insured. */
  credentials: "Licensed, registered & insured",
  /** Owner-supplied 2026-08-16. */
  experience: "10+ years of experience",
} as const;

/** Default business hours; per-technician schedules override these. */
export const DEFAULT_BUSINESS_HOURS = {
  // 0 = Sunday … 6 = Saturday; null = closed
  0: null,
  1: { open: "07:00", close: "19:00" },
  2: { open: "07:00", close: "19:00" },
  3: { open: "07:00", close: "19:00" },
  4: { open: "07:00", close: "19:00" },
  5: { open: "07:00", close: "19:00" },
  6: { open: "07:00", close: "19:00" },
} as const;

/**
 * Customer-facing emergency wording. The site must never imply guaranteed
 * 24/7 service.
 */
export const EMERGENCY_WORDING =
  "Emergency and same-day service may be available. Call 281-915-8264 for the fastest assistance.";
