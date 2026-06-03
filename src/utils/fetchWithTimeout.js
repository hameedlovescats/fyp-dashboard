/**
 * Fetch JSON with timeout and error handling.
 * @param {string} url - The URL to fetch
 * @param {number} timeoutMs - Timeout in milliseconds (default 4000)
 * @returns {Promise<any>} - Parsed JSON response
 * @throws {Error} - With clear message for timeout, network error, or bad response
 */
export async function fetchJsonWithTimeout(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      throw new Error(`Request timeout (${timeoutMs}ms) - backend may be offline`);
    }

    if (err instanceof SyntaxError) {
      throw new Error("Invalid response from server");
    }

    throw err;
  }
}
