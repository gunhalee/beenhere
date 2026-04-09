/**
 * 닉네임 생성기 — 영어 형용사 + 명사 조합 (예: "brave_cloud", "lazy_fox")
 *
 * 쿨다운 정책: 7일에 1회 재생성 가능 (PRD 7.1, profiles.nickname_changed_at)
 */

const ADJECTIVES = [
  "고요한", "따뜻한", "은은한", "반짝이는", "포근한",
  "맑은", "산뜻한", "부드러운", "단단한", "차분한",
  "선명한", "담대한", "느긋한", "활기찬", "싱그러운",
  "느린", "빠른", "넓은", "깊은", "짙은",
  "희미한", "반가운", "수줍은", "당찬", "명랑한",
  "청량한", "순한", "빛나는", "청명한", "새벽의",
  "노을빛", "별빛", "은빛", "바람결", "달콤한",
  "상쾌한", "평온한", "다정한", "기민한", "영롱한",
  "맑아진", "유연한", "튼튼한", "온화한", "깜찍한",
];

const NOUNS = [
  "고양이", "여우", "늑대", "바다", "강",
  "호수", "구름", "별", "달", "바람",
  "숲", "나무", "돌", "모래", "파도",
  "노을", "새벽", "안개", "비", "눈",
  "산", "들판", "해변", "골목", "등대",
  "섬", "언덕", "꽃", "장미", "잎새",
  "새", "곰", "토끼", "사슴", "고래",
  "나비", "갈대", "시냇물", "절벽", "동굴",
  "파랑새", "유성", "은하", "물안개", "바위",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** 닉네임 1개 생성 */
export function generateNickname(): string {
  return `${pickRandom(ADJECTIVES)}_${pickRandom(NOUNS)}`;
}

/** 닉네임 후보 N개 생성 (재생성 UI에서 선택지 제공용) */
export function generateNicknameCandidates(count = 3): string[] {
  const candidates = new Set<string>();

  while (candidates.size < count) {
    candidates.add(generateNickname());
  }

  return Array.from(candidates);
}

/** 닉네임 재생성 가능 여부 (쿨다운 7일) */
export const NICKNAME_COOLDOWN_DAYS = 7;

function parseLastChangedAt(nicknameChangedAt: string | null): number | null {
  if (!nicknameChangedAt) return null;

  const parsed = Date.parse(nicknameChangedAt);
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

export function canRegenerateNickname(
  nicknameChangedAt: string | null,
): boolean {
  const lastChanged = parseLastChangedAt(nicknameChangedAt);
  if (lastChanged === null) return true;

  const cooldownMs = NICKNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  return Date.now() - lastChanged >= cooldownMs;
}

/** 다음 재생성 가능까지 남은 일수 */
export function daysUntilNicknameRegen(
  nicknameChangedAt: string | null,
): number {
  const lastChanged = parseLastChangedAt(nicknameChangedAt);
  if (lastChanged === null) return 0;

  const cooldownMs = NICKNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = cooldownMs - (Date.now() - lastChanged);

  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}
