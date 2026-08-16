import { generateCandidates } from "@exactpoint/scheduling";
import type { ScoreComponent } from "@exactpoint/scheduling";
import { BUSINESS } from "@exactpoint/domain";
import {
  engineOptionsFromConfig,
  loadSchedulingConfig,
  loadTeamContext,
  requiredSkillForServiceType,
} from "@/lib/scheduling-server";
import { serviceRequestDetail } from "./queries";

export interface Recommendation {
  technicianId: string;
  technicianName: string;
  color: string | null;
  startIso: string;
  endIso: string;
  label: string;
  totalScore: number;
  reasons: ScoreComponent[];
}

function friendly(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone,
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${fmt.format(start)} – ${endFmt.format(end)}`;
}

/**
 * Ranked, explainable recommendations for a service request (spec §14, §22).
 * Every recommendation carries its score breakdown so the owner can see why.
 */
export async function recommendationsForRequest(
  requestId: string,
  limit = 6,
): Promise<{ recommendations: Recommendation[]; serviceDuration: number } | null> {
  const detail = await serviceRequestDetail(requestId);
  if (!detail || !detail.address) return null;

  const config = await loadSchedulingConfig();
  const options = await engineOptionsFromConfig(config);
  const slug = detail.serviceType?.slug ?? "other";
  const { skillSlug, durationMinutes } = await requiredSkillForServiceType(slug);
  const team = await loadTeamContext({
    days: config.bookingHorizonDays,
    customerId: detail.request.customerId,
  });
  const byId = new Map(team.map((t) => [t.id, t]));

  const candidates = generateCandidates(
    {
      durationMinutes,
      requiredSkillSlug: skillSlug,
      zoneId: detail.address.zoneId,
      location:
        detail.address.latitude != null && detail.address.longitude != null
          ? { latitude: detail.address.latitude, longitude: detail.address.longitude }
          : null,
      urgency: detail.request.urgency,
      preferredWindows: undefined,
    },
    team,
    { ...options, maxCandidatesPerTechnician: 12 },
  );

  // Best candidate per technician+day so the list shows variety, not one
  // technician's every half-hour.
  const seen = new Set<string>();
  const recommendations: Recommendation[] = [];
  for (const c of candidates) {
    const key = `${c.technicianId}:${c.window.start.toISOString().slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tech = byId.get(c.technicianId);
    recommendations.push({
      technicianId: c.technicianId,
      technicianName: tech ? `${tech.firstName} ${tech.lastName}`.trim() : "Technician",
      color: tech?.color ?? null,
      startIso: c.window.start.toISOString(),
      endIso: c.window.end.toISOString(),
      label: friendly(c.window.start, c.window.end),
      totalScore: c.totalScore,
      reasons: c.scoreBreakdown,
    });
    if (recommendations.length >= limit) break;
  }
  return { recommendations, serviceDuration: durationMinutes };
}
