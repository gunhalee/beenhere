# beenhere 실행 티켓 (2026-04-09)

## 운영 원칙
- 기준 문서: `llm_maintenance_guide.md`
- 공통 준수:
1. 변경 시 `Hook/API/RPC/Type` 계약을 함께 맞춘다.
2. 라우트 응답은 `ok/fail` 형식과 공통 에러코드를 유지한다.
3. 각 티켓 종료 시 `typecheck → test → build`를 순차 실행한다.
4. API/RPC/정렬/권한 규칙 변경 시 문서(`llm_maintenance_guide.md`)를 같은 PR에서 갱신한다.

## 티켓 목록

### BH-001 프로필 닉네임 중복 노출 제거
- 우선순위: P0
- 목표: 프로필 화면 닉네임을 1회만 노출한다.
- 범위:
1. `src/components/profile/profile-screen.tsx`의 헤더 하단 닉네임 영역 제거
- 완료 조건:
1. 상단 헤더 외 닉네임 텍스트가 중복으로 노출되지 않는다.
2. `ProfileHeader` 내 닉네임/메뉴 동작에 영향이 없다.
- 검증:
1. 프로필 진입 UI 수동 확인
2. `npm run typecheck`

### BH-002 get_feed_state RPC 미존재 대응 안정화
- 우선순위: P0
- 목표: `get_feed_state`가 없는 환경에서도 피드가 치명 장애 없이 동작한다.
- 범위:
1. `src/lib/posts/repository/feed-state.ts`에서 RPC 미존재 오류 graceful fallback
2. `src/app/api/feed/state/route.ts` 에러 분기 보강
3. `supabase/migrations/*`에 `get_feed_state`/`refresh_feed_state`/권한 idempotent 보강 migration 추가
- 완료 조건:
1. RPC 부재 시 `/api/feed/state`가 전체 피드 기능을 깨지 않게 처리된다.
2. migration 재적용 시 충돌 없이 안전하게 완료된다.
- 검증:
1. `src/app/api/feed/state/route.test.ts` 보강
2. `GET /api/feed/state` 스모크 확인
3. `npm run typecheck`
4. `npm test`

### BH-003 피드 Pull-to-Refresh 도입
- 우선순위: P1
- 목표: 모바일 피드에서 당겨서 새로고침 UX를 제공한다.
- 범위:
1. `src/components/feed/feed-screen.tsx` 스크롤 컨테이너 제스처 처리
2. 기존 `useFeed().refresh`와 연결
3. 로딩 인디케이터/중복 refresh 가드 추가
- 완료 조건:
1. 상단 당김 제스처로 새로고침이 트리거된다.
2. 기존 retry/loadMore/polling 동작과 충돌하지 않는다.
- 검증:
1. 모바일 뷰포트 수동 테스트
2. `src/lib/hooks/use-feed.test.tsx` 필요한 케이스 추가
3. `npm run typecheck`
4. `npm test`

### BH-004 프로필에서도 거리 일관 노출
- 우선순위: P1
- 목표: 프로필 posts/likes 탭에서 피드와 같은 거리 표기 규칙을 유지한다.
- 범위:
1. 도메인/DB 타입 확장: `src/types/domain.ts`, `src/types/db.ts`
2. 프로필 API 확장: `src/app/api/profiles/[userId]/posts/route.ts`, `src/app/api/profiles/[userId]/likes/route.ts`
3. 프로필 repository 확장: `src/lib/profiles/repository.ts`
4. UI 반영: `src/components/profile/profile-post-item.tsx`, `src/components/profile/profile-like-item.tsx`
5. 필요 시 RPC 변경 migration 추가(`supabase/migrations/*`)
- 완료 조건:
1. 프로필 posts/likes 양쪽 모두 거리 텍스트가 일관되게 노출된다.
2. 좌표 미확보 시 fallback 정책이 피드와 동일하다.
- 검증:
1. API 응답 스키마 테스트 추가
2. 프로필 화면 수동 확인
3. `npm run typecheck`
4. `npm test`

### BH-005 중복 구현 모듈화 (좌표/리프레시/에러 핸들링)
- 우선순위: P1
- 목표: feed/profile/post-actions에 흩어진 중복 로직을 공통 모듈로 정리한다.
- 범위:
1. 좌표 획득/캐시 접근 공통 유틸 또는 hook 추출
2. refresh/retry 에러 메시지 매핑 공통화
3. 호출부(`use-feed`, `use-post-actions`, 필요 시 `use-profile`) 경량화
- 완료 조건:
1. 중복 코드가 제거되고 책임이 분명한 공통 모듈로 이동된다.
2. 기존 동작 회귀가 없다.
- 검증:
1. 훅 단위 테스트 갱신
2. `npm run typecheck`
3. `npm test`

