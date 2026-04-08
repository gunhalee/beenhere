/**
 * 미터 단위 거리를 사용자에게 표시할 문자열로 변환한다.
 * PRD 9.4: "장소 라벨과 현재 위치로부터의 거리"
 *
 * 예시: "바로 근처" / "320m" / "1.2km" / "12km"
 */
export function formatDistance(meters: number): string {
  if (meters < 50) return "바로 근처";
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  const km = meters / 1000;
  return `${km >= 10 ? Math.round(km) : km.toFixed(1)}km`;
}
