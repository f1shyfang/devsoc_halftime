"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMapInstance, Circle, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { haversineM } from "./geo";

type LatLng = { lat: number; lng: number };

export type RoomMarker = {
  lat: number;
  lng: number;
  name: string;
  index: number;
  done: boolean;
  current: boolean;
};

type Props = {
  checkpoint: LatLng;
  player: LatLng | null;
  geofenceRadiusM: number;
  accuracyM?: number | null;
  locationName?: string | null;
  rooms?: RoomMarker[];
};

const DEFAULT_ZOOM = 17;

export function LeafletMap({
  checkpoint,
  player,
  geofenceRadiusM,
  accuracyM,
  locationName,
  rooms,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const geofenceRef = useRef<Circle | null>(null);
  const checkpointLabelRef = useRef<Marker | null>(null);
  const playerMarkerRef = useRef<Marker | null>(null);
  const accuracyRef = useRef<Circle | null>(null);
  const roomMarkersRef = useRef<Marker[]>([]);

  // Initialise the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      }).setView([checkpoint.lat, checkpoint.lng], DEFAULT_ZOOM);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 19,
        },
      ).addTo(map);

      L.control
        .attribution({ position: "bottomright", prefix: false })
        .addAttribution(
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>',
        )
        .addTo(map);

      geofenceRef.current = L.circle([checkpoint.lat, checkpoint.lng], {
        radius: geofenceRadiusM,
        color: "#ef5b3a",
        weight: 2.5,
        fillColor: "#ef5b3a",
        fillOpacity: 0.22,
        interactive: false,
      }).addTo(map);

      if (locationName) {
        const labelIcon = L.divIcon({
          className: "quest-checkpoint-label",
          html: `<span class="quest-checkpoint-label__inner">${escapeHtml(locationName)}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        checkpointLabelRef.current = L.marker([checkpoint.lat, checkpoint.lng], {
          icon: labelIcon,
          interactive: false,
          keyboard: false,
        }).addTo(map);
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      geofenceRef.current = null;
      checkpointLabelRef.current = null;
      playerMarkerRef.current = null;
      accuracyRef.current = null;
      roomMarkersRef.current.forEach((m) => m.remove());
      roomMarkersRef.current = [];
    };
    // Initialise once; later prop changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the geofence + label in sync with prop changes.
  useEffect(() => {
    if (!mapRef.current) return;
    geofenceRef.current?.setLatLng([checkpoint.lat, checkpoint.lng]);
    geofenceRef.current?.setRadius(geofenceRadiusM);
    checkpointLabelRef.current?.setLatLng([checkpoint.lat, checkpoint.lng]);
  }, [checkpoint.lat, checkpoint.lng, geofenceRadiusM]);

  // Plot all room puzzles as numbered pins (current highlighted, done dimmed).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      roomMarkersRef.current.forEach((m) => m.remove());
      roomMarkersRef.current = [];

      for (const r of rooms ?? []) {
        const variant = r.current
          ? " quest-room-pin--current"
          : r.done
            ? " quest-room-pin--done"
            : "";
        const icon = L.divIcon({
          className: `quest-room-pin${variant}`,
          html: `<span class="quest-room-pin__inner">${r.index}</span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker([r.lat, r.lng], {
          icon,
          interactive: false,
          keyboard: false,
        }).addTo(map);
        roomMarkersRef.current.push(marker);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rooms]);

  // Player marker, accuracy ring, and framing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    (async () => {
      const L = await import("leaflet");

      if (player) {
        if (!playerMarkerRef.current) {
          const playerIcon = L.divIcon({
            className: "quest-player-dot",
            html: '<span class="quest-player-dot__inner"></span>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          playerMarkerRef.current = L.marker([player.lat, player.lng], {
            icon: playerIcon,
            interactive: false,
          }).addTo(map);
        } else {
          playerMarkerRef.current.setLatLng([player.lat, player.lng]);
        }

        if (accuracyM != null && accuracyM > 0) {
          if (!accuracyRef.current) {
            accuracyRef.current = L.circle([player.lat, player.lng], {
              radius: accuracyM,
              color: "#1a1a22",
              weight: 1,
              opacity: 0.2,
              fillColor: "#1a1a22",
              fillOpacity: 0.05,
              interactive: false,
            }).addTo(map);
          } else {
            accuracyRef.current.setLatLng([player.lat, player.lng]);
            accuracyRef.current.setRadius(accuracyM);
          }
        }

        // Only fit both points when the player is close enough that the
        // geofence will still be readable. Otherwise focus on the checkpoint
        // area — the distance number below the map handles "where am I".
        const distanceM = haversineM(
          checkpoint.lat,
          checkpoint.lng,
          player.lat,
          player.lng,
        );
        const closeThreshold = Math.max(geofenceRadiusM * 6, 120);
        if (distanceM <= closeThreshold) {
          const bounds = L.latLngBounds(
            [checkpoint.lat, checkpoint.lng],
            [player.lat, player.lng],
          );
          map.fitBounds(bounds, { padding: [36, 36], maxZoom: 18 });
        } else {
          map.setView([checkpoint.lat, checkpoint.lng], DEFAULT_ZOOM);
        }
      } else {
        map.setView([checkpoint.lat, checkpoint.lng], DEFAULT_ZOOM);
      }
    })();
  }, [player, accuracyM, checkpoint.lat, checkpoint.lng, geofenceRadiusM]);

  return (
    <div
      ref={containerRef}
      className="quest-leaflet"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 14,
        overflow: "hidden",
        background: "#f3eee0",
      }}
    />
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
