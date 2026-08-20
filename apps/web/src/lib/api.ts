const API_URL = process.env.API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
}

/**
 * Server-side client for the Nest API. Never import this from a client
 * component — the access token must not reach the browser.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(503, 'Сервис недоступен, попробуйте позже');
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();

    if (payload && typeof payload === 'object' && 'message' in payload) {
      const { message } = payload as { message: unknown };
      return Array.isArray(message) ? message.join(', ') : String(message);
    }
  } catch {
    // Fall through to the generic message below.
  }

  return 'Что-то пошло не так, попробуйте позже';
}
