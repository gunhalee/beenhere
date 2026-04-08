-- =============================================================
-- PostgREST(Supabase Data API) RPC 호출 허용
-- =============================================================
-- 마이그레이션만 적용하고 GRANT가 없으면 anon/authenticated 가
-- rpc("list_nearby_feed", …) 호출 시 권한 오류로 피드 500 이 난다.
-- =============================================================

-- 피드·프로필 조회: 비로그인(anon) 허용 (PRD: 피드 읽기)
GRANT EXECUTE ON FUNCTION public.list_nearby_feed(
  double precision,
  double precision,
  double precision,
  double precision,
  timestamp with time zone,
  uuid,
  integer
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_profile_posts(
  uuid,
  uuid,
  timestamp with time zone,
  integer
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_profile_likes(
  uuid,
  uuid,
  timestamp with time zone,
  integer
) TO anon, authenticated;

-- 라이커 목록: 로그인 사용자만 (내부에서 작성자 검증)
GRANT EXECUTE ON FUNCTION public.get_post_likers(
  uuid,
  uuid,
  timestamp with time zone,
  integer
) TO authenticated;

-- 쓰기·삭제·신고: 로그인 필요 (RPC 내부에서 auth.uid() 검증)
GRANT EXECUTE ON FUNCTION public.create_post(
  text,
  double precision,
  double precision,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.like_post(
  uuid,
  double precision,
  double precision,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.delete_post(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.report_post(uuid, text) TO authenticated;
