import logger from "../utils/logger";

/**
 * Result of a weather verification check.
 */
export interface WeatherResult {
  confirmed: boolean;
  event?: string;
  data?: any;
  method: "historical" | "current" | "none";
}

/**
 * Severe weather event categories relevant to agricultural insurance.
 * Maps OpenWeather condition codes to readable names.
 */
const SEVERE_EVENTS: Array<{ codes: number[]; name: string }> = [
  { codes: [200, 201, 202, 210, 211, 212, 221, 230, 231, 232], name: "Thunderstorm" },
  { codes: [300, 301, 302, 310, 311, 312, 313, 314, 321], name: "Drizzle" },
  { codes: [500, 501, 502, 503, 504, 511, 520, 521, 522, 531], name: "Rain" },
  { codes: [600, 601, 602, 611, 612, 613, 615, 616, 620, 621, 622], name: "Snow" },
  { codes: [701, 711, 721, 731, 741, 751, 761, 762, 771, 781], name: "Extreme" },
  { codes: [900, 901, 902, 903, 904, 905, 906], name: "Extreme" },
];

/** Condition text keywords (for the free API that doesn't return codes). */
const SEVERE_KEYWORDS = [
  "Thunderstorm", "Tornado", "Hurricane", "Extreme", "Flood",
  "Storm", "Hail", "Squall", "Tornado", "Dust", "Sand",
  "Volcanic", "Ash", "Squalls",
];

/**
 * Check if a weather condition is severe enough to justify an insurance claim.
 */
function isSevereWeather(conditions: string): boolean {
  return SEVERE_KEYWORDS.some((keyword) =>
    conditions.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Build a weather result from an OpenWeather API response.
 */
function buildWeatherResult(data: any): { confirmed: boolean; event?: string } {
  const weatherArray = data?.weather || [];
  const conditions = weatherArray.map((w: any) => w.main).join(", ");
  const descriptions = weatherArray.map((w: any) => w.description).join(", ");
  const severe = isSevereWeather(conditions) || isSevereWeather(descriptions);

  return {
    confirmed: severe,
    event: severe ? conditions || descriptions : undefined,
  };
}

/**
 * Check historical weather at the incident date and location using
 * the One Call API 3.0 timemachine endpoint.
 *
 * Requires a paid OpenWeather subscription that enables One Call 3.0.
 * Returns null if the API call fails (no subscription, network error, etc.)
 */
async function checkHistoricalWeather(
  lat: number,
  lon: number,
  incidentDate: Date,
  apiKey: string
): Promise<{ confirmed: boolean; event?: string } | null> {
  try {
    const unixTime = Math.floor(incidentDate.getTime() / 1000);
    const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${unixTime}&appid=${apiKey}&units=metric`;

    const response = await fetch(url);
    if (!response.ok) {
      logger.warn({ status: response.status }, "Historical weather API returned error");
      return null;
    }

    const data = (await response.json()) as { data?: Array<{ weather?: Array<{ main: string; description: string }> }> };
    // One Call 3.0 timemachine returns { data: [...] }
    const weatherData = data?.data?.[0];
    if (!weatherData) {
      logger.warn("Historical weather API returned empty data");
      return null;
    }

    return buildWeatherResult(weatherData);
  } catch (error) {
    logger.error({ error }, "Historical weather check failed");
    return null;
  }
}

/**
 * Check current weather at a location using the free current weather endpoint.
 * Falls back to this if historical check is unavailable or fails.
 */
async function checkCurrentWeather(
  lat: number,
  lon: number,
  apiKey: string
): Promise<{ confirmed: boolean; event?: string } | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

    const response = await fetch(url);
    if (!response.ok) {
      logger.warn({ status: response.status }, "Current weather API returned error");
      return null;
    }

    const data = await response.json();
    return buildWeatherResult(data);
  } catch (error) {
    logger.error({ error }, "Current weather check failed");
    return null;
  }
}

/**
 * Primary weather verification function for claim fraud detection.
 *
 * Strategy:
 * 1. Try historical weather at the incident date using One Call 3.0 timemachine (lat/lon).
 * 2. If historical fails or is unavailable, fall back to current weather at lat/lon.
 * 3. If both fail, return 'none' method with confirmed=false.
 *
 * @param lat - Latitude of the incident location (from land parcel)
 * @param lon - Longitude of the incident location
 * @param incidentDate - Date of the claimed incident
 */
export async function checkWeatherForClaim(
  lat: number | null | undefined,
  lon: number | null | undefined,
  incidentDate: Date
): Promise<WeatherResult> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return { confirmed: false, method: "none" };
  }

  // Strategy 1: Historical weather at lat/lon (most accurate for fraud detection)
  if (lat && lon) {
    const historical = await checkHistoricalWeather(lat, lon, incidentDate, apiKey);
    if (historical !== null) {
      return {
        confirmed: historical.confirmed,
        event: historical.event,
        data: { method: "historical", lat, lon },
        method: "historical",
      };
    }

    // Strategy 2: Current weather at lat/lon (fallback from historical)
    const current = await checkCurrentWeather(lat, lon, apiKey);
    if (current !== null) {
      return {
        confirmed: current.confirmed,
        event: current.event,
        data: { method: "current", lat, lon },
        method: "current",
      };
    }
  }

  return { confirmed: false, method: "none" };
}

/**
 * Weather check for auto-trigger events.
 * Auto-trigger monitors CURRENT conditions (NDVI drop happening now),
 * so checking current weather is appropriate.
 * Uses lat/lon coordinates (more accurate than city name).
 */
export async function checkWeatherNow(
  lat: number | null | undefined,
  lon: number | null | undefined
): Promise<WeatherResult> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return { confirmed: false, method: "none" };
  }

  if (lat && lon) {
    const result = await checkCurrentWeather(lat, lon, apiKey);
    if (result !== null) {
      return {
        confirmed: result.confirmed,
        event: result.event,
        data: { method: "current", lat, lon },
        method: "current",
      };
    }
  }

  return { confirmed: false, method: "none" };
}
