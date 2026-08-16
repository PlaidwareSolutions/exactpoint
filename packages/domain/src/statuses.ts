export const USER_ROLES = ["owner", "technician"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APPOINTMENT_STATUSES = [
  "requested",
  "pending_confirmation",
  "confirmed",
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
  "waiting_part",
  "follow_up_required",
  "completed",
  "customer_declined",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const WORK_ORDER_STATUSES = [
  "open",
  "scheduled",
  "waiting_part",
  "follow_up_required",
  "completed",
  "declined",
  "cancelled",
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const SERVICE_REQUEST_STATUSES = [
  "new",
  "reviewed",
  "converted",
  "declined",
  "spam",
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

export const REQUEST_URGENCIES = ["normal", "emergency"] as const;
export type RequestUrgency = (typeof REQUEST_URGENCIES)[number];

export const ASSIGNMENT_ROLES = ["lead", "helper"] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export const ASSIGNMENT_STATUSES = ["assigned", "accepted", "completed", "removed"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const RESERVATION_KINDS = ["appointment", "hold", "time_off", "block"] as const;
export type ReservationKind = (typeof RESERVATION_KINDS)[number];

export const SLOT_HOLD_STATUSES = ["active", "converted", "expired", "released"] as const;
export type SlotHoldStatus = (typeof SLOT_HOLD_STATUSES)[number];

export const TIME_OFF_TYPES = [
  "vacation",
  "sick",
  "personal",
  "training",
  "break",
  "vehicle_maintenance",
  "other",
] as const;
export type TimeOffType = (typeof TIME_OFF_TYPES)[number];

export const ADDRESS_VALIDATION_STATUSES = [
  "unvalidated",
  "validated",
  "partial",
  "failed",
  "manual",
] as const;
export type AddressValidationStatus = (typeof ADDRESS_VALIDATION_STATUSES)[number];

export const ZONE_ASSIGNMENT_SOURCES = ["auto_polygon", "auto_zip", "manual"] as const;
export type ZoneAssignmentSource = (typeof ZONE_ASSIGNMENT_SOURCES)[number];

export const SKILL_CATEGORIES = ["appliance", "hvac"] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const MEDIA_CATEGORIES = [
  "problem_photo",
  "equipment_label",
  "before",
  "after",
  "gallery",
  "profile",
  "other",
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const ROUTE_STATUSES = ["draft", "proposed", "approved"] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ["email", "sms"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ["pending", "sent", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const AUDIT_ACTOR_TYPES = ["user", "system", "customer"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];
