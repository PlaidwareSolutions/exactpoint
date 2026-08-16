import { generateCandidates, ymdInTimeZone, zonedTimeToUtc } from "@exactpoint/scheduling";
import { BUSINESS } from "@exactpoint/domain";
import type { GeoPoint } from "@exactpoint/scheduling";
import {
  engineOptionsFromConfig,
  loadSchedulingConfig,
  loadTeamContext,
  requiredSkillForServiceType,
} from "@/lib/scheduling-server";
import { issueSlotToken } from "./slot-token";
import { offeredWindows, type BookableWindow } from "./windows";

export type { BookableWindow };

/**
 * Engine-backed public windows (spec §11): each customer-facing 3-hour
 * window is offered only when a qualified technician can actually take it,
 * and carries an opaque signed slot for the best-scoring candidate. Falls
 * back to preference-only windows when the team has no capacity, so a
 * customer is never dead-ended (the request then joins the unassigned queue).
 */
export async function bookableWindows(input: {
  serviceTypeSlug: string;
  zoneId?: string | null;
  location?: GeoPoint | null;
  urgency: "normal" | "emergency";
}): Promise<{ windows: BookableWindow[]; engineBacked: boolean }> {
  const generic = offeredWindows();
  try {
    const config = await loadSchedulingConfig();
    const options = await engineOptionsFromConfig(config);
    const { skillSlug, durationMinutes } = await requiredSkillForServiceType(
      input.serviceTypeSlug,
    );
    const team = await loadTeamContext({ days: config.bookingHorizonDays });
    const candidates = generateCandidates(
      {
        durationMinutes,
        requiredSkillSlug: skillSlug,
        zoneId: input.zoneId ?? null,
        location: input.location ?? null,
        urgency: input.urgency,
      },
      team,
      { ...options, maxCandidatesPerTechnician: 48 },
    );

    if (candidates.length === 0) {
      return { windows: generic, engineBacked: false };
    }

    const backed: BookableWindow[] = [];
    for (const window of generic) {
      const windowStart = zonedTimeToUtc(window.date, window.start, BUSINESS.timezone);
      const windowEnd = zonedTimeToUtc(window.date, window.end, BUSINESS.timezone);
      const best = candidates.find(
        (c) => c.window.start >= windowStart && c.window.end <= windowEnd,
      );
      if (!best) continue;
      backed.push({
        ...window,
        slotToken: issueSlotToken({
          technicianId: best.technicianId,
          start: best.window.start.toISOString(),
          end: best.window.end.toISOString(),
        }),
        scheduledStartIso: best.window.start.toISOString(),
        scheduledEndIso: best.window.end.toISOString(),
      });
      if (backed.length >= 12) break;
    }
    return backed.length > 0
      ? { windows: backed, engineBacked: true }
      : { windows: generic, engineBacked: false };
  } catch (err) {
    console.error("[booking] engine windows failed; using generic windows", err);
    return { windows: generic, engineBacked: false };
  }
}

export function ymdToday(): string {
  return ymdInTimeZone(new Date(), BUSINESS.timezone);
}
