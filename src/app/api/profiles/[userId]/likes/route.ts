import { getProfileLikesRepository } from "@/lib/profiles/repository";
import { handleProfileListRoute } from "../list-route-shared";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: Context) {
  return handleProfileListRoute({
    request,
    context,
    repository: getProfileLikesRepository,
    internalErrorMessage: "라이크 목록을 불러오는 중 오류가 발생했어요.",
    errorLogTag: "[api/profiles/:userId/likes] 조회 실패:",
  });
}
