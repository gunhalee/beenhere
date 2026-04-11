import { regenerateNicknameRepository } from "@/lib/profiles/repository";

export async function regenerateViewerNickname(input: {
  userId: string;
  nicknameChangedAt: string | null;
}) {
  return regenerateNicknameRepository(input.userId, input.nicknameChangedAt);
}
