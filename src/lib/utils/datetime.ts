export function formatRelativeTime(input: string | Date): string {
  const target = input instanceof Date ? input : new Date(input);
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - target.getTime()) / 1000),
  );

  if (diffSeconds < 60) return "방금 전";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}분 전`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}시간 전`;
  return `${Math.floor(diffSeconds / 86400)}일 전`;
}
