import { z } from "zod";

export const addressInputSchema = z.object({
  street: z.string().trim().min(4, "Enter your street address").max(120),
  unit: z.string().trim().max(30).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter your city").max(60),
  state: z.string().trim().length(2, "Two-letter state").default("TX"),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),
});

export const preferredWindowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().max(80),
});

export const bookingSchema = z.object({
  serviceTypeSlug: z.string().trim().min(1, "Choose a service").max(60),
  serviceOther: z.string().trim().max(120).optional().or(z.literal("")),
  problemDescription: z
    .string()
    .trim()
    .min(10, "Tell us a bit more about the problem (at least 10 characters)")
    .max(2000),
  equipmentBrand: z.string().trim().max(60).optional().or(z.literal("")),
  equipmentModel: z.string().trim().max(60).optional().or(z.literal("")),
  equipmentSerial: z.string().trim().max(60).optional().or(z.literal("")),
  errorCode: z.string().trim().max(40).optional().or(z.literal("")),
  urgency: z.enum(["normal", "emergency"]).default("normal"),
  firstName: z.string().trim().min(1, "Enter your first name").max(60),
  lastName: z.string().trim().min(1, "Enter your last name").max(60),
  phone: z
    .string()
    .trim()
    .regex(/^[\d\s().+-]{10,20}$/, "Enter a valid phone number"),
  email: z.email("Enter a valid email").max(120),
  address: addressInputSchema,
  addressConfirmedDespiteWarning: z.boolean().default(false),
  preferredWindows: z
    .array(preferredWindowSchema)
    .min(1, "Pick at least one appointment window")
    .max(3),
  feeAcknowledged: z.literal(true, {
    error: "Please acknowledge the diagnostic-fee policy",
  }),
  /** Present when the customer picked an engine-backed slot. */
  slotToken: z.string().max(2048).optional(),
  holdId: z.uuid().optional(),
  photoAssetIds: z.array(z.uuid()).max(6).default([]),
  /** Honeypot — humans never fill this. */
  company: z.string().max(0).optional().or(z.literal("")),
});

export type BookingInput = z.infer<typeof bookingSchema>;
