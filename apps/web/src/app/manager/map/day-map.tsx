"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HOUSTON_CENTER, loadGoogleMaps } from "@/components/maps/loader";

interface MapStop {
  appointmentId: string;
  technicianId: string;
  lat: number;
  lng: number;
  startIso: string;
  label: string;
  sub: string;
}

export function DayMap({
  stops,
  technicians,
}: {
  stops: MapStop[];
  technicians: { id: string; name: string; color: string }[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !container.current) return;
        const map = new g.maps.Map(container.current, {
          center: HOUSTON_CENTER,
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const bounds = new g.maps.LatLngBounds();
        const info = new g.maps.InfoWindow();

        for (const tech of technicians) {
          const mine = stops
            .filter((s) => s.technicianId === tech.id)
            .sort((a, b) => a.startIso.localeCompare(b.startIso));
          if (mine.length === 0) continue;

          mine.forEach((stop, i) => {
            const position = { lat: stop.lat, lng: stop.lng };
            bounds.extend(position);
            const marker = new g.maps.Marker({
              map,
              position,
              label: { text: String(i + 1), color: "#ffffff", fontWeight: "700" },
              title: `${tech.name}: ${stop.label}`,
              icon: {
                path: g.maps.SymbolPath.CIRCLE,
                scale: 13,
                fillColor: tech.color,
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            });
            marker.addListener("click", () => {
              info.setContent(
                `<div style="font: 13px system-ui; max-width: 220px">
                   <strong>${stop.label}</strong><br/>${stop.sub}<br/>
                   <span style="color:${tech.color}; font-weight:700">${tech.name}</span> · stop ${i + 1}<br/>
                   <a href="/manager/jobs/${stop.appointmentId}" style="color:#f26a21; font-weight:700">Open job →</a>
                 </div>`,
              );
              info.open({ map, anchor: marker });
            });
            marker.addListener("dblclick", () =>
              router.push(`/manager/jobs/${stop.appointmentId}`),
            );
          });

          if (mine.length > 1) {
            new g.maps.Polyline({
              map,
              path: mine.map((s) => ({ lat: s.lat, lng: s.lng })),
              strokeColor: tech.color,
              strokeOpacity: 0.75,
              strokeWeight: 3,
            });
          }
        }
        if (!bounds.isEmpty()) map.fitBounds(bounds, 60);
        setState("ready");
      })
      .catch(() => setState("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [stops, technicians, router]);

  if (state === "unavailable") {
    return (
      <p className="rounded-xl border border-line bg-white p-6 text-sm text-slate">
        The map couldn&apos;t load — check that the Maps browser key is
        configured and this site&apos;s URL is in its referrer allowlist.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-2">
      <div ref={container} className="h-[32rem] w-full rounded-lg" />
      <div className="flex flex-wrap gap-3 px-2 py-2 text-xs font-semibold text-slate">
        {technicians.map((t) => (
          <span key={t.id} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: t.color }} />
            {t.name}
          </span>
        ))}
        {stops.length === 0 && <span>No located jobs on this day.</span>}
      </div>
    </div>
  );
}
