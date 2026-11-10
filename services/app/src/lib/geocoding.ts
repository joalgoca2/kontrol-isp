interface GeocodeResult {
  latitude: number;
  longitude: number;
  precision: "exact" | "street" | "neighborhood" | "city";
  queryUsed: string;
}

function cleanAddressText(address: string): string {
  let cleaned = address
    .replace(/\b(PISO|APTO|CASA|INT|INTERIOR|LOCAL|MZ|MANZANA|LT|LOTE)\b.*$/i, "")
    .replace(/\/\/.*$/, "")
    .replace(/\/.*$/, "")
    .replace(/\(.*?\)/g, "")
    .trim();

  cleaned = cleaned
    .replace(/\bCL\b|\bCLL\b/gi, "Calle")
    .replace(/\bCR\b|\bCRA\b|\bCRR\b|\bKR\b/gi, "Carrera")
    .replace(/\bTV\b|\bTRV\b|\bTRVSAL\b/gi, "Transversal")
    .replace(/\bDG\b|\bDIAG\b/gi, "Diagonal")
    .replace(/\bSUR\b/gi, "Sur")
    .replace(/\bESTE\b/gi, "Este")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

export async function geocodeAddress(
  rawAddress: string,
  city = "Soacha",
  googleApiKey?: string
): Promise<GeocodeResult | null> {
  const cleaned = cleanAddressText(rawAddress);
  if (!cleaned || cleaned.length < 3) return null;

  // 1. Google Geocoding API if key provided
  if (googleApiKey) {
    try {
      const fullQuery = `${cleaned}, ${city}, Colombia`;
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json?address=` +
        encodeURIComponent(fullQuery) +
        `&key=${googleApiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
        const loc = data.results[0].geometry.location;
        return {
          latitude: loc.lat,
          longitude: loc.lng,
          precision: "exact",
          queryUsed: fullQuery,
        };
      }
    } catch (_err) {
      // Fall through to Nominatim
    }
  }

  // 2. OpenStreetMap / Nominatim Fallback
  // Try clean address -> street only -> neighborhood -> city center
  const candidates: Array<{ q: string; precision: GeocodeResult["precision"] }> = [
    { q: `${cleaned}, ${city}, Colombia`, precision: "street" },
  ];

  // Try extracting street without house number (e.g. "Calle 30", "Carrera 32 Este")
  const streetMatch = cleaned.match(
    /^(Calle|Carrera|Transversal|Diagonal)\s+\d+[a-zA-Z]?(\s+(Sur|Este))?/i
  );
  if (streetMatch?.[0]) {
    candidates.push({
      q: `${streetMatch[0]}, ${city}, Colombia`,
      precision: "street",
    });
  }

  for (const candidate of candidates) {
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=` +
        encodeURIComponent(candidate.q);
      const res = await fetch(url, {
        headers: {
          "User-Agent": "KontrolISP/1.0 (soporte@serkoi.com)",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lon)) {
            // Apply slight jitter for street level so overlapping pins don't hide
            const jitterLat =
              candidate.precision === "street"
                ? (Math.random() - 0.5) * 0.0006
                : 0;
            const jitterLon =
              candidate.precision === "street"
                ? (Math.random() - 0.5) * 0.0006
                : 0;

            return {
              latitude: lat + jitterLat,
              longitude: lon + jitterLon,
              precision: candidate.precision,
              queryUsed: candidate.q,
            };
          }
        }
      }
    } catch (_err) {
      // Continue to next candidate
    }
  }

  return null;
}

