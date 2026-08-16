"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeZonePolygon, saveZonePolygon } from "@/lib/manager/settings-actions";
import { HOUSTON_CENTER, loadGoogleMaps } from "@/components/maps/loader";

interface ZoneOption {
  id: string;
  name: string;
  color: string;
}

interface StoredPolygon {
  id: string;
  zoneId: string;
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
}

export function ZoneBoundaryEditor({
  zones,
  polygons,
}: {
  zones: ZoneOption[];
  polygons: StoredPolygon[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [activeZone, setActiveZone] = useState(zones[0]?.id ?? "");
  const activeZoneRef = useRef(activeZone);
  activeZoneRef.current = activeZone;
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !container.current) return;
        const map = new g.maps.Map(container.current, {
          center: HOUSTON_CENTER,
          zoom: 9,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const zoneById = new Map(zones.map((z) => [z.id, z]));

        // Render stored polygons; click = delete (with confirm).
        for (const stored of polygons) {
          const zone = zoneById.get(stored.zoneId);
          const ringsList =
            stored.geometry.type === "MultiPolygon"
              ? (stored.geometry.coordinates as number[][][][])
              : [stored.geometry.coordinates as number[][][]];
          for (const rings of ringsList) {
            const shape = new g.maps.Polygon({
              map,
              paths: rings.map((ring) => ring.map(([lng, lat]) => ({ lat: lat!, lng: lng! }))),
              fillColor: zone?.color ?? "#888888",
              fillOpacity: 0.18,
              strokeColor: zone?.color ?? "#888888",
              strokeWeight: 2,
            });
            shape.addListener("click", async () => {
              if (!confirm(`Delete this ${zone?.name ?? "zone"} boundary?`)) return;
              const result = await removeZonePolygon(stored.id);
              if (result.ok) {
                shape.setMap(null);
                router.refresh();
              } else {
                setMessage(result.error);
              }
            });
          }
        }

        // Runtime accepts options; current type defs declare a bare constructor.
        const DrawingManagerCtor = g.maps.drawing.DrawingManager as unknown as new (
          opts: Record<string, unknown>,
        ) => google.maps.drawing.DrawingManager;
        const drawing = new DrawingManagerCtor({
          map,
          drawingMode: g.maps.drawing.OverlayType.POLYGON,
          drawingControl: true,
          drawingControlOptions: {
            position: g.maps.ControlPosition.TOP_CENTER,
            drawingModes: [g.maps.drawing.OverlayType.POLYGON],
          },
          polygonOptions: { fillOpacity: 0.25, strokeWeight: 2 },
        });

        drawing.addListener("polygoncomplete", async (poly: google.maps.Polygon) => {
          const path = poly
            .getPath()
            .getArray()
            .map((p) => [p.lng(), p.lat()] as [number, number]);
          if (path.length >= 3) {
            path.push(path[0]!); // close the ring
            setMessage("Saving boundary…");
            const result = await saveZonePolygon(activeZoneRef.current, [path]);
            setMessage(result.ok ? "Boundary saved." : result.error);
            if (result.ok) router.refresh();
          }
          poly.setMap(null); // stored version re-renders on refresh
        });

        setState("ready");
      })
      .catch(() => setState("unavailable"));
    return () => {
      cancelled = true;
    };
  }, []); // map initializes once per page load; data arrives via router.refresh

  if (state === "unavailable") {
    return (
      <p className="rounded-xl border border-line bg-white p-6 text-sm text-slate">
        The map couldn&apos;t load — check the Maps browser key configuration.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-navy">
          Drawing for zone:
          <select
            value={activeZone}
            onChange={(e) => setActiveZone(e.target.value)}
            className="ml-2 rounded-lg border border-line px-3 py-1.5"
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
        {message && <span className="text-sm font-semibold text-point">{message}</span>}
      </div>
      <div ref={container} className="h-[34rem] w-full rounded-lg" />
    </div>
  );
}
