import { pgEnum } from "drizzle-orm/pg-core";
import {
  ADDRESS_VALIDATION_STATUSES,
  APPOINTMENT_STATUSES,
  ASSIGNMENT_ROLES,
  ASSIGNMENT_STATUSES,
  AUDIT_ACTOR_TYPES,
  MEDIA_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  REQUEST_URGENCIES,
  RESERVATION_KINDS,
  ROUTE_STATUSES,
  SERVICE_REQUEST_STATUSES,
  SKILL_CATEGORIES,
  SLOT_HOLD_STATUSES,
  TIME_OFF_TYPES,
  WORK_ORDER_STATUSES,
  ZONE_ASSIGNMENT_SOURCES,
} from "@exactpoint/domain";

export const appointmentStatusEnum = pgEnum("appointment_status", APPOINTMENT_STATUSES);
export const workOrderStatusEnum = pgEnum("work_order_status", WORK_ORDER_STATUSES);
export const serviceRequestStatusEnum = pgEnum(
  "service_request_status",
  SERVICE_REQUEST_STATUSES,
);
export const requestUrgencyEnum = pgEnum("request_urgency", REQUEST_URGENCIES);
export const assignmentRoleEnum = pgEnum("assignment_role", ASSIGNMENT_ROLES);
export const assignmentStatusEnum = pgEnum("assignment_status", ASSIGNMENT_STATUSES);
export const reservationKindEnum = pgEnum("reservation_kind", RESERVATION_KINDS);
export const slotHoldStatusEnum = pgEnum("slot_hold_status", SLOT_HOLD_STATUSES);
export const timeOffTypeEnum = pgEnum("time_off_type", TIME_OFF_TYPES);
export const addressValidationStatusEnum = pgEnum(
  "address_validation_status",
  ADDRESS_VALIDATION_STATUSES,
);
export const zoneAssignmentSourceEnum = pgEnum(
  "zone_assignment_source",
  ZONE_ASSIGNMENT_SOURCES,
);
export const skillCategoryEnum = pgEnum("skill_category", SKILL_CATEGORIES);
export const mediaCategoryEnum = pgEnum("media_category", MEDIA_CATEGORIES);
export const routeStatusEnum = pgEnum("route_status", ROUTE_STATUSES);
export const notificationChannelEnum = pgEnum("notification_channel", NOTIFICATION_CHANNELS);
export const notificationStatusEnum = pgEnum("notification_status", NOTIFICATION_STATUSES);
export const auditActorTypeEnum = pgEnum("audit_actor_type", AUDIT_ACTOR_TYPES);
