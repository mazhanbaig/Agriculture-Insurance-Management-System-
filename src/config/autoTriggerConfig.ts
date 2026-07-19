/**
 * Auto-Trigger configuration for parametric insurance payouts.
 *
 * Each policy plan can optionally enable auto-trigger, which monitors
 * satellite NDVI and weather data to automatically create claims when
 * predefined thresholds are breached.
 *
 * This config is stored inside PolicyPlan.config.autoTrigger.
 */

export interface AutoTriggerConfig {
  /** Whether auto-trigger monitoring is enabled for this plan */
  enabled: boolean;
  /** NDVI drop threshold (0.0 - 1.0). Default: 0.3 (30% drop) */
  ndviThreshold: number;
  /** Whether weather verification is required before triggering. Default: true */
  weatherCheck: boolean;
  /** Minimum number of days between consecutive images for NDVI comparison */
  minDaysBetweenChecks: number;
  /** Percentage of coverage amount to auto-claim (0.0 - 1.0). Default: 0.5 */
  claimPercentage: number;
  /** Max retries for external API calls (NDVI, weather). Default: 3 */
  maxRetries: number;
  /** Base delay in ms for exponential backoff. Default: 2000 */
  retryBaseDelayMs: number;
  /** Whether to auto-approve claims with low fraud score. Default: true */
  autoApprove: boolean;
  /** Max fraud score for auto-approval (0-100). Default: 30 */
  autoApproveMaxScore: number;
}

/**
 * Default auto-trigger configuration.
 */
export const DEFAULT_AUTO_TRIGGER_CONFIG: AutoTriggerConfig = {
  enabled: false,
  ndviThreshold: 0.3,
  weatherCheck: true,
  minDaysBetweenChecks: 1,
  claimPercentage: 0.5,
  maxRetries: 3,
  retryBaseDelayMs: 2000,
  autoApprove: true,
  autoApproveMaxScore: 30,
};

/**
 * Merge a partial config with defaults.
 */
export function mergeAutoTriggerConfig(
  partial?: Partial<AutoTriggerConfig>
): AutoTriggerConfig {
  return {
    ...DEFAULT_AUTO_TRIGGER_CONFIG,
    ...(partial || {}),
  };
}

/**
 * Execute an async function with retry and exponential backoff.
 * Used for external API calls (NDVI, weather).
 * Uses console-based logging to avoid dependency issues.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    context?: string;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_AUTO_TRIGGER_CONFIG.maxRetries;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_AUTO_TRIGGER_CONFIG.retryBaseDelayMs;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000;
        console.warn(
          `[auto-trigger] Retry ${attempt}/${maxRetries} after ${Math.round(delay + jitter)}ms` +
          (options.context ? ` (${options.context})` : "") +
          `: ${lastError.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }
  }

  throw lastError || new Error(`Operation failed after ${maxRetries} retries`);
}
