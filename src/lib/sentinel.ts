import { AppError } from "../middleware/errorHandler";
import logger from "../utils/logger";

interface SentinelConfig {
  apiKey: string;
  baseUrl: string;
}

let config: SentinelConfig | null = null;

/**
 * Initialize Sentinel Hub configuration.
 */
function getConfig(): SentinelConfig {
  if (config) return config;
  const apiKey = process.env.SENTINEL_HUB_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "Sentinel Hub API key not configured. Set SENTINEL_HUB_API_KEY environment variable.",
      500
    );
  }
  config = {
    apiKey,
    baseUrl: "https://services.sentinel-hub.com/api/v1",
  };
  return config;
}

/**
 * Get NDVI (Normalized Difference Vegetation Index) for a specific location.
 * @param latitude - Latitude of the location
 * @param longitude - Longitude of the location
 * @param date - Date to check NDVI (ISO string or "latest")
 * @returns NDVI value between -1 and 1, or null if unavailable
 */
export async function getNDVI(
  latitude: number,
  longitude: number,
  date?: string
): Promise<number | null> {
  try {
    const cfg = getConfig();
    const url = `${cfg.baseUrl}/catalog/search`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        collections: ["sentinel-2-l2a"],
        datetime: date || "latest",
        limit: 1,
        intersects: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
      }),
    });

    if (!response.ok) {
      logger.warn(
        { status: response.status, statusText: response.statusText },
        "Sentinel Hub API request failed"
      );
      return null;
    }

    const data = (await response.json()) as any;
    // Simplified NDVI extraction - in production, would process actual raster data
    const ndviValue = data?.features?.[0]?.properties?.ndvi;
    return ndviValue !== undefined ? ndviValue : null;
  } catch (error) {
    logger.error({ error }, "Failed to fetch NDVI data from Sentinel Hub");
    return null;
  }
}

/**
 * Compare NDVI values before and after an incident date.
 * @returns Object with pre/post NDVI, drop, and whether threshold was breached
 */
export async function compareNDVI(
  latitude: number,
  longitude: number,
  incidentDate: Date,
  threshold: number = 0.3
): Promise<{
  ndviPre: number | null;
  ndviPost: number | null;
  ndviDrop: number | null;
  thresholdBreached: boolean;
}> {
  // Calculate dates for pre and post incident
  const postDate = new Date(incidentDate);
  postDate.setDate(postDate.getDate() + 7); // 1 week after

  const preDate = new Date(incidentDate);
  preDate.setDate(preDate.getDate() - 30); // 30 days before

  const [ndviPre, ndviPost] = await Promise.all([
    getNDVI(latitude, longitude, preDate.toISOString().split("T")[0]),
    getNDVI(latitude, longitude, postDate.toISOString().split("T")[0]),
  ]);

  let ndviDrop: number | null = null;
  let thresholdBreached = false;

  if (ndviPre !== null && ndviPost !== null) {
    ndviDrop = ndviPre - ndviPost;
    thresholdBreached = ndviDrop > threshold;
  }

  return { ndviPre, ndviPost, ndviDrop, thresholdBreached };
}
