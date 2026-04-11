# ADR: Feed Preview Split

- Date: 2026-04-11
- Status: Accepted

## Context

기존 피드 조회는 `list_nearby_feed` 한 RPC가 다음을 한 번에 처리했다.

- 반경 내 대표 위치 선택
- 정렬/커서
- 원글 메타 계산
- `my_like`, `like_count`
- liker preview 배열 집계

이 구조는 반경이 넓어질수록 SQL 비용과 응답 크기가 함께 커졌다.

## Decision

- 피드 기본 응답에서 liker preview를 제거한다.
- feed read path를 아래처럼 분해한다.
  - `list_nearby_feed_page`
  - `get_feed_post_metadata_batch`
  - `get_feed_post_likers_preview_batch`
- 현재 기본 route는 page + metadata만 사용한다.
- liker preview는 필요할 때 별도 route 또는 lazy fetch로 붙일 수 있도록 준비만 해 둔다.

## Consequences

- 기본 피드 응답 payload가 작아진다.
- 반경 탐색과 페이지 조회가 더 가벼워진다.
- feed card는 기본적으로 작성자 메타 + 본문 + 수집 수만 보여준다.
- 향후 preview 복구가 필요하면 batch preview 경로를 선택적으로 연결하면 된다.
