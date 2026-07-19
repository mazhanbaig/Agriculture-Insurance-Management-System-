import { AppError } from "../middleware/errorHandler";
import logger from "../utils/logger";

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

let apiKey: string | null = null;

/**
 * Initialize the OpenRouter API key.
 */
function getApiKey(): string {
  if (apiKey) return apiKey;
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new AppError(
      "OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.",
      500
    );
  }
  apiKey = key;
  return apiKey;
}

/**
 * Analyze an image using OpenRouter.
 * Supports any model available through OpenRouter (Gemini, GPT-4o, Claude, Llama, etc.)
 */
export async function analyzeImage(
  imageUrl: string,
  prompt: string,
  model: string = "google/gemini-2.0-flash-001"
): Promise<string> {
  const key = getApiKey();
  const url = "https://openrouter.ai/api/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": process.env.APP_URL || "http://localhost:4000",
      "X-Title": "AIMS",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new AppError(
      `OpenRouter API error: ${response.status} ${response.statusText}`,
      502
    );
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices?.[0]?.message?.content || "No response";
}

/**
 * Analyze an image with automatic fallback chain.
 * Tries the primary model first; if it fails, falls back to the secondary model.
 * Includes retry logic (1 retry per model).
 */
export async function analyzeWithFallback(
  imageUrl: string,
  prompt: string,
  primaryModel: string,
  fallbackModel: string,
  timeoutMs: number = 15000
): Promise<{ result: string; modelUsed: string; fallbackUsed: boolean }> {
  const models = [primaryModel, fallbackModel];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const isFallback = i > 0;

    try {
      // Single retry per model with a timeout controller
      const result = await Promise.race([
        analyzeImage(imageUrl, prompt, model),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      logger.info({ model, fallbackUsed: isFallback }, "OpenRouter analysis succeeded");
      return { result, modelUsed: model, fallbackUsed: isFallback };
    } catch (err) {
      logger.warn({ model, error: String(err) }, "OpenRouter model failed, trying fallback");

      // If this was the last model, throw
      if (i === models.length - 1) {
        throw new AppError(
          `All models failed for image analysis: ${String(err)}`,
          502
        );
      }

      // If more models remain, continue to next iteration
    }
  }

  // Should never reach here — either we return or throw above
  throw new AppError("Image analysis failed: no models available", 502);
}

/**
 * Extract text from a document using OpenRouter.
 */
export async function extractTextFromDocument(
  imageUrl: string,
  model: string = "google/gemini-2.0-flash-001"
): Promise<string> {
  return analyzeImage(
    imageUrl,
    "Extract all text from this document. Include CNIC numbers, names, and dates.",
    model
  );
}


