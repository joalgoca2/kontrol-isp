"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPoint } from "@/actions/network-map";

export interface FocusTarget {
  lat: number;
  lng: number;
  ts: number;
}

interface OsmMapViewProps {
  points: MapPoint[];
  selectedPoint: MapPoint | null;
  onSelectPoint: (point: MapPoint | null) => void;
  center?: { lat: number; lng: number };
  focusTarget?: FocusTarget | null;
}

interface LeafletMarker {
  addTo: (map: unknown) => LeafletMarker;
  on: (event: string, handler: () => void) => LeafletMarker;
  remove: () => void;
}

interface LeafletMarkerClusterGroup {
  addLayer: (layer: unknown) => void;
  addLayers: (layers: unknown[]) => void;
  clearLayers: () => void;
  addTo: (map: unknown) => LeafletMarkerClusterGroup;
  remove: () => void;
}

interface LeafletMapInstance {
  setView: (center: [number, number], zoom: number) => LeafletMapInstance;
  panTo: (center: [number, number]) => LeafletMapInstance;
  flyTo: (
    center: [number, number],
    zoom: number,
    options?: unknown
  ) => LeafletMapInstance;
  setZoom: (zoom: number) => LeafletMapInstance;
  invalidateSize: () => void;
  getSize: () => { x: number; y: number };
  whenReady: (fn: () => void) => LeafletMapInstance;
  remove: () => void;
  removeLayer: (layer: unknown) => LeafletMapInstance;
}

interface LeafletNamespace {
  map: (element: HTMLElement | string, options?: unknown) => LeafletMapInstance;
  tileLayer: (
    url: string,
    options?: unknown
  ) => { addTo: (map: unknown) => void };
  marker: (
    latlng: [number, number],
    options?: unknown
  ) => LeafletMarker;
  divIcon: (options?: unknown) => unknown;
  markerClusterGroup?: (options?: unknown) => LeafletMarkerClusterGroup;
}

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

export function OsmMapView({
  points,
  selectedPoint,
  onSelectPoint,
  center = { lat: 4.5826, lng: -74.2117 },
  focusTarget = null,
}: OsmMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const clusterGroupRef = useRef<LeafletMarkerClusterGroup | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isClusterReady, setIsClusterReady] = useState<boolean>(false);

  // 1. Load Leaflet + MarkerCluster Scripts and Stylesheets
  useEffect(() => {
    let isMounted = true;

    // A. Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // B. MarkerCluster Base CSS
    if (!document.getElementById("markercluster-css")) {
      const link = document.createElement("link");
      link.id = "markercluster-css";
      link.rel = "stylesheet";
      link.href =
        "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
      document.head.appendChild(link);
    }

    // C. MarkerCluster Default Theme CSS
    if (!document.getElementById("markercluster-default-css")) {
      const link = document.createElement("link");
      link.id = "markercluster-default-css";
      link.rel = "stylesheet";
      link.href =
        "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
      document.head.appendChild(link);
    }

    function initClusterScript() {
      if (
        !window.L?.markerClusterGroup &&
        !document.getElementById("markercluster-js")
      ) {
        const clusterScript = document.createElement("script");
        clusterScript.id = "markercluster-js";
        clusterScript.src =
          "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
        clusterScript.async = true;
        clusterScript.onload = () => {
          if (isMounted) setIsClusterReady(true);
        };
        document.head.appendChild(clusterScript);
      } else {
        setIsClusterReady(true);
      }
    }

    function setupMap() {
      const L = window.L;
      if (!containerRef.current || !L || !isMounted || mapRef.current) return;

      const instance = L.map(containerRef.current).setView(
        [center.lat, center.lng],
        13
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(instance);

      mapRef.current = instance;

      instance.whenReady(() => {
        if (!isMounted) return;
        instance.invalidateSize();
        setIsReady(true);
      });

      initClusterScript();
    }

    if (!window.L) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        setupMap();
      };
      document.head.appendChild(script);
    } else {
      setupMap();
    }

    return () => {
      isMounted = false;
      if (clusterGroupRef.current) {
        clusterGroupRef.current.clearLayers();
        if (mapRef.current) {
          mapRef.current.removeLayer(clusterGroupRef.current);
        }
        clusterGroupRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setIsReady(false);
      setIsClusterReady(false);
    };
  }, [center.lat, center.lng]);

  // 2. Render Markers inside MarkerClusterGroup with L.marker and L.divIcon
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !isReady || !isClusterReady || !L.markerClusterGroup) {
      return;
    }

    // Re-use existing cluster group to avoid orphaned event listeners
    let clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) {
      clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 35,
        disableClusteringAtZoom: 17,
      });
      clusterGroup.addTo(map);
      clusterGroupRef.current = clusterGroup;
    } else {
      clusterGroup.clearLayers();
    }

    const markers: LeafletMarker[] = [];

    points.forEach((point) => {
      if (
        typeof point.latitude !== "number" ||
        typeof point.longitude !== "number" ||
        isNaN(point.latitude) ||
        isNaN(point.longitude)
      ) {
        return;
      }

      const isOnline = point.serviceStatus === "ONLINE";
      const isSuspended = point.billingStatus === "SUSPENDIDO_MORA";

      let fillColor = "#10b981"; // Online (emerald green)
      if (isSuspended) {
        fillColor = "#f59e0b"; // Suspended (amber)
      } else if (!isOnline) {
        fillColor = "#f43f5e"; // Offline (rose red)
      }

      const isSelected = selectedPoint?.id === point.id;
      const size = isSelected ? 18 : 13;
      const anchor = isSelected ? 9 : 6.5;

      const dotIcon = L.divIcon({
        className: "network-map-dot-icon",
        html:
          `<div style="` +
          `width: ${size}px; height: ${size}px; border-radius: 50%; ` +
          `background-color: ${fillColor}; border: 2px solid #ffffff; ` +
          `box-shadow: 0 1px 4px rgba(0,0,0,0.45); ` +
          `cursor: pointer; transition: transform 0.15s ease;" ` +
          `title="${point.pppoeUser}"></div>`,
        iconSize: [size, size],
        iconAnchor: [anchor, anchor],
      });

      const marker = L.marker([point.latitude, point.longitude], {
        icon: dotIcon,
      });

      // Smooth selection on click
      marker.on("click", () => {
        onSelectPoint(point);
      });

      markers.push(marker);
    });

    if (markers.length > 0) {
      clusterGroup.addLayers(markers);
    }
  }, [points, isReady, isClusterReady, selectedPoint, onSelectPoint]);

  // 3. Smooth flyTo focus only on explicit user request with strict coordinate validation
  useEffect(() => {
    if (
      focusTarget &&
      mapRef.current &&
      isReady &&
      typeof focusTarget.lat === "number" &&
      typeof focusTarget.lng === "number" &&
      !isNaN(focusTarget.lat) &&
      !isNaN(focusTarget.lng)
    ) {
      mapRef.current.flyTo([focusTarget.lat, focusTarget.lng], 17, {
        duration: 1.2,
      });
    }
  }, [focusTarget, isReady]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[550px] rounded-2xl overflow-hidden z-0"
    />
  );
}
