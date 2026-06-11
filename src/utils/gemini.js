/**
 * Simple in-memory rate limiter to space out API requests.
 * Ensures a minimum gap between consecutive calls to avoid hitting quota.
 */
const rateLimiter = {
  lastRequestTime: 0,
  minInterval: 2000, // 2 seconds minimum between requests
  quotaExhaustedUntil: 0, // timestamp until which we should wait

  async waitForSlot() {
    const now = Date.now();

    // If quota was exhausted, wait until the cooldown expires
    if (this.quotaExhaustedUntil > now) {
      const waitMs = this.quotaExhaustedUntil - now;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    // Ensure minimum interval between requests
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
    }

    this.lastRequestTime = Date.now();
  },

  setQuotaCooldown(seconds) {
    this.quotaExhaustedUntil = Date.now() + (seconds * 1000);
  }
};

/**
 * Parse the retry-after duration from a 429 error response.
 * Attempts to extract seconds from the error message or uses a default.
 * @param {string} responseText - The raw response text.
 * @returns {number} - Seconds to wait before retrying.
 */
function parseRetryAfter(responseText) {
  try {
    const data = JSON.parse(responseText);
    const message = data?.error?.message || '';
    // Match patterns like "retry in 40.124893078s" or "retry after 40s"
    const match = message.match(/retry\s+(?:in|after)\s+([\d.]+)s/i);
    if (match) {
      return Math.ceil(parseFloat(match[1]));
    }

    // Check for Retry-After in quota violations
    const violations = data?.error?.details?.find(d => d['@type']?.includes('QuotaFailure'));
    if (violations) {
      return 60; // Default 60s for quota exhaustion
    }
  } catch (e) {
    // Ignore parse errors
  }
  return 45; // Default wait time
}

/**
 * Known fallback models in order of preference.
 * When a model is unavailable (503), we try the next one.
 */
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-2.0-flash',
];

/**
 * Call the Gemini API with automatic retry, exponential backoff, quota-aware rate limiting,
 * and automatic model fallback on 503 (UNAVAILABLE) errors.
 * @param {object} payload - The request payload for Gemini API.
 * @param {string} apiKey - The Gemini API key.
 * @param {string} model - The model to use.
 * @param {function} [onRetry] - Optional callback when a retry is happening: (retryInfo) => void
 * @returns {string} - The text response from Gemini.
 */
export async function callGemini(payload, apiKey, model = 'gemini-2.5-flash', onRetry = null) {
  // Build the list of models to try: primary model first, then fallbacks (excluding duplicates)
  const modelsToTry = [model, ...FALLBACK_MODELS.filter(m => m !== model)];

  let lastError = null;
  let safetyRelaxed = false;

  for (const currentModel of modelsToTry) {
    try {
      const result = await _callGeminiWithRetries(
        safetyRelaxed ? _injectRelaxedSafety(payload) : payload,
        apiKey, currentModel, onRetry
      );
      return result;
    } catch (error) {
      // Don't fallback for quota errors — they apply to the account, not the model
      if (error instanceof QuotaExhaustedError) {
        throw error;
      }

      // Safety filter blocked the content — retry with relaxed settings on the SAME model first
      if (error instanceof SafetyBlockError && !safetyRelaxed) {
        safetyRelaxed = true;
        if (onRetry) {
          onRetry({
            attempt: 0,
            maxRetries: 0,
            waitSeconds: 2,
            reason: 'safety_retry',
            model: currentModel,
          });
        }
        // Retry the same model with relaxed safety
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const result = await _callGeminiWithRetries(
            _injectRelaxedSafety(payload), apiKey, currentModel, onRetry
          );
          return result;
        } catch (retryError) {
          // If still blocked or other error, fall through to model fallback
          if (retryError instanceof QuotaExhaustedError) throw retryError;
          lastError = retryError;
          continue;
        }
      }

      // Only fallback on 503 / UNAVAILABLE errors
      if (error instanceof ModelUnavailableError) {
        lastError = error;
        if (onRetry) {
          onRetry({
            attempt: 0,
            maxRetries: 0,
            waitSeconds: 5,
            reason: 'model_fallback',
            fromModel: currentModel,
            toModel: modelsToTry[modelsToTry.indexOf(currentModel) + 1] || null,
          });
        }
        // Brief pause before trying the next model
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      // For other errors, don't try other models — just throw
      throw error;
    }
  }

  // All models exhausted
  throw new Error(
    lastError
      ? `所有可用模型皆暫時無法使用（伺服器高負載），請稍後再試。\n原始錯誤：${lastError.message}`
      : "未知的連線錯誤"
  );
}

