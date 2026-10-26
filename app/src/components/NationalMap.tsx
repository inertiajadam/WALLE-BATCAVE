"use client";
import { useEffect, useMemo, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GridCellLayer, GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { Grid } from "@/lib/grid";
import type { NationalField } from "@/lib/national";
import { ACTIVITY, LIGHT, PRIORITY, TRAFFIC, ramp } from "@/lib/colors";
import { CORRIDORS } from "@/lib/corridors";

export type MapMode = "activity" | "priority" | "light" | "traffic";
export interface Layers { cells: boolean; roads: boolean; blackMarble: boolean; corridors: boolean }

export const BASE_STYLE = "https://tiles.openfreemap.org/styles/dark";
export const GIBS_BLACK_MARBLE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png";

export interface NationalMapProps {
  grid: Grid | null; field: NationalField | null; mode: MapMode; layers: Layers; nightFactor: number;
  onHover: (i: number | null) => void; onClickCorridor: (id: string) => void; flyTo?: { lon: number; lat: number; zoom?: number } | null;
}

export default function NationalMap({ grid, field, mode, layers, nightFactor, onHover, onClickCorridor, flyTo }: NationalMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const overlay = useRef<MapboxOverlay | null>(null);
  const roads = useRef<unknown>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({ container: el.current, style: BASE_STYLE, center: [-96.5, 38.5], zoom: 3.6, minZoom: 2.5, maxZoom: 11, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const ov = new MapboxOverlay({ interleaved: false, layers: [] });
    m.addControl(ov);
    m.on("load", () => {
      m.addSource("blackmarble", { type: "raster", tiles: [GIBS_BLACK_MARBLE], tileSize: 256, maxzoom: 8, attribution: "Night lights: NASA GIBS Black Marble 2016" });
      m.addLayer({ id: "blackmarble", type: "raster", source: "blackmarble", paint: { "raster-opacity": 0.9 }, layout: { visibility: "none" } });
    });
    map.current = m; overlay.current = ov;
    fetch("/data/interstates.geojson").then((r) => r.json()).then((j) => { roads.current = j; });
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => { if (m.getLayer("blackmarble")) m.setLayoutProperty("blackmarble", "visibility", layers.blackMarble ? "visible" : "none"); };
    if (m.isStyleLoaded()) apply(); else m.once("load", apply);
  }, [layers.blackMarble]);

  useEffect(() => {
    if (flyTo && map.current) map.current.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: flyTo.zoom ?? 7, duration: 1400 });
  }, [flyTo]);

  const indices = useMemo(() => (grid ? Array.from({ length: grid.n }, (_, i) => i) : []), [grid]);

  useEffect(() => {
    const ov = overlay.current; if (!ov) return;
    const deckLayers = [];
    if (grid && field && layers.cells) {
      const maxAadt = 150000;
      deckLayers.push(new GridCellLayer<number>({
        id: "cells-" + mode, data: indices, cellSize: 10000, extruded: false, pickable: true,
        getPosition: (i) => [grid.lon[i] - 0.05 / Math.cos((grid.lat[i] * Math.PI) / 180), grid.lat[i] - 0.045],
        getFillColor: (i) => {
          if (mode === "activity") { const v = field.baseline[i] * nightFactor; return v < 0.02 ? [0, 0, 0, 0] : ramp(ACTIVITY, v); }
          if (mode === "light") return ramp(LIGHT, field.light[i]);
          if (mode === "traffic") return grid.aadt[i] > 0 ? ramp(TRAFFIC, Math.min(1, grid.aadt[i] / maxAadt)) : [0, 0, 0, 0];
          const p = field.priority[i] * nightFactor; return p <= 0 ? [0, 0, 0, 0] : ramp(PRIORITY, Math.min(1, p / 0.6));
        },
        updateTriggers: { getFillColor: [mode, field, nightFactor] },
        onHover: (info: PickingInfo<number>) => onHover(info.index >= 0 ? info.index : null),
        opacity: 0.85,
      }));
    }
    if (layers.roads && roads.current) {
      deckLayers.push(new GeoJsonLayer({
        id: "interstates", data: roads.current as never, lineWidthUnits: "pixels", getLineWidth: (f: { properties: { aadt?: number } }) => (f.properties.aadt ? 1 + Math.min(3, f.properties.aadt / 50000) : 1),
        getLineColor: (f: { properties: { aadt?: number } }) => (f.properties.aadt ? [120, 230, 255, 200] : [120, 150, 190, 110]), pickable: false,
      }));
    }
    if (layers.corridors) {
      deckLayers.push(new ScatterplotLayer({
        id: "corridor-pins", data: CORRIDORS, pickable: true, radiusUnits: "pixels", getRadius: 9, getPosition: (c) => [(c.bbox[0] + c.bbox[2]) / 2, (c.bbox[1] + c.bbox[3]) / 2],
        getFillColor: [245, 179, 66, 230], getLineColor: [255, 255, 255, 220], lineWidthUnits: "pixels", getLineWidth: 2, stroked: true,
        onClick: (info: PickingInfo<{ id: string }>) => { if (info.object) onClickCorridor(info.object.id); },
      }));
      deckLayers.push(new TextLayer({
        id: "corridor-labels", data: CORRIDORS, getPosition: (c) => [(c.bbox[0] + c.bbox[2]) / 2, (c.bbox[1] + c.bbox[3]) / 2], getText: (c) => c.name.split(":")[0],
        getSize: 13, getColor: [255, 240, 200, 255], getPixelOffset: [0, -18], fontFamily: "system-ui, sans-serif", fontWeight: 600, background: true, getBackgroundColor: [5, 7, 13, 180], backgroundPadding: [4, 2],
      }));
    }
    ov.setProps({ layers: deckLayers, getCursor: ({ isHovering }) => (isHovering ? "pointer" : "grab") });
  }, [grid, field, mode, layers, nightFactor, indices, onHover, onClickCorridor]);

  return <div ref={el} className="h-full w-full" />;
}
