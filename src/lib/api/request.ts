import { fail } from "./response";
import { API_ERROR_CODE, API_ERROR_MESSAGE } from "./common-errors";

type ReadJsonBodyResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: ReturnType<typeof fail> };

export async function readJsonBody<T>(
  request: Request,
): Promise<ReadJsonBodyResult<T>> {
  try {
    return { ok: true, body: (await request.json()) as T };
  } catch {
    return {
      ok: false,
      response: fail(
        API_ERROR_MESSAGE.INVALID_REQUEST,
        400,
        API_ERROR_CODE.INVALID_REQUEST,
      ),
    };
  }
}

export class ApiRouteTimeoutError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = API_ERROR_CODE.TIMEOUT) {
    super(message);
    this.name = "ApiRouteTimeoutError";
    this.code = code;
  }
}

export function isApiRouteTimeoutError(error: unknown): error is ApiRouteTimeoutError {
  return error instanceof ApiRouteTimeoutError;
}

export async function runWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  code: string,
  message: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ApiRouteTimeoutError(message, code));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
