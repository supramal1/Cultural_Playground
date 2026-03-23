export type FetchWithRetryOptions = {
  timeoutMs: number;
  retries: number;
  backoffMs?: number;
};

export class FetchError extends Error {
  readonly status?: number;
  readonly bodyText?: string;

  constructor(message: string, status?: number, bodyText?: string) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  options: FetchWithRetryOptions
): Promise<Response> {
  const retries = Math.max(0, options.retries);
  const baseBackoff = options.backoffMs ?? 300;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        return response;
      }

      const body = await response.text().catch(() => "");
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < retries) {
        const waitMs = baseBackoff * 2 ** attempt;
        await sleep(waitMs);
        continue;
      }

      throw new FetchError(
        `Request failed with status ${response.status}`,
        response.status,
        body
      );
    } catch (error) {
      clearTimeout(timeout);
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (attempt < retries) {
        const waitMs = baseBackoff * 2 ** attempt;
        await sleep(waitMs);
        continue;
      }

      if (error instanceof FetchError) {
        throw error;
      }

      throw new FetchError(
        isAbort ? `Request timed out after ${options.timeoutMs}ms` : "Network request failed"
      );
    }
  }

  throw new FetchError("Request failed after retries");
}
