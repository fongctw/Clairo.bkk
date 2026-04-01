"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useState } from "react";
import { GeoJSON, LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

import type { AnalysisResponse } from "@/lib/types";

const sourceIcon = new L.DivIcon({
  className: "custom-source-icon",
  html: '<div style="background:#bf5b04;border:2px solid white;width:14px;height:14px;border-radius:999px;"></div>',
  iconSize: [14, 14]
});

const stationIcon = new L.DivIcon({
  className: "custom-station-icon",
  html: '<div style="background:#4d8bb7;border:2px solid white;width:14px;height:14px;border-radius:999px;"></div>',
  iconSize: [14, 14]
});

type MapViewProps = {
  result: AnalysisResponse;
  visibleLayers: Record<string, boolean>;
};

const BANGKOK_NEARBY_BOUNDS = L.latLngBounds(
  [13.52, 100.30],
  [14.02, 100.82]
);

function StudyAreaFocus({ data }: { data: GeoJSON.FeatureCollection }) {
  const map = useMap();

  useEffect(() => {
    const layer = L.geoJSON(data as GeoJSON.GeoJsonObject);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.04));
      map.setMaxBounds(BANGKOK_NEARBY_BOUNDS);
    }
  }, [data, map]);

  return null;
}

function suitabilityStyle(score: number) {
  if (score >= 80) return { fillColor: "#1b5e20", color: "#1b5e20", weight: 1, fillOpacity: 0.55 };
  if (score >= 60) return { fillColor: "#4caf50", color: "#4caf50", weight: 1, fillOpacity: 0.45 };
  if (score >= 40) return { fillColor: "#c0ca33", color: "#c0ca33", weight: 1, fillOpacity: 0.4 };
  if (score >= 20) return { fillColor: "#ffb300", color: "#ffb300", weight: 1, fillOpacity: 0.35 };
  return { fillColor: "#d84315", color: "#d84315", weight: 1, fillOpacity: 0.35 };
}

export function MapView({ result, visibleLayers }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  if (!isMounted) {
    return <div className="h-full min-h-[620px] rounded-3xl bg-mist" />;
  }

  return (
    <MapContainer
      key={`${result.studyArea}-${result.suitabilityMapMetadata.gridCellCount}`}
      center={[13.7563, 100.5018]}
      zoom={11}
      minZoom={10}
      maxZoom={14}
      scrollWheelZoom
      maxBounds={BANGKOK_NEARBY_BOUNDS}
      maxBoundsViscosity={1}
      worldCopyJump={false}
      className="h-full min-h-[420px] rounded-3xl md:min-h-[560px] xl:min-h-[680px]"
    >
      <StudyAreaFocus data={result.layers.studyArea} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        noWrap
      />

      <GeoJSON
        data={result.layers.studyArea}
        style={{ color: "#1f4f39", fillColor: "#dcedc8", weight: 2, fillOpacity: 0.08 }}
        onEachFeature={(feature, layer) => {
          layer.bindPopup(`<strong>${String(feature.properties?.name ?? "Study area")}</strong><br/>Bangkok and nearby provinces focus area`);
        }}
      />

      <LayersControl position="topright">
        {visibleLayers.greenSpaces && (
          <LayersControl.Overlay checked name="Green spaces">
            <GeoJSON
              data={result.layers.greenSpaces}
              style={{ color: "#2e7d32", fillColor: "#81c784", weight: 1, fillOpacity: 0.5 }}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(
                  `<strong>${String(feature.properties?.name ?? "Green place")}</strong><br/>Type: ${String(feature.properties?.type ?? "green space")}`
                );
              }}
            />
          </LayersControl.Overlay>
        )}

        {visibleLayers.suitability && (
          <LayersControl.Overlay checked name="Suitability">
            <GeoJSON
              data={result.layers.suitabilityGrid}
              style={(feature) => suitabilityStyle(Number(feature?.properties?.totalScore ?? 0))}
              onEachFeature={(feature, layer) => {
                const props = feature.properties ?? {};
                layer.bindPopup(
                  `<strong>${props.cell_id}</strong><br/>Greenness: ${Number(props.greennessScore).toFixed(1)}<br/>Pollution: ${Number(props.pollutionScore).toFixed(1)}<br/>Distance: ${Number(props.distanceScore).toFixed(1)}<br/>Total: ${Number(props.totalScore).toFixed(1)}`
                );
              }}
            />
          </LayersControl.Overlay>
        )}

        {visibleLayers.pm25 &&
          result.layers.pm25Stations.features.map((feature, index) => {
            const coords = (feature.geometry as GeoJSON.Point).coordinates;
            return (
              <Marker key={`station-${index}`} position={[coords[1], coords[0]]} icon={stationIcon}>
                <Popup>
                  <strong>{String(feature.properties?.name ?? "Station")}</strong>
                  <div>PM2.5: {String(feature.properties?.pm25 ?? "n/a")}</div>
                </Popup>
              </Marker>
            );
          })}

        {visibleLayers.pollutionSources &&
          result.layers.pollutionSources.features.map((feature, index) => {
            const coords = (feature.geometry as GeoJSON.Point).coordinates;
            return (
              <Marker key={`source-${index}`} position={[coords[1], coords[0]]} icon={sourceIcon}>
                <Popup>
                  <strong>{String(feature.properties?.name ?? "Source")}</strong>
                  <div>Category: {String(feature.properties?.category ?? "unknown")}</div>
                </Popup>
              </Marker>
            );
          })}
      </LayersControl>
    </MapContainer>
  );
}
