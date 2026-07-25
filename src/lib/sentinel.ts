import { AppError } from "../middleware/errorHandler";
import logger from "../utils/logger";
import { withRetry } from "../config/autoTriggerConfig";

interface CopernicusConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  authUrl: string;
  accessToken: string | null;
  tokenExpiresAt: number;
  quotaLimit: number;
  quotaUsed: number;
  quotaResetDate: string;
}

let config: CopernicusConfig | null = null;

function getConfig(): CopernicusConfig {
  if (config) return config;

  const clientId = process.env.SENTINEL_CLIENT_ID;
  const clientSecret = process.env.SENTINEL_CLIENT_SECRET;
  const baseUrl = process.env.SENTINEL_API_URL || "https://sh.dataspace.copernicus.eu";
  const authUrl = process.env.SENTINEL_AUTH_URL || "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";

  if (!clientId || !clientSecret) {
    throw new AppError(
      "Copernicus credentials not configured. Set SENTINEL_CLIENT_ID and SENTINEL_CLIENT_SECRET environment variables.",
      500
    );
  }

  config = {
    clientId,
    clientSecret,
    baseUrl,
    authUrl,
    accessToken: null,
    tokenExpiresAt: 0,
    quotaLimit: Number(process.env.SENTINEL_QUOTA_LIMIT) || 30000,
    quotaUsed: 0,
    quotaResetDate: new Date().toISOString().split("T")[0],
  };
  return config;
}

async function getAccessToken(): Promise<string> {
  const cfg = getConfig();

  if (cfg.accessToken && Date.now() < cfg.tokenExpiresAt) {
    return cfg.accessToken;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });

  const response = await fetch(cfg.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Copernicus OAuth failed (${response.status}): ${text}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  cfg.accessToken = data.access_token;
  cfg.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  logger.info({ expiresIn: data.expires_in }, "Copernicus OAuth token acquired");
  return data.access_token;
}

function checkQuota(): void {
  const cfg = getConfig();
  const today = new Date().toISOString().split("T")[0];

  if (cfg.quotaResetDate !== today) {
    cfg.quotaUsed = 0;
    cfg.quotaResetDate = today;
  }

  if (cfg.quotaUsed >= cfg.quotaLimit) {
    throw new AppError(
      `Copernicus API quota exhausted: ${cfg.quotaUsed}/${cfg.quotaLimit} requests this month. ` +
      "Set SENTINEL_QUOTA_LIMIT to adjust or wait for reset.",
      429
    );
  }
}

function incrementQuota(): void {
  const cfg = getConfig();
  cfg.quotaUsed++;
}

interface EvalscriptResult {
  ndvi?: number;
  [key: string]: unknown;
}

interface CopernicusFeature {
  properties: EvalscriptResult;
}

interface CopernicusResponse {
  features: CopernicusFeature[];
}

async function fetchNDVIWithRetry(
  latitude: number,
  longitude: number,
  date?: string
): Promise<CopernicusResponse | null> {
  try {
    return await withRetry(
      async () => {
        checkQuota();

        const cfg = getConfig();
        const token = await getAccessToken();
        const searchUrl = `${cfg.baseUrl}/api/v1/catalog/search`;

        const response = await fetch(searchUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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
          const body = await response.text();
          throw new Error(`Copernicus API responded with ${response.status}: ${body}`);
        }

        incrementQuota();
        return response.json() as Promise<CopernicusResponse>;
      },
      {
        context: `getNDVI(${latitude}, ${longitude}, ${date})`,
        maxRetries: 3,
        baseDelayMs: 2000,
      }
    );
  } catch (error) {
    logger.error({ error }, "Failed to fetch NDVI from Copernicus after retries");
    return null;
  }
}

export async function getNDVI(
  latitude: number,
  longitude: number,
  date?: string
): Promise<number | null> {
  try {
    const startTime = Date.now();
    const data = await fetchNDVIWithRetry(latitude, longitude, date);
    const duration = Date.now() - startTime;

    if (!data) {
      logger.warn({ latitude, longitude, durationMs: duration }, "NDVI fetch returned no data");
      return null;
    }

    const ndviValue = data?.features?.[0]?.properties?.ndvi;
    const success = ndviValue !== undefined;

    logger.info({
      latitude,
      longitude,
      durationMs: duration,
      success,
      ndvi: ndviValue,
    }, "NDVI fetch completed");

    return success ? ndviValue : null;
  } catch (error) {
    logger.error({ error }, "Failed to fetch NDVI from Copernicus");
    return null;
  }
}

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
  const postDate = new Date(incidentDate);
  postDate.setDate(postDate.getDate() + 7);

  const preDate = new Date(incidentDate);
  preDate.setDate(preDate.getDate() - 30);

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

export async function fetchNDVIBatch(
  locations: Array<{ latitude: number; longitude: number; date?: string }>
): Promise<Array<{ latitude: number; longitude: number; ndvi: number | null; durationMs: number }>> {
  const results: Array<{ latitude: number; longitude: number; ndvi: number | null; durationMs: number }> = [];

  for (const loc of locations) {
    const startTime = Date.now();
    const ndvi = await getNDVI(loc.latitude, loc.longitude, loc.date);
    results.push({
      latitude: loc.latitude,
      longitude: loc.longitude,
      ndvi,
      durationMs: Date.now() - startTime,
    });
  }

  return results;
}

export async function healthCheck(): Promise<{
  ok: boolean;
  latencyMs: number;
  quotaUsed: number;
  quotaLimit: number;
  message: string;
}> {
  const startTime = Date.now();
  try {
    const cfg = getConfig();
    const token = await getAccessToken();

    const response = await fetch(`${cfg.baseUrl}/api/v1/catalog/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        collections: ["sentinel-2-l2a"],
        datetime: "latest",
        limit: 1,
        intersects: { type: "Point", coordinates: [0, 0] },
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        ok: false,
        latencyMs,
        quotaUsed: cfg.quotaUsed,
        quotaLimit: cfg.quotaLimit,
        message: `Copernicus API unhealthy (${response.status})`,
      };
    }

    return {
      ok: true,
      latencyMs,
      quotaUsed: cfg.quotaUsed,
      quotaLimit: cfg.quotaLimit,
      message: `Copernicus API healthy (${latencyMs}ms, ${cfg.quotaUsed}/${cfg.quotaLimit} requests)`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startTime,
      quotaUsed: getConfig().quotaUsed,
      quotaLimit: getConfig().quotaLimit,
      message: `Copernicus API health check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
