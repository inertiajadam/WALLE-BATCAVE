"use client";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";

// Bundlers cannot always resolve MapLibre's module worker; serve it as a static file instead.
if (typeof window !== "undefined") maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { Corridor, RoadsFile, GbifFile } from "@/lib/corridors";
import { BASE_STYLE, GIBS_BLACK_MARBLE } from "./NationalMap";
import { SPECIES_BY_CODE } from "@/lib/species";

export interface CorridorMapProps {
  corridor: Corridor; roads: RoadsFile | null; gbif: GbifFile | null; month: number;
  /** dim fraction per road feature index (0 = full brightness) for the selected hour. */
  dimByIdx: Float32Array | null; showLights: boolean; showSightings: boolean; onHoverSegment: (idx: number | null) => void;
}

const dimColor = (d: number): [number, number, number, number] => (d <= 0 ? [255, 220, 120, 230] : d < 0.25 ? [255, 170, 60, 220] : d < 0.45 ? [200, 90, 200, 220] : [90, 60, 200, 230]);

export default function CorridorMap({ corridor, roads, gbif, month, dimByIdx, showLights, showSightings, onHoverSegment }: CorridorMapProps) {
  const el = useRef<HTMLDivElement>(null); const map = useRef<maplibregl.Map | null>(null); const overlay = useRef<MapboxOverlay | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const [w, s, e, n] = corridor.bbox;
    const m = new maplibregl.Map({ container: el.current, style: BASE_STYLE, bounds: [[w, s], [e, n]], fitBoundsOptions: { padding: 30 }, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const ov = new MapboxOverlay({ interleaved: false, layers: [] }); m.addControl(ov);
    m.on("load", () => {
      m.addSource("blackmarble", { type: "raster", tiles: [GIBS_BLACK_MARBLE], tileSize: 256, maxzoom: 8, attribution: "Night lights: NASA GIBS Black Marble" });
      m.addLayer({ id: "blackmarble", type: "raster", source: "blackmarble", paint: { "raster-opacity": 0.75 } });
    });
    map.current = m; overlay.current = ov;
    return () => { m.remove(); map.current = null; };
  }, [corridor]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => { if (m.getLayer("blackmarble")) m.setLayoutProperty("blackmarble", "visibility", showLights ? "visible" : "none"); };
    if (m.isStyleLoaded()) apply(); else m.once("load", apply);
  }, [showLights]);

  useEffect(() => {
    const ov = overlay.current; if (!ov) return;
    const layers = [];
    if (roads) {
      layers.push(new GeoJsonLayer({
        id: "roads", data: roads as never, pickable: true, lineWidthUnits: "pixels", getLineWidth: 4, lineCapRounded: true,
        getLineColor: (_f: unknown, { index }: { index: number }) => dimColor(dimByIdx ? dimByIdx[index] : 0),
        updateTriggers: { getLineColor: [dimByIdx] },
        onHover: (info: PickingInfo) => onHoverSegment(info.index >= 0 ? info.index : null),
      }));
    }
    if (gbif && showSightings) {
      const pts = gbif.points.filter((p) => p[2] === month + 1);
      layers.push(new ScatterplotLayer({
        id: "gbif", data: pts, radiusUnits: "pixels", getRadius: 3.5, getPosition: (p) => [p[0], p[1]], getFillColor: [125, 211, 252, 170], stroked: false, pickable: true,
      }));
    }
    layers.push(new ScatterplotLayer({
      id: "roosts", data: corridor.roosts, radiusUnits: "pixels", getRadius: (r) => 8 + 4 * Math.log10(Math.max(r.est, 1000) / 1000), getPosition: (r) => [r.lon, r.lat],
      getFillColor: (r) => [...SPECIES_BY_CODE[r.species].color, 220] as [number, number, number, number], stroked: true, getLineColor: [255, 255, 255, 230], lineWidthUnits: "pixels", getLineWidth: 2, pickable: true,
    }));
    layers.push(new TextLayer({ id: "roost-labels", data: corridor.roosts, getPosition: (r) => [r.lon, r.lat], getText: (r) => r.name, getSize: 12, getColor: [255, 245, 220, 255], getPixelOffset: [0, -20], background: true, getBackgroundColor: [5, 7, 13, 190], backgroundPadding: [4, 2], fontFamily: "system-ui, sans-serif" }));
    ov.setProps({
      layers,
      getTooltip: ({ object, layer }: PickingInfo) => {
        if (!object || !layer) return null;
        if (layer.id === "roosts") { const r = object as Corridor["roosts"][number]; return { html: `<b>${r.name}</b><br/>${SPECIES_BY_CODE[r.species].common}${r.est ? ` · ~${r.est.toLocaleString()} bats` : ""}<br/><span style="color:#94a3b8">${r.note}</span>`, style: { background: "rgba(12,17,32,0.95)", color: "#e6e9f2", fontSize: "12px", maxWidth: "260px", borderRadius: "8px", padding: "8px" } }; }
        if (layer.id === "gbif") { const p = object as GbifFile["points"][number]; return { text: `${gbif?.species[p[4]] ?? "bat"} · ${p[3] ?? ""}`, style: { background: "rgba(12,17,32,0.95)", color: "#e6e9f2", fontSize: "12px", borderRadius: "8px", padding: "6px 8px" } }; }
        return null;
      },
    });
  }, [roads, gbif, month, dimByIdx, showSightings, corridor, onHoverSegment]);

  return <div ref={el} className="h-full w-full" />;
}
