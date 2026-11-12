"use client";

import { useEffect, useRef } from "react";
import type { MapPoint } from "@/actions/network-map";

interface GoogleMapViewProps {
  apiKey: string;
  points: MapPoint[];
  selectedPoint: MapPoint | null;
  onSelectPoint: (point: MapPoint | null) => void;
  center?: { lat: number; lng: number };
}

interface GoogleMapsMarker {
  setMap: (map: unknown) => void;
  addListener: (event: string, handler: () => void) => void;
}

interface GoogleMapInstance {
  panTo: (latLng: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
}

interface GoogleMapsNamespace {
  Map: new (element: HTMLElement, options: unknown) => GoogleMapInstance;
  Marker: new (options: unknown) => GoogleMapsMarker;
  SymbolPath: {
    CIRCLE: unknown;
  };
}

declare global {
  interface Window {
    google?: {
      maps?: GoogleMapsNamespace;
    };
    initGoogleMapCallback?: () => void;
  }
}

export function GoogleMapView({
  apiKey,
  points,
  selectedPoint,
  onSelectPoint,
  center = { lat: 4.5826, lng: -74.2117 },
}: GoogleMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMapsMarker[]>([]);

  useEffect(() => {
    let isMounted = true;

    function renderMap() {
      const gMaps = window.google?.maps;
      if (!mapContainerRef.current || !gMaps || !isMounted) {
        return;
      }

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new gMaps.Map(
          mapContainerRef.current,
          {
            center,
            zoom: 13,
            mapTypeId: "roadmap",
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }],
              },
            ],
          }
        );
      }

      // Clear existing markers
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      // Add markers with strict coordinate validation
      points.forEach((point) => {
        if (
          !point ||
          typeof point.latitude !== "number" ||
          typeof point.longitude !== "number" ||
          !Number.isFinite(point.latitude) ||
          !Number.isFinite(point.longitude) ||
          point.latitude < -90 ||
          point.latitude > 90 ||
          point.longitude < -180 ||
          point.longitude > 180
        ) {
          return;
        }

        const isOnline = point.serviceStatus === "ONLINE";
        const isSuspended = point.billingStatus === "SUSPENDIDO_MORA";

        let fillColor = "#10b981"; // Emerald / Online
        if (isSuspended) {
          fillColor = "#f59e0b"; // Amber / Suspended
        } else if (!isOnline) {
          fillColor = "#f43f5e"; // Rose / Offline
        }

        const isSelected = selectedPoint?.id === point.id;

        try {
          const marker = new gMaps.Marker({
            position: { lat: point.latitude, lng: point.longitude },
            map: mapInstanceRef.current,
            title: `#${point.contractNumber} - ${point.clientName}`,
            icon: {
              path: gMaps.SymbolPath.CIRCLE,
              fillColor,
              fillOpacity: 0.95,
              strokeColor: isSelected ? "#ffffff" : "#18181b",
              strokeWeight: isSelected ? 3 : 1.5,
              scale: isSelected ? 9 : 6.5,
            },
          });

          marker.addListener("click", () => {
            onSelectPoint(point);
          });

          markersRef.current.push(marker);
        } catch (_err) {
          // Catch marker instantiation errors
        }
      });
    }

    if (window.google?.maps) {
      renderMap();
      return () => {
        isMounted = false;
      };
    }

    const scriptId = "google-maps-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!existing) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${apiKey}` +
        `&callback=initGoogleMapCallback`;
      script.async = true;
      script.defer = true;
      window.initGoogleMapCallback = () => {
        renderMap();
      };
      document.head.appendChild(script);
    } else {
      renderMap();
    }

    return () => {
      isMounted = false;
    };
  }, [apiKey, points, selectedPoint, onSelectPoint, center]);

  // Center on selected point with coordinate validation
  useEffect(() => {
    try {
      if (
        selectedPoint &&
        mapInstanceRef.current &&
        typeof selectedPoint.latitude === "number" &&
        typeof selectedPoint.longitude === "number" &&
        Number.isFinite(selectedPoint.latitude) &&
        Number.isFinite(selectedPoint.longitude) &&
        selectedPoint.latitude >= -90 &&
        selectedPoint.latitude <= 90 &&
        selectedPoint.longitude >= -180 &&
        selectedPoint.longitude <= 180
      ) {
        mapInstanceRef.current.panTo({
          lat: selectedPoint.latitude,
          lng: selectedPoint.longitude,
        });
        mapInstanceRef.current.setZoom(16);
      }
    } catch (_err) {
      // Prevent panTo runtime exception
    }
  }, [selectedPoint]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full min-h-[500px] rounded-2xl overflow-hidden"
    />
  );
}
