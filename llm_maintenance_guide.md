# LLM Maintenance Guide - beenhere

- Last updated: 2026-04-11 (KST)
- Source of truth: `beenhere_prd.md`, `src/*`, `supabase/migrations/*`
- Audience: 이 저장소를 유지보수하거나 리팩토링하는 개발자/에이전트

## 1. 기본 원칙

- 제품/UX 해석은 항상 `beenhere_prd.md`를 우선한다.
- 내부 구현은 아직 `like`, `likeCount`, `myLike` 용어를 유지한다.
- 사용자 노출 문구는 가능한 한 `수집` 기준으로 맞춘다.
- 변경 시에는 route 계약, domain 타입, SQL migration, 테스트를 함께 맞춘다.

## 2. 현재 아키텍처

```text
Next.js App Router
  Screen Components
    src/components/feed/feed-screen.tsx
    src/components/profile/profile-screen.tsx
  View Hooks
    src/lib/hooks/use-feed.ts
    src/lib/hooks/use-feed-polling.ts
    src/lib/hooks/use-profile.ts
    src/lib/hooks/use-profile-context.ts
    src/lib/hooks/use-profile-lists.ts
    src/lib/hooks/use-profile-likers.ts
  Client API Layer
    src/lib/api/client.ts
    src/lib/api/request-cache.ts
    src/lib/api/feed-client.ts
    src/lib/api/profile-client.ts
  Route Handlers
    src/app/api/**/route.ts
  Services
    src/lib/auth/write-preflight.ts
    src/lib/posts/service/feed-read.ts
  Repositories
    src/lib/posts/repository/*
    src/lib/profiles/repository.ts
    src/lib/profiles/repository/*
    src/lib/blocks/repository.ts
  Supabase
    supabase/migrations/*.sql
```

## 3. 핵심 책임 경계

- 화면 컴포넌트는 조합과 사용자 상호작용만 담당한다.
- 화면 상태/흐름은 `src/lib/hooks/*` 에서 관리한다.
- 클라이언트 요청 dedupe, TTL cache, force refresh는 `src/lib/api/request-cache.ts` 기반으로 맞춘다.
- Route Handler는 입력 검증, 응답 계약, service 호출만 담당한다.
- 인증/익명 쓰기 quota/profile ensure/activity touch는 `src/lib/auth/write-preflight.ts`를 우선 사용한다.
- DB/RPC 호출은 repository에 모으고, route에서 직접 Supabase 쿼리를 늘리지 않는다.

## 4. 빠르게 읽을 파일

1. `src/components/feed/feed-screen.tsx`
2. `src/lib/hooks/use-feed.ts`
3. `src/lib/hooks/use-feed-polling.ts`
4. `src/lib/posts/service/feed-read.ts`
5. `src/lib/posts/repository/feed-page.ts`
6. `src/lib/posts/repository/feed-metadata.ts`
7. `src/app/api/feed/nearby/route.ts`
8. `src/components/profile/profile-screen.tsx`
9. `src/lib/hooks/use-profile.ts`
10. `src/lib/profiles/repository.ts`
11. `src/lib/profiles/repository/read-profile.ts`
12. `src/lib/auth/write-preflight.ts`

## 5. 피드 읽기 규칙

- 피드 route는 `GET /api/feed/nearby` -> `loadNearbyFeedService()` 흐름을 사용한다.
- `loadNearbyFeedService()`는 다음 세 책임으로 나뉜다.
  - 반경 결정: `resolveFeedRadiusMetersRepository()`
  - 페이지 조회: `listNearbyFeedPageRowsRepository()`
  - 메타데이터 보강: `getFeedPostMetadataBatchRepository()`
- 피드 커서는 `distanceMeters`, `lastActivityAt`, `postId`, `radiusMeters`를 포함한다.
- 첫 페이지에서만 `stateVersion`을 인라인으로 함께 내려 polling 최적화에 사용한다.
- 피드 응답은 더 이상 liker preview를 기본 포함하지 않는다.
- 관련 SQL 분해는 `supabase/migrations/0023_split_feed_read_rpcs.sql`에 있다.

## 6. 프로필 모듈 규칙

- `src/lib/profiles/repository.ts`는 배럴 파일이다.
- 실제 구현은 아래 기능별 파일로 분리되어 있다.
  - `repository/read-profile.ts`
  - `repository/regenerate-nickname.ts`
  - `repository/profile-posts.ts`
  - `repository/profile-likes.ts`
  - `repository/post-likers.ts`
  - `repository/list-common.ts`
- 외부 import는 가능하면 계속 `@/lib/profiles/repository`를 유지한다.

## 7. 쓰기 경로 규칙

- 글 작성, 수집, 신고, 차단/해제 같은 쓰기 경로는 공통적으로 `runWritePreflight()`를 사용한다.
- 옵션 조합:
  - `ensureProfile`
  - `touchActivity`
  - `requireQuota`
  - `includeConsentDetails`
- 새 write route를 만들 때도 같은 규칙을 먼저 고려한다.

## 8. 캐시 규칙

- 공통 캐시 유틸은 `src/lib/api/request-cache.ts`
- 단일 값 캐시: `createSingleValueCache()`
- key 기반 캐시: `createKeyedValueCache()`
- stale response가 최신 force 요청 결과를 덮어쓰지 않도록 request id 보호가 들어 있다.

## 9. 변경 시 주의사항

- `FeedCursor`를 바꾸면 `src/lib/posts/repository/cursor.ts`와 테스트를 같이 수정한다.
- `FeedItem`을 바꾸면 피드 컴포넌트, compose 성공 payload, mock data, 훅 테스트를 같이 본다.
- feed read path를 건드릴 때는 route, service, repository, SQL migration을 한 묶음으로 본다.
- `feed-client.ts` / `profile-client.ts`에 ad-hoc cache를 다시 만들지 않는다.
- `profiles` 경로의 테스트 mock은 배럴 경로를 가정하므로, 경로 변경보다 re-export 유지가 안전하다.

## 10. 권장 검증

1. `npm run typecheck`
2. `npm test -- src/lib/api/feed-client.test.ts src/lib/api/profile-client.test.ts`
3. `npm test -- src/lib/hooks/use-feed.test.tsx src/lib/hooks/use-profile.test.tsx`
4. `npm test -- src/lib/posts/service/feed-read.test.ts src/app/api/feed/nearby/route.test.ts`
5. `npm test -- src/lib/profiles/repository.test.ts src/app/api/profiles/me/route.test.ts`
6. 최종적으로 `npm test`

## 11. 현재 남아 있는 구조적 부채

- DB/RPC와 PRD 사이에는 여전히 `like = 수집` 번역 비용이 존재한다.
- route 이름과 일부 RPC 이름은 여전히 `like` 계열이다.
- `get_feed_post_likers_preview_batch`는 준비돼 있지만 기본 feed route에는 아직 연결하지 않았다.
- 서버/DB 수준에서 `수집` 용어로 전면 정렬하는 작업은 아직 하지 않았다.