/**
 * Inject relaxed safety settings into a Gemini API payload.
 * Uses BLOCK_NONE for all harm categories to allow analysis of game screenshots
 * that might be misclassified as gambling or dangerous content.
 */
function _injectRelaxedSafety(payload) {
  return {
    ...payload,
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ]
  };
}

/**
 * Internal: Call Gemini API for a specific model with retry logic.
 * Throws ModelUnavailableError for 503 so the caller can attempt model fallback.
 */
async function _callGeminiWithRetries(payload, apiKey, model, onRetry) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const maxRetries = 5;
  // Longer delays for 503 scenarios (seconds): 5s, 10s, 20s, 40s, 60s
  const baseDelays = [5000, 10000, 20000, 40000, 60000];
  let lastError = null;
  let consecutive503 = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait for rate limiter slot
      await rateLimiter.waitForSlot();

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();

      // Handle 429 (Rate Limited / Quota Exceeded) specifically
      if (response.status === 429) {
        const retryAfterSec = parseRetryAfter(responseText);
        rateLimiter.setQuotaCooldown(retryAfterSec);

        // Check if this is a daily quota (not just rate limit)
        const isDailyQuota = responseText.includes('PerDay') || responseText.includes('free_tier');

        if (isDailyQuota) {
          throw new QuotaExhaustedError(
            `⚠️ 已達到免費方案每日配額上限（${model}）。\n` +
            `建議方案：\n` +
            `1. 等待約 ${retryAfterSec} 秒後重試\n` +
            `2. 切換到其他模型\n` +
            `3. 升級為付費方案以解除限制`,
            retryAfterSec
          );
        }

        // For transient rate limits, retry after waiting
        if (attempt < maxRetries) {
          const waitMs = retryAfterSec * 1000;
          if (onRetry) {
            onRetry({
              attempt: attempt + 1,
              maxRetries,
              waitSeconds: retryAfterSec,
              reason: 'rate_limit'
            });
          }
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }

        throw new QuotaExhaustedError(
          `API 請求頻率過高，已重試 ${maxRetries} 次仍失敗。請稍後再試。`,
          retryAfterSec
        );
      }

      // Handle 503 (UNAVAILABLE / high demand) with dedicated retry + fallback
      if (response.status === 503) {
        consecutive503++;

        // After 2 consecutive 503s on this model, escalate to model fallback
        if (consecutive503 >= 2) {
          throw new ModelUnavailableError(
            `模型 ${model} 目前處於高需求狀態，暫時無法使用。`,
            model
          );
        }

        if (attempt < maxRetries) {
          const waitSec = Math.min(15 + attempt * 10, 60); // 15s, 25s, 35s, 45s, 55s
          if (onRetry) {
            onRetry({
              attempt: attempt + 1,
              maxRetries,
              waitSeconds: waitSec,
              reason: 'server_busy',
              model: model,
            });
          }
          await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
          continue;
        }

        // All retries exhausted for this model
        throw new ModelUnavailableError(
          `模型 ${model} 持續處於高負載狀態，已重試 ${maxRetries} 次仍失敗。`,
          model
        );
      }

      // Handle other non-OK responses with a user-friendly message
      if (!response.ok) {
        // Parse the error for a cleaner message
        let userMessage = `API 錯誤 (${response.status})`;
        try {
          const errData = JSON.parse(responseText);
          if (errData?.error?.message) {
            userMessage = `API 錯誤 (${response.status}): ${errData.error.message}`;
          }
        } catch (_) {
          userMessage = `API 錯誤 (${response.status}): ${responseText.substring(0, 200)}`;
        }
        throw new Error(userMessage);
      }

      if (!responseText) {
        throw new Error("API 回傳了空資料");
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`API 解析失敗: ${response.status} - ${responseText.substring(0, 100)}`);
      }

      if (result.error) throw new Error(result.error.message);

      // Check if the response was blocked by safety filters
      const candidate = result.candidates?.[0];
      const finishReason = candidate?.finishReason;

      // Gemini returns finishReason "SAFETY" when content is blocked by safety filters
      if (finishReason === 'SAFETY' || finishReason === 'BLOCKED') {
        const blockedCategories = (candidate?.safetyRatings || [])
          .filter(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
          .map(r => r.category?.replace('HARM_CATEGORY_', '') || '未知')
          .join(', ');
        throw new SafetyBlockError(
          `AI 安全過濾器阻擋了此內容。\n觸發類別：${blockedCategories || '未知'}\n\n` +
          `此圖片可能包含被 AI 誤判為敏感的內容（如紙牌/賭博相關畫面）。\n` +
          `系統將自動嘗試降低安全過濾等級後重試。`,
          blockedCategories
        );
      }

      // Also check for promptFeedback block (entire prompt blocked)
      if (result.promptFeedback?.blockReason) {
        throw new SafetyBlockError(
          `AI 安全過濾器阻擋了此請求。\n原因：${result.promptFeedback.blockReason}\n\n` +
          `此圖片可能包含被 AI 誤判為敏感的內容。\n` +
          `系統將自動嘗試降低安全過濾等級後重試。`,
          result.promptFeedback.blockReason
        );
      }

      const text = candidate?.content?.parts?.[0]?.text;
      if (!text) throw new Error("AI 回傳了空白內容，請確認圖片是否正確或稍後重試。");

      // Reset 503 counter on success
      consecutive503 = 0;
      return text;
    } catch (error) {
      // Don't retry these errors — they need to be handled at a higher level
      if (error instanceof QuotaExhaustedError || error instanceof ModelUnavailableError || error instanceof SafetyBlockError) {
        throw error;
      }

      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelays[attempt] || baseDelays[baseDelays.length - 1];
        if (onRetry) {
          onRetry({
            attempt: attempt + 1,
            maxRetries,
            waitSeconds: Math.round(delay / 1000),
            reason: 'error'
          });
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error(lastError ? lastError.message : "未知的連線錯誤");
}

/**
 * Custom error class for quota exhaustion.
 */
export class QuotaExhaustedError extends Error {
  constructor(message, retryAfterSeconds) {
    super(message);
    this.name = 'QuotaExhaustedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Custom error class for model unavailability (503).
 * Signals that the caller should try a different model.
 */
export class ModelUnavailableError extends Error {
  constructor(message, model) {
    super(message);
    this.name = 'ModelUnavailableError';
    this.model = model;
  }
}

/**
 * Custom error class for safety filter blocks.
 * Signals that the content was blocked by Gemini's safety filters
 * and should be retried with relaxed safety settings.
 */
export class SafetyBlockError extends Error {
  constructor(message, blockedCategories) {
    super(message);
    this.name = 'SafetyBlockError';
    this.blockedCategories = blockedCategories;
  }
}

/**
 * Parse potentially markdown-wrapped JSON from AI response.
 * @param {string} text - Raw text from AI.
 * @returns {object} - Parsed JSON object.
 */
export function parseAIJson(text) {
  let cleanText = text.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();
  return JSON.parse(cleanText);
}

/**
 * Validate an API key by checking format only (no API call).
 * This avoids wasting quota on validation requests.
 * @param {string} apiKey - The Gemini API key to validate.
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateApiKey(apiKey, model = 'gemini-2.5-flash') {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: '金鑰格式不正確' };
  }

  // Gemini API keys typically start with "AIza" and are ~39 characters
  const trimmed = apiKey.trim();
  if (trimmed.startsWith('AIza') && trimmed.length >= 35 && trimmed.length <= 50) {
    return { valid: true };
  }

  // If format doesn't match typical pattern, still allow but mark as uncertain
  if (trimmed.length >= 20) {
    return { valid: true };
  }

  return { valid: false, error: '金鑰格式不正確，請確認是否完整貼上' };
}
