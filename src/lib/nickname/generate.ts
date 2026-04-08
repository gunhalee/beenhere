/**
 * 닉네임 생성기 — 영어 형용사 + 명사 조합 (예: "brave_cloud", "lazy_fox")
 *
 * 쿨다운 정책: 7일에 1회 재생성 가능 (PRD 7.1, profiles.nickname_changed_at)
 */

const ADJECTIVES = [
  "brave", "calm", "dark", "early", "fast",
  "gentle", "happy", "idle", "jolly", "kind",
  "lazy", "mild", "neat", "odd", "proud",
  "quiet", "rare", "soft", "tiny", "vast",
  "warm", "wild", "wise", "young", "zesty",
  "amber", "azure", "bold", "crisp", "dusk",
  "faint", "golden", "hazy", "ivory", "jade",
  "lush", "mossy", "noble", "opal", "pale",
  "rusty", "sandy", "swift", "teal", "urban",
];

const NOUNS = [
  "bear", "bird", "cloud", "dawn", "echo",
  "field", "fox", "grove", "hill", "isle",
  "lake", "leaf", "moon", "moth", "mist",
  "oak", "path", "pine", "rain", "reef",
  "river", "rock", "rose", "sage", "sand",
  "sea", "snow", "star", "stone", "storm",
  "tide", "tree", "vale", "wave", "wind",
  "wolf", "wood", "brook", "cliff", "cove",
  "creek", "dune", "fern", "ford", "glade",
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

export function canRegenerateNickname(
  nicknameChangedAt: string | null,
): boolean {
  if (!nicknameChangedAt) return true;

  const lastChanged = new Date(nicknameChangedAt).getTime();
  const cooldownMs = NICKNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  return Date.now() - lastChanged >= cooldownMs;
}

/** 다음 재생성 가능까지 남은 일수 */
export function daysUntilNicknameRegen(
  nicknameChangedAt: string | null,
): number {
  if (!nicknameChangedAt) return 0;

  const lastChanged = new Date(nicknameChangedAt).getTime();
  const cooldownMs = NICKNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = cooldownMs - (Date.now() - lastChanged);

  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}
