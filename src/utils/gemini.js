/**
 * Call the Gemini API with automatic retry and exponential backoff.
 * @param {object} payload - The request payload for Gemini API.
 * @param {string} apiKey - The Gemini API key.
 * @returns {string} - The text response from Gemini.
 */
export async function callGemini(payload, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const delays = [1000, 2000, 4000, 8000, 16000];
  let lastError = null;

  for (let i = 0; i <= delays.length; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`API 錯誤 (${response.status}): ${responseText}`);
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
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("AI 回傳了空白內容");
      return text;
    } catch (error) {
      lastError = error;
      if (i < delays.length) {
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
    }
  }
  throw new Error(lastError ? lastError.message : "未知的連線錯誤");
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
 * Validate an API key by sending a minimal request to Gemini.
 * @param {string} apiKey - The Gemini API key to validate.
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateApiKey(apiKey) {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: '金鑰格式不正確' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: "Hi" }] }],
      generationConfig: { maxOutputTokens: 5 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return { valid: true };
    }

    const data = await response.json().catch(() => ({}));
    if (response.status === 400 && data.error?.message?.includes('API key')) {
      return { valid: false, error: 'API Key 無效' };
    }
    if (response.status === 403) {
      return { valid: false, error: 'API Key 權限不足' };
    }
    if (response.status === 429) {
      // Rate limited but key is valid
      return { valid: true };
    }
    return { valid: false, error: `驗證失敗 (${response.status})` };
  } catch (err) {
    return { valid: false, error: '網路連線異常' };
  }
}


