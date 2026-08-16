import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { customerAddresses, customers, equipment } from "./customers";
import {
  appointmentStatusEnum,
  assignmentRoleEnum,
  assignmentStatusEnum,
  mediaCategoryEnum,
  requestUrgencyEnum,
  serviceRequestStatusEnum,
  workOrderStatusEnum,
} from "./enums";
import { serviceTypes } from "./services";
import { technicianProfiles } from "./team";

/** A customer's ask for help (web booking or phone intake). */
export const serviceRequests = pgTable("service_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Customer-facing reference, e.g. EP-1048 (sequence created in migration). */
  reference: text("reference")
    .notNull()
    .unique()
    .default(sql`'EP-' || nextval('service_request_ref_seq')`),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  addressId: uuid("address_id")
    .notNull()
    .references(() => customerAddresses.id),
  serviceTypeId: uuid("service_type_id").references(() => serviceTypes.id),
  serviceOther: text("service_other"),
  problemDescription: text("problem_description").notNull(),
  equipmentBrand: text("equipment_brand"),
  equipmentModel: text("equipment_model"),
  equipmentSerial: text("equipment_serial"),
  errorCode: text("error_code"),
  urgency: requestUrgencyEnum("urgency").notNull().default("normal"),
  preferredWindows: jsonb("preferred_windows"),
  status: serviceRequestStatusEnum("status").notNull().default("new"),
  /** $80 diagnostic-fee acknowledgement is required during booking. */
  feeAcknowledged: boolean("fee_acknowledged").notNull().default(false),
  source: text("source").notNull().default("web"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** ExactPoint's actual job; may span multiple appointment visits. */
export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceRequestId: uuid("service_request_id").references(() => serviceRequests.id),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  addressId: uuid("address_id")
    .notNull()
    .references(() => customerAddresses.id),
  equipmentId: uuid("equipment_id").references(() => equipment.id),
  serviceTypeId: uuid("service_type_id").references(() => serviceTypes.id),
  status: workOrderStatusEnum("status").notNull().default("open"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One scheduled visit. Technicians attach via appointmentTechnicians. */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id),
    /** Customer-facing arrival window. */
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    status: appointmentStatusEnum("status").notNull().default("requested"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("appointments_window_start_idx").on(t.windowStart)],
);

/**
 * Multi-technician support from day one: an appointment holds one or more
 * technician assignments — never a single technician_id column.
 */
export const appointmentTechnicians = pgTable(
  "appointment_technicians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id),
    role: assignmentRoleEnum("role").notNull().default("lead"),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
    status: assignmentStatusEnum("status").notNull().default("assigned"),
    assignedBy: text("assigned_by").references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("appointment_technicians_appt_tech_uq").on(t.appointmentId, t.technicianId)],
);

export const jobStatusHistory = pgTable("job_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id")
    .notNull()
    .references(() => appointments.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by").references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workOrderNotes = pgTable("work_order_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Metadata only — binaries live in object storage (R2), private by default. */
export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectKey: text("object_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  category: mediaCategoryEnum("category").notNull().default("other"),
  uploadedBy: text("uploaded_by").references(() => users.id),
  serviceRequestId: uuid("service_request_id").references(() => serviceRequests.id),
  workOrderId: uuid("work_order_id").references(() => workOrders.id),
  equipmentId: uuid("equipment_id").references(() => equipment.id),
  technicianId: uuid("technician_id").references(() => technicianProfiles.id),
  /** Only explicitly publishable assets may appear on the public site. */
  isPublishable: boolean("is_publishable").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 2-month labor warranty on the specific repair performed. */
export const warranties = pgTable("warranties", {
  id: uuid("id").primaryKey().defaultRandom(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id),
  technicianId: uuid("technician_id").references(() => technicianProfiles.id),
  issueRepaired: text("issue_repaired").notNull(),
  componentRepaired: text("component_repaired"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