### BH-006 비로그인 디바이스 ID 기반 계정 부여 (정책 전환 1차)
- 우선순위: P0
- 목표: 로그인 전에도 디바이스 기반 guest 계정을 부여해 작성/좋아요를 가능하게 한다.
- 범위:
1. 디바이스 식별자 생성/보관/전달 계약 정의
2. 계정 상태 모델(guest vs linked) 도입
3. 인증/온보딩 분기 재설계: `src/app/auth/*`, `src/app/onboarding/page.tsx`, `middleware.ts`
4. 프로필/피드에서 guest 식별값 사용 가능하도록 API 계약 확장
5. 필요 시 DB schema + migration 추가
- 완료 조건:
1. 미로그인 상태에서도 guest 계정으로 핵심 플로우(작성/좋아요/프로필 진입)가 동작한다.
2. 기존 Google 로그인 계정과 충돌 없이 공존한다.
- 검증:
1. 핵심 API 스모크 재실행
2. E2E 스모크 경로 보강
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

### BH-007 프로필 구글 계정 연동 배너 및 연동 플로우
- 우선순위: P0
- 목표: guest 계정 사용자에게 프로필에서 Google 연동 CTA를 노출하고 연동 완료를 보장한다.
- 범위:
1. `src/components/profile/profile-header.tsx` 또는 `profile-screen.tsx`에 배너/버튼 추가
2. 연동 시작 전 캐시 무효화 규칙 유지: `src/lib/api/profile-client.ts`
3. OAuth 콜백 후 guest 계정과 Google 계정 연계 처리: `src/app/auth/callback/route.ts`
4. 연동 성공/실패 UX 메시지 정리
- 완료 조건:
1. guest 상태에서만 배너가 노출된다.
2. 연동 후 동일 사용자 데이터(닉네임/게시글/좋아요)가 끊기지 않는다.
- 검증:
1. 로그인/연동 수동 시나리오 테스트
2. 관련 route test 추가
3. `npm run typecheck`
4. `npm test`

### BH-008 트래픽 부하 저감 장치 도입
- 우선순위: P1
- 목표: 읽기/쓰기 트래픽을 줄이고 피크 시간 안정성을 높인다.
- 범위:
1. 클라이언트 dedupe/TTL 캐시 범위 재점검(`feed-client`, `profile-client`, hooks)
2. 상태 polling 백오프 튜닝(`use-visible-polling`, `use-feed`)
3. 쓰기 API 레이트 리밋 전략 도입(좋아요/작성/신고)
4. timeout/fallback 규칙 점검 및 공통 코드화
- 완료 조건:
1. 중복 요청 수가 감소한다.
2. timeout 시 UX가 깨지지 않고 복구 가능하다.
- 검증:
1. route/hook 테스트 추가
2. 런타임 로그 관측 포인트 정리
3. `npm run typecheck`
4. `npm test`

### BH-009 통합 검증 및 문서 동기화
- 우선순위: P0
- 목표: 정책/계약 변경 사항을 테스트와 문서에 완전 반영한다.
- 범위:
1. `llm_maintenance_guide.md` 업데이트
2. API smoke checklist 실행
3. 기존 테스트 + E2E smoke 점검
- 완료 조건:
1. 새 정책(guest 계정, 연동, 거리 일관성)이 문서에 반영된다.
2. CI 기준(`typecheck/test/build`) 통과 상태가 확보된다.
- 검증:
1. `npm run typecheck`
2. `npm test`
3. `npm run build`
4. `npm run test:e2e` (필요 시)

## 권장 실행 순서
1. BH-001
2. BH-002
3. BH-003
4. BH-004
5. BH-005
6. BH-006
7. BH-007
8. BH-008
9. BH-009

## 마일스톤 제안
- M1 안정화: BH-001~BH-003
- M2 일관성/구조개선: BH-004~BH-005
- M3 정책 전환: BH-006~BH-007
- M4 성능/운영 마감: BH-008~BH-009


---

## 2026-04-09 Execution Closeout (BH-009)

- Scope closed:
  - BH-001 through BH-009
- Verification evidence:
  - `npm run typecheck` passed
  - `npm test` passed (`22 files / 121 tests`)
  - `npm run build` passed
  - `npm test -- src/app/api` passed (`9 files / 48 tests`)
  - `npm run test:e2e` passed (`e2e/smoke.spec.ts`, 2/2)
- Final notes:
  - BH-008 traffic-relief controls are included:
    - feed read dedupe + short state TTL cache
    - polling backoff failure signal (`onTick -> false`)
    - single retry for retryable write failures
    - idempotent create-post key path (`clientRequestId` + DB/RPC support)
