import { fail } from "./response";

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
      response: fail("요청 형식을 다시 확인해 주세요.", 400, "INVALID_REQUEST"),
    };
  }
}
