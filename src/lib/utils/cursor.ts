/** 임의 JSON-직렬화 가능 객체를 base64url 커서로 인코딩/디코딩한다. */

export function encodeCursor<T extends Record<string, unknown>>(payload: T): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor<T extends Record<string, unknown>>(
  encoded: string | null | undefined,
): T | null {
  if (!encoded) return null;

  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf-8");
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}
