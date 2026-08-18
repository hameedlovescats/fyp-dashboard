/**
 * Fetch JSON with timeout and error handling.
 * Production Vercel Python functions can take several seconds to cold-start,
 * so never abort a production API request after only 4-5 seconds.
 *
 * @param {string} url - The URL to fetch
 * @param {number} timeoutMs - Requested timeout in milliseconds (default 4000)
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - With clear message for timeout, network error, or bad response
 */
const MIN_PRODUCTION_TIMEOUT_MS = 30000;

export async function fetchJsonWithTimeout(url, timeoutMs = 4000) {
  const effectiveTimeoutMs = import.meta.env.PROD
    ? Math.max(timeoutMs, MIN_PRODUCTION_TIMEOUT_MS)
    : timeoutMs;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      throw new Error(
        `Request timeout (${effectiveTimeoutMs}ms) - backend is taking longer than expected`
      );
    }

    if (err instanceof SyntaxError) {
      throw new Error("Invalid response from server");
    }

    throw err;
  }
}
