# LLM Maintenance Guide ??beenhere

- Last updated: 2026-04-09 (KST)
- Source of truth: `beenhere_prd.md`, `src/*`, `supabase/migrations/*`
- Audience: ???덊룷瑜??좎?蹂댁닔/由ы뙥?곕쭅?섎뒗 LLM ?먯씠?꾪듃
- Goal: ?쒖뼱?붾? 怨좎튂硫?臾댁뾿??源⑥??붿??앸? 鍮좊Ⅴ寃??뚯븙?섍퀬 ?덉쟾?섍쾶 蹂寃쏀븯湲?
## 1) ?쒗뭹 遺덈? 洹쒖튃 (PRD 湲곕컲)

?꾨옒 洹쒖튃? 肄붾뱶 由ы뙥?곕쭅 ?쒖뿉???좎??섏뼱???쒕떎.

1. 湲? ?μ냼??臾띠씤??
1. ?쇱씠?щ뒗 ??긽 ?ш났?????꾩튂 ?앹꽦)瑜??섎컲?쒕떎.
1. ?볤?/?붾줈???뚮┝/異붿쿇 ?쇰뱶???녿떎.
1. ?쇰뱶??嫄곕━ ?곗꽑 ?뺣젹?대ŉ(?숈씪 嫄곕━沅뚯? 理쒖떊 ?쒕룞 ?곗꽑), ?숈씪 湲? ??踰덈쭔 ?몄텧?쒕떎.
1. 湲 ?쒖꽦 湲곌컙? 湲 ?⑥쐞(`active_until`)濡?愿由щ릺怨??쇱씠????30???곗옣?쒕떎.
1. 李⑤떒? ?묐갑???몄텧 李⑤떒 ?④낵瑜?留뚮뱺??
1. ?묒꽦???꾩슜 ?쇱씠而?紐⑸줉? ?묒꽦?먮쭔 ?묎렐 媛?ν븯??

?듭떖 怨꾩빟 援ы쁽 ?꾩튂:

- DB/RPC: `supabase/migrations/0001_initial_schema.sql`, `0002_rpc_functions.sql`
- ?쒕쾭 API: `src/app/api/**/route.ts`
- ?대씪?댁뼵???? `src/lib/hooks/use-feed.ts`, `use-post-actions.ts`, `use-profile.ts`

## 2) ?쒖뒪???꾪궎?띿쿂 留?
```text
Next.js App Router
?쒋? UI Screen (Client)
?? ?쒋? src/components/feed/feed-screen.tsx
?? ?붴? src/components/profile/profile-screen.tsx
?쒋? Hooks (Client State / Orchestration)
?? ?쒋? src/lib/hooks/use-feed.ts
?? ?쒋? src/lib/hooks/use-post-actions.ts
?? ?쒋? src/lib/hooks/use-profile.ts
?? ?붴? src/lib/hooks/use-profile-context.ts
?쒋? Client API Adapter
?? ?쒋? src/lib/api/client.ts (fetchApi 怨듯넻 ?섑띁)
?? ?쒋? src/lib/api/feed-client.ts
?? ?붴? src/lib/api/profile-client.ts
?쒋? Route Handlers (Server)
?? ?붴? src/app/api/**/route.ts
?쒋? Domain/Repository Layer
?? ?쒋? src/lib/posts/*
?? ?쒋? src/lib/profiles/repository.ts
?? ?붴? src/lib/blocks/repository.ts
?붴? Supabase (Schema + RPC + RLS)
   ?붴? supabase/migrations/*.sql
```

?덉씠??洹쒖튃:

- UI/?낆? DB Row瑜?吏곸젒 ?ㅻ（吏 ?딅뒗?? `src/types/domain.ts` ??낆쓣 ?ъ슜?쒕떎.
- Route Handler??`ok/fail` ?묐떟 ?뺤떇???좎??쒕떎 (`src/lib/api/response.ts`).
- ?ㅽ듃?뚰겕 ?몄텧? `fetchApi`瑜??듯빐?쒕쭔 ?쒕떎 (`src/lib/api/client.ts`).
- ?섏씠吏?ㅼ씠??紐⑸줉? `usePaginatedList`瑜??곗꽑 ?ъ궗?⑺븳??

## 2.1) 癒쇱? ?쎌쓣 ?뚯씪 (Quick Start)

?묒뾽 ?쒖옉 ?꾩뿉 ?꾨옒 ?뚯씪遺???쎌쑝硫??꾩옱 援ъ“瑜?媛??鍮⑤━ ?≪쓣 ???덈떎.

1. `src/components/feed/feed-screen.tsx` (?쇰뱶 ?붾㈃ 議곕┰)
1. `src/lib/hooks/use-feed.ts` (?꾩튂 湲곕컲 ?쇰뱶 ?앸챸二쇨린)
1. `src/lib/hooks/use-post-actions.ts` (?쇱씠????젣/?좉퀬 怨듯넻 ?≪뀡)
1. `src/components/profile/profile-screen.tsx` (?꾨줈???붾㈃ 議곕┰)
1. `src/lib/hooks/use-profile.ts` + `use-profile-context.ts` (?꾨줈???곗씠???ㅼ??ㅽ듃?덉씠??
1. `src/app/api/feed/nearby/route.ts` + `src/lib/posts/repository/feed.ts` (?쇰뱶 議고쉶 ?쒕쾭 ?먮쫫)
1. `src/app/api/feed/state/route.ts` + `src/lib/posts/repository/feed-state.ts` (寃쎈웾 ?쇰뱶 ?곹깭 踰꾩쟾 議고쉶)
1. `supabase/migrations/0002_rpc_functions.sql` (`list_nearby_feed`, `like_post` ???듭떖 RPC)

## 3) ?고????뚮줈??
### 3.1 ?쇰뱶 議고쉶

1. `FeedScreen` ??`useFeed` 留덉슫??1. 理쒓렐 醫뚰몴 罹먯떆媛 ?덉쑝硫??곗꽑 ?ъ슜??`/api/feed/nearby` 利됱떆 ?몄텧
1. 釉뚮씪?곗? ?꾩튂 ?ы솗??`getCurrentBrowserCoordinates`)? 吏㏃? timeout?쇰줈 諛깃렇?쇱슫??媛깆떊
1. ?쒕쾭?먯꽌 `list_nearby_feed` RPC ?몄텧
1. ?쒕쾭?먯꽌 `get_feed_state`濡??곹깭 踰꾩쟾(`stateVersion`)???④퍡 諛섑솚
1. 嫄곕━??+ 以묐났 ?쒓굅???꾩씠?쒖쓣 `FeedItem`?쇰줈 蹂?섑빐 ?뚮뜑
1. ?대씪?댁뼵??polling? `/api/feed/state`瑜?癒쇱? 議고쉶?섍퀬 踰꾩쟾 蹂寃??쒖뿉留?`/api/feed/nearby` ?ъ“??
?듭떖 ?뚯씪:

- `src/components/feed/feed-screen.tsx`
- `src/lib/hooks/use-feed.ts`
- `src/app/api/feed/nearby/route.ts`
- `src/app/api/feed/state/route.ts`
- `src/lib/posts/repository/feed.ts`
- `src/lib/posts/repository/feed-state.ts`
- `supabase/migrations/0002_rpc_functions.sql` (`list_nearby_feed`)
- `supabase/migrations/0008_feed_state_refresh.sql` (`get_feed_state`, `refresh_feed_state`)

### 3.2 湲 ?묒꽦

1. ?묒꽦 踰꾪듉 ?대┃
1. `coordsRef`/醫뚰몴 罹먯떆媛 ?덉쑝硫?利됱떆 ?쒗듃 ?ㅽ뵂 (?놁쑝硫?吏㏃? timeout?쇰줈 醫뚰몴 ?띾뱷)
1. `ComposeSheet`??利됱떆 ?몄쭛 媛???곹깭濡??닿퀬, ?μ냼 ?쇰꺼 ?댁꽍? 諛깃렇?쇱슫??鍮꾨룞湲?媛깆떊
1. `/api/posts` ?몄텧
1. ?쒕쾭?먯꽌 `create_post` RPC ?몄텧
1. ?깃났 ???쇰뱶 ?곷떒???숆????꾩씠??prepend

?듭떖 ?뚯씪:

- `src/components/feed/compose-sheet.tsx`
- `src/app/api/posts/route.ts`
- `src/lib/posts/mutations.ts`
- `src/lib/posts/repository/mutations.ts` (`createPostRepository`)
- RPC: `create_post`

### 3.3 ?쇱씠??=?ш났??

1. `usePostActions.handleLike` 吏꾩엯
1. 醫뚰몴 ?뺣낫(`coordsRef` ??醫뚰몴 罹먯떆 ??釉뚮씪?곗? 議고쉶 ?쒖꽌)
1. `resolveLikePlaceLabel` (怨듯넻 罹먯떆 + in-flight dedupe)
1. ?숆????낅뜲?댄듃 (`myLike=true`, `likeCount+1`)
1. `/api/posts/:postId/like` ?몄텧
1. ?쒕쾭?먯꽌 `like_post` RPC ?몄텧
1. ?ㅽ뙣 ??rollback

?듭떖 ?뚯씪:

- `src/lib/hooks/use-post-actions.ts`
- `src/app/api/posts/[postId]/like/route.ts`
- `src/lib/posts/mutations.ts` (`LIKE_RPC_ERROR_MAP`)
- RPC: `like_post`

### 3.4 ?꾨줈??
1. `/profile/[userId]` 吏꾩엯
1. `useProfileContext`: 怨듦컻 ?꾨줈???묐떟???곗꽑 諛섏쁺??`ready` ?꾪솚, ???꾨줈???뺣낫???꾪뻾 媛깆떊
1. `useProfile`: 珥덇린?먮뒗 `posts`留?濡쒕뱶?섍퀬 `likes`????吏꾩엯 ??理쒖큹 1??吏??濡쒕뱶
1. ???꾨줈?꾩씪 ?뚮쭔 ?쇱씠而?紐⑸줉 ?좉?/議고쉶 媛??
?듭떖 ?뚯씪:

- `src/components/profile/profile-screen.tsx`
- `src/lib/hooks/use-profile-context.ts`
- `src/lib/hooks/use-profile.ts`
- API: `/api/profiles/*`, `/api/posts/:postId/likers`
- RPC: `get_profile_posts`, `get_profile_likes`, `get_post_likers`

### 3.5 李⑤떒

1. ?꾨줈??硫붾돱?먯꽌 李⑤떒/?댁젣
1. `/api/blocks` ?먮뒗 `/api/blocks/:userId`
1. `blocks` ?뚯씠釉?諛섏쁺
1. feed/profile RPC 荑쇰━?먯꽌 李⑤떒 愿怨??꾪꽣留?
?듭떖 ?뚯씪:

- `src/components/profile/profile-block-dialog.tsx`
- `src/app/api/blocks/route.ts`
- `src/app/api/blocks/[userId]/route.ts`
- `src/lib/blocks/repository.ts`

## 4) API ??RPC 怨꾩빟 ??
| API | ?쒕쾭 ?≪뀡 | RPC/?뚯씠釉?| 鍮꾧퀬 |
|---|---|---|---|
| `GET /api/feed/nearby` | 二쇰? ?쇰뱶 議고쉶 | `list_nearby_feed` | 10km 諛섍꼍, 以묐났 ?쒓굅, 李⑤떒 ?꾪꽣 |
| `GET /api/feed/state` | ?쇰뱶 ?곹깭 踰꾩쟾 議고쉶 | `get_feed_state`, `feed_state` | 寃쎈웾 polling ?⑸룄 |
| `GET /api/internal/feed/state/refresh` | ?쇰뱶 ?곹깭 二쇨린 媛깆떊 | `refresh_feed_state`, `feed_state` | cron ?꾩슜(鍮꾨????꾩슂) |
| `GET /api/internal/moderation/reports` | ?좉퀬 紐⑸줉 議고쉶(?댁쁺?먯슜) | `reports`, `posts`, `profiles` | ?대? 愿由ъ옄 API, 鍮꾨????꾩슂 |
| `POST /api/internal/moderation/reports/:reportId/hide` | ?좉퀬 湲곗? 寃뚯떆臾?鍮꾨끂異?| `posts.status='hidden'` | ?대? 愿由ъ옄 API, 鍮꾨????꾩슂 |
| `POST /api/posts` | 湲 ?앹꽦 | `create_post` | content 1~300 |
| `POST /api/posts/:postId/like` | ?쇱씠???ш났??| `like_post` | 以묐났 ?쇱씠???먭린 湲 ?쇱씠??諛⑹? |
| `DELETE /api/posts/:postId` | 湲 ??젣 | `delete_post` | status=`deleted` |
| `POST /api/posts/:postId/report` | ?좉퀬 | `report_post` | 以묐났 ?좉퀬 `ON CONFLICT DO NOTHING` |
| `GET /api/profiles/:userId/posts` | ?묒꽦湲 | `get_profile_posts` | 李⑤떒 愿怨???鍮?寃곌낵 |
| `GET /api/profiles/:userId/likes` | ?쇱씠?ш? | `get_profile_likes` | 李⑤떒 愿怨???鍮?寃곌낵 |
| `GET /api/posts/:postId/likers` | ?쇱씠而?紐⑸줉 | `get_post_likers` | ?묒꽦???꾩슜 |

## 5) ?몄쬆/沅뚰븳/?섍꼍

### 5.1 Auth ?먮쫫

- 濡쒓렇???섏씠吏: `src/app/auth/login/page.tsx`
- 肄쒕갚: `src/app/auth/callback/route.ts`
- ?⑤낫??由щ떎?대젆?? ?꾨줈???놁쑝硫?`/onboarding`
- 誘몃뱾?⑥뼱 蹂댄샇 寃쎈줈: ?꾩옱 `/onboarding`留?媛뺤젣 ?몄쬆 (`middleware.ts`)

### 5.2 Supabase ?ㅼ젙 紐⑤뱶

- `hasSupabaseBrowserConfig() === false`硫??쇰? API/由ы룷吏?좊━媛 mock fallback?쇰줈 ?숈옉?쒕떎.
- 利? 濡쒖뺄?먯꽌 ?섍꼍蹂?섍? 鍮꾩뼱 ?덉쑝硫?湲곕뒫???쒕릺??寃껋쿂??蹂댁씪?????덈떎.
- ?ㅼ꽌鍮꾩뒪 ?숈옉 寃利앹? 諛섎뱶??Supabase ?곌껐 ?곹깭?먯꽌 ?뺤씤?쒕떎.

?꾩닔 env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (?쒕쾭 ?꾩슜)
- `KAKAO_REST_API_KEY` (????ㅼ퐫??
- `CRON_SECRET` (?대? cron refresh ?붾뱶?ъ씤??蹂댄샇)
- `MODERATION_SECRET` (?대? moderation ?붾뱶?ъ씤??蹂댄샇)

### 5.3 理쒓렐 ?깅뒫/?덉젙??寃곗젙

?꾨옒 ??ぉ? ?꾩옱 肄붾뱶媛 梨꾪깮?섍퀬 ?덈뒗 ?덉젙???ъ씤?몃떎.

1. ?대씪?댁뼵??API 湲곕낯 timeout 8珥?(`src/lib/api/client.ts`)
1. 醫뚰몴 ?뚯떛 怨듯넻?붾줈 ?쇱슦??寃利??쇨????좎? (`src/lib/api/coordinates.ts`)
1. ?쇰뱶 珥덇린 吏꾩엯 ??理쒓렐 醫뚰몴 罹먯떆 ?곗꽑 濡쒕뱶 + 諛깃렇?쇱슫???ы솗??(`use-feed.ts`, `browser-location.ts`)
1. ?묒꽦 ?쒗듃??geocoding ?꾨즺瑜?湲곕떎由ъ? ?딄퀬 利됱떆 ?몄쭛 媛??(`compose-sheet.tsx`)
1. ?μ냼 ?쇰꺼 ?댁꽍 怨듯넻 罹먯떆濡?以묐났 geocoding 媛먯냼 (`place-label-cache.ts`, `use-post-actions.ts`, `compose-sheet.tsx`)
1. ?섏씠吏?ㅼ씠??濡쒖쭅 怨듯넻??(`use-paginated-list.ts`)
1. visibility 湲곕컲 backoff polling ?좏떥 蹂댁쑀 (`use-visible-polling.ts`)  
?꾩옱 ?듭떖 ?붾㈃?먯꽌 ?곸떆 ?ъ슜 以묒? ?꾨땲吏留? polling ?꾩엯 ??`setInterval` ??????좏떥???곗꽑 ?ъ슜?쒕떎.
1. ?쇰뱶 polling? `/api/feed/state` 踰꾩쟾 鍮꾧탳 ??蹂寃??쒖뿉留?`/api/feed/nearby` ?ъ“?뚰븳??(`use-feed.ts`)
1. ?쒕쾭 二쇨린 媛깆떊? `vercel.json` cron ??`/api/internal/feed/state/refresh` 寃쎈줈濡??섑뻾?쒕떎.
1. timeout? ?붿껌 ?깃꺽蹂꾨줈 遺꾨━?쒕떎 (`feed-client.ts`, `profile-client.ts`, `reverse-geocode.ts`)  
   `state polling` 1.2s, `feed/profile read` 3s, `write` 5s, `reverse geocode` 2.5s
1. polling tick?먯꽌 `/api/feed/state` ?ㅽ뙣(`TIMEOUT_STATE`) ???대떦 tick??利됱떆 醫낅즺?섍퀬 full feed fallback???몄텧?섏? ?딅뒗??
1. `/api/feed/nearby`, `/api/feed/state`, `/api/internal/feed/state/refresh`???쒕쾭痢?hard-timeout?쇰줈 504 ?묐떟??議곌린 諛섑솚?쒕떎.

## 6) ?뚯뒪??諛?CI 湲곗?

?꾩옱 ?뚯뒪??踰붿쐞:

- `src/lib/hooks/use-feed.test.tsx`
- `src/lib/hooks/use-post-actions.test.tsx`
- `src/lib/hooks/use-profile.test.tsx`
- `src/lib/hooks/use-profile-context.test.tsx`

CI:

- `.github/workflows/ci.yml`
- `npm ci` ??`npm run typecheck` ??`npm test` ??`npm run build`

濡쒖뺄 沅뚯옣 寃利??쒖꽌:

1. `npm run typecheck`
1. `npm test`
1. `npm run build`

## 6.1) API Smoke ?뚯뒪????
?듭떖 寃쎈줈瑜?鍮좊Ⅴ寃??뚭? ?뺤씤???뚮뒗 ?꾨옒 ?쒖꽌媛 ?덉쟾?섎떎.

1. `GET /api/feed/nearby?latitude=37.5&longitude=127.0`
1. `GET /api/feed/state`
1. `GET /api/profiles/me` (鍮꾨줈洹몄씤 ??`UNAUTHORIZED` ?먮뒗 mock ?묐떟 ?뺤씤)
1. `GET /api/profiles/{userId}` / `.../posts` / `.../likes`
1. `GET /api/geo/reverse?lat=37.5&lng=127.0` (`KAKAO_REST_API_KEY` ?꾩슂)
1. ?몄쬆 ?곹깭?먯꽌 `POST /api/posts`, `POST /api/posts/{postId}/like`, `POST /api/posts/{postId}/report`
1. ?묒꽦??怨꾩젙?쇰줈 `GET /api/posts/{postId}/likers` ?묎렐 ?쒖뼱 ?뺤씤

二쇱쓽:

1. Supabase 誘몄꽕??mock)怨?Supabase ?ㅼ젙(real)?먯꽌 寃곌낵媛 ?ㅻ? ???덉쑝???????뺤씤?쒕떎.
1. mock 紐⑤뱶??id???ㅼ젣 UUID媛 ?꾨땺 ???덉쑝誘濡?UUID ?щ㎎ 寃利앹쓣 怨쇳븯寃??먯? ?딅뒗??
1. route ?먮윭 硫붿떆吏??PowerShell 肄섏넄?먯꽌 ?쒓???源⑥졇 蹂댁뿬???ㅼ젣 API ?묐떟 JSON??湲곗??쇰줈 ?뺤씤?쒕떎.

## 7) 蹂寃??묒뾽 ?뚮젅?대턿 (LLM??

### 7.1 ?쇱씠????젣/?좉퀬 濡쒖쭅 蹂寃?
諛섎뱶??媛숈씠 ?뺤씤:

1. `src/lib/hooks/use-post-actions.ts` (?숆????낅뜲?댄듃/rollback/UI ?먮윭)
1. `src/lib/api/feed-client.ts` (?붿껌 ?ㅽ궎留?
1. `src/app/api/posts/*` (?좏슚???몄쬆/?묐떟肄붾뱶)
1. `src/lib/posts/mutations.ts` (?먮윭肄붾뱶 留ㅽ븨)
1. `supabase/migrations/*` (RPC ?쒓렇?덉쿂/洹쒖튃)

### 7.2 Feed Ordering / Cursor Rules
?? ?????:

1. RPC `list_nearby_feed`
1. `src/lib/posts/repository/feed.ts` (cursor encode/decode, limit+1)
1. `src/types/domain.ts` (`FeedCursor`/`FeedItem`)
1. `src/lib/hooks/use-feed.ts` (pagination behavior)
1. `src/app/api/feed/nearby/route.ts` (`INVALID_CURSOR` 400 ??)
1. `supabase/migrations/0009_list_nearby_feed_tiebreaker.sql` (?? ?? tie-break)

## 8) Feed State Freshness (2026-04-09)

- `create_post`, `like_post`, `delete_post` ?? ?? `refreshFeedStateBestEffort`? ??? `feed_state.version`? ??? ?????.
- ??? ???(`POST /api/internal/moderation/reports/:reportId/hide`) ?? ??? `refreshFeedStateBestEffort`? ??? ?? ???? ???.
- `vercel.json`? cron + `/api/internal/feed/state/refresh`? ???(backstop)?? ????.

### 7.3 ?꾨줈????紐⑸줉 洹쒖튃 蹂寃?
諛섎뱶??媛숈씠 ?뺤씤:

1. `src/lib/hooks/use-profile.ts`
1. `src/components/profile/profile-tabs.tsx`
1. `src/components/profile/profile-screen.tsx`
1. `/api/profiles/*`, `/api/posts/:postId/likers`
1. RPC `get_profile_posts`, `get_profile_likes`, `get_post_likers`

### 7.4 ?됰꽕???뺤콉 蹂寃?荑⑤떎???뺤떇)

諛섎뱶??媛숈씠 ?뺤씤:

1. `src/lib/nickname/generate.ts` (?앹꽦 + 荑⑤떎??
1. `src/lib/profiles/repository.ts` (`regenerateNicknameRepository`)
1. `src/app/api/profiles/me/route.ts` (PATCH ?묐떟 諛?details)
1. `src/components/profile/profile-header.tsx` (?먮윭 硫붿떆吏 ?쒖떆)

### 7.5 ?좉퀬/?댁쁺??鍮꾨끂異?泥섎━ 蹂寃?
諛섎뱶??媛숈씠 ?뺤씤:

1. `src/app/api/posts/[postId]/report/route.ts` (?좉퀬 ?묒닔)
1. `src/app/api/internal/moderation/reports/route.ts` (?댁쁺??紐⑸줉 議고쉶)
1. `src/app/api/internal/moderation/reports/[reportId]/hide/route.ts` (鍮꾨끂異?泥섎━)
1. `src/lib/moderation/repository.ts` (service_role 湲곕컲 泥섎━)
1. `src/lib/posts/repository/mutations.ts` (`report_post` RPC ?몄텧)

## 8) ?먯＜ 諛쒖깮?섎뒗 ?ㅼ닔

1. `fetch`瑜?吏곸젒 ?몄텧??`ok/fail` ?묐떟 怨꾩빟??源⑥쭚  
   ?닿껐: `fetchApi`留??ъ슜.
1. ?섏씠吏?ㅼ씠??而ㅼ꽌 ?뺣젹?ㅻ? 諛붽엥?붾뜲 encode/decode瑜???留욎땄  
   ?닿껐: cursor ??낃낵 SQL ORDER 議곌굔???명듃濡?蹂寃?
1. ?낆뿉???숆????낅뜲?댄듃留??섍퀬 ?ㅽ뙣 rollback ?꾨씫  
   ?닿껐: `removeItemOptimistic` + `restoreRemovedItem` ?⑦꽩 ?좎?.
1. mock 紐⑤뱶?먯꽌留?寃利앺븯怨?Supabase ?곌껐 寃利??꾨씫  
   ?닿껐: env 梨꾩슫 ?곹깭?먯꽌 API/RPC源뚯? ?뺤씤.
1. SQL ?⑥닔?먯꽌 諛섑솚 而щ읆紐낃낵 濡쒖뺄 而щ읆紐?異⑸룎  
   ?닿껐: CTE/SELECT?먯꽌 alias瑜?紐낆떆?곸쑝濡??ъ슜(`fr.post_id` ?⑦꽩).
1. PowerShell?먯꽌 ?쒓???源⑥졇 蹂댁뿬 ?뚯씪 ?먯껜媛 ?먯긽?먮떎怨??ㅽ뙋  
   ?닿껐: 釉뚮씪?곗? ?뚮뜑留?JSON ?묐떟/?ㅼ젣 ?뚯씪 UTF-8 ?댁슜??湲곗??쇰줈 ?먮떒.

## 9) ?꾩옱 湲곗닠 遺梨?媛쒖꽑 ?꾨낫

1. ?뚯뒪?멸? ??以묒떖?대씪 API ?쇱슦??由ы룷吏?좊━ ?듯빀 ?뚯뒪?멸? 遺議깊븯??
1. E2E(濡쒓렇???묒꽦-?쇱씠???꾨줈???먯깋) 寃쎈줈 ?먮룞?붽? ?녿떎.
1. ?꾨줈?????꾪솚 ??likes 理쒖큹 濡쒕뱶 援ш컙??泥닿컧(濡쒕뵫 ?쒖떆/?ъ떆??UX) 誘몄꽭 理쒖쟻???ъ?媛 ?덈떎.
1. ?꾩튂/????ㅼ퐫???ㅽ뙣 ??UX 臾멸뎄 遺꾩궛 媛?μ꽦???덉뼱 硫붿떆吏 ?곸닔???ъ?媛 ?덈떎.

## 10) LLM ?묒뾽 泥댄겕由ъ뒪??(PR ??

1. 蹂寃?踰붿쐞媛 ?쒗뭹 遺덈? 洹쒖튃??源⑥? ?딅뒗吏 ?뺤씤
1. API ?붿껌/?묐떟 ???`src/types/api.ts`) ?숆린??1. ?꾨찓?????`src/types/domain.ts`) ?숆린??1. ?꾩슂??寃쎌슦 SQL migration 異붽? (?⑥닔 ?쒓렇?덉쿂 蹂寃????꾩닔)
1. ???뚯뒪??異붽?/?섏젙
1. `typecheck/test/build` ?듦낵 ?뺤씤
1. 蹂寃??댁슜??留욌뒗 臾몄꽌(PRD ?먮뒗 ??媛?대뱶) 媛깆떊

## 11) 臾몄꽌 ?낅뜲?댄듃 ?몃━嫄?
?꾨옒 蹂寃쎌씠 諛쒖깮?섎㈃ ??臾몄꽌??媛숈? PR?먯꽌 ?④퍡 ?섏젙?쒕떎.

1. ?듭떖 ?쇱슦??異붽?/??젣 (`/api/feed`, `/api/posts`, `/api/profiles`, `/api/blocks`, `/api/geo`)
1. cron/?대? ?쇱슦??異붽?/蹂寃?(`/api/internal/*`, `vercel.json`)
1. ?듭떖 ??梨낆엫 蹂寃?(`use-feed`, `use-post-actions`, `use-profile`)
1. RPC ?쒓렇?덉쿂/沅뚰븳/RLS ?뺤콉 蹂寃?(`supabase/migrations/*`)
1. ?섏씠吏?ㅼ씠???뺣젹/?몄텧 洹쒖튃 蹂寃?(嫄곕━쨌以묐났쨌?쒖꽦湲곌컙쨌李⑤떒)
1. 寃利??뚯씠?꾨씪??蹂寃?(`typecheck/test/build`, CI workflow)

---

??臾몄꽌???쒗쁽 釉뚮옖移?肄붾뱶 ?곹깭?앸? 湲곗??쇰줈 ?묒꽦?섏뿀??  
?洹쒕え 援ъ“ 蹂寃??꾩뿉??諛섎뱶??`?꾪궎?띿쿂 留?, `?뚮줈??, `?뚮젅?대턿` ?뱀뀡??媛숈씠 ?낅뜲?댄듃?쒕떎.

## 12) Nickname Cooldown Sync (2026-04-09)

- `PATCH /api/profiles/me` success payload must include both `nickname` and server `nicknameChangedAt`.
- UI must use server `nicknameChangedAt` (not `new Date()` from client) when updating local cooldown state.
- Cooldown rejection details should continue to return `daysRemaining` for deterministic UX copy.

## 13) Profile Tab Reset Rules (2026-04-09)

- On `userId` change, `useProfile` must reset tab to `posts`.
- On `userId` change, clear `expandedLikersId` and `likersMap` to avoid stale cross-profile cache.
- Keep `likes` lazy-loading policy: first load only when entering `likes` tab.

## 14) My Profile Request Dedupe (2026-04-09)

- `fetchMyProfileClient` uses short TTL cache and in-flight dedupe to prevent duplicate `/api/profiles/me` calls across screens.
- `FeedScreen` skips `/api/profiles/me` fetch when `currentUserId` and `currentNickname` are already resolved.
- After nickname regeneration success, update local my-profile cache so downstream UI reads a consistent nickname/cooldown state.

## 15) Public Profile Request Dedupe (2026-04-09)

- `fetchProfileClient(userId)` also uses short TTL cache and per-user in-flight dedupe.
- Cache is keyed by `userId`; different profile IDs never share cached payloads.
- Provide cache clear helpers for deterministic test setup and explicit invalidation scenarios.

## 16) Profile Cache Invalidation (2026-04-09)

- Clear both caches when logout starts (`/auth/logout` entry from profile menu).
- Clear both caches before starting OAuth login to avoid cross-account stale identity.
- Clear both caches after onboarding profile creation succeeds before redirecting home.
- If `/api/profiles/me` returns `UNAUTHORIZED`, clear both caches immediately.

## 17) Force-Fresh Viewer Context (2026-04-09)

- `useProfileContext` must call `fetchMyProfileClient({ force: true })` when resolving viewer context on profile entry.
- Reason: `isMyProfile` and `nicknameChangedAt` directly affect permission/cooldown UI and should prefer correctness over short-lived cache reuse.
- `FeedScreen` keeps cached read behavior for responsiveness; apply force-fresh only at correctness-critical points.

## 18) Cache Race Safety (2026-04-09)

- `fetchMyProfileClient` and `fetchProfileClient` must ignore stale in-flight responses when a newer request has already replaced the current in-flight handle.
- `clearMyProfileCache` / `clearProfileCache(userId)` should invalidate pending results by removing the in-flight handle; late responses from invalidated requests must not repopulate cache.
- Keep regression tests for:
  - stale-old + force-new overlap (new wins)
  - clear-while-pending invalidation (late stale result ignored)

## 19) Hook Over-Fetch Guards (2026-04-09)

- `usePostActions.handleLike` must acquire `likePendingRef` before awaiting geolocation/geocoding to block rapid double-tap duplicate requests.
- `useProfile.toggleLikers` must dedupe per-post in-flight fetches to prevent concurrent duplicate `fetchPostLikersClient(postId)` calls.
- Keep unit tests for both race shapes:
  - concurrent `handleLike` before coordinates resolve
  - concurrent `toggleLikers` for same `postId`

## 20) API Route Integration Coverage (2026-04-09)

- Added route-level integration tests (Request/Response contract + dependency boundary mocks):
  - `src/app/api/posts/[postId]/like/route.test.ts`
  - `src/app/api/feed/nearby/route.test.ts`
- Verified key branches:
  - validation failure (`INVALID_REQUEST`, `INVALID_LOCATION`, `VALIDATION_ERROR`, `INVALID_CURSOR`)
  - success payload shape (`ok: true`, expected `data`)
  - domain failure pass-through (`status` + `code`)
  - graceful fallback (`feed-state` read failure still returns nearby feed success)
  - internal failure path (`INTERNAL_ERROR`)

## 21) E2E Smoke Baseline (2026-04-09)

- Added Playwright smoke suite:
  - `playwright.config.ts`
  - `e2e/smoke.spec.ts`
- Added scripts:
  - `npm run test:e2e`
  - `npm run test:e2e:headed`
- Added CI workflow:
  - `.github/workflows/e2e-smoke.yml`
- Split test domains to avoid runner conflict:
  - `vitest` now includes only `src/**/*.test.ts(x)` and excludes `e2e/**`.

## 22) API Error Contract Standardization (2026-04-09)

- Expanded `src/lib/api/common-errors.ts` as the single source of truth for shared error codes:
  - `INVALID_LOCATION`, `INVALID_CURSOR`, `FORBIDDEN`, `NOT_FOUND`, `REPORT_NOT_FOUND`, `POST_NOT_FOUND` (plus existing common codes).
  - reverse-geocode domain codes: `GEOCODE_NOT_CONFIGURED`, `GEOCODE_AUTH_FAILED`, `GEOCODE_RATE_LIMITED`, `GEOCODE_FAILED`, `GEOCODE_TIMEOUT`, `GEOCODE_ERROR`.
- Standardized route-handler usage to reference shared constants instead of repeating string literals in:
  - `src/app/api/blocks/*`
  - `src/app/api/posts/*`
  - `src/app/api/feed/*`
  - `src/app/api/geo/reverse/route.ts`
  - `src/app/api/internal/*`
  - `src/app/api/profiles/[userId]/*`
- Standardized auth-required responses to use:
  - `API_ERROR_MESSAGE.AUTH_REQUIRED`
  - `API_ERROR_CODE.UNAUTHORIZED`
- Standardized JSON parse failure path in `src/lib/api/request.ts` to use:
  - `API_ERROR_MESSAGE.INVALID_REQUEST`
  - `API_ERROR_CODE.INVALID_REQUEST`
- Added/kept route integration tests validating code-level contract behavior:
  - `src/app/api/profiles/me/route.test.ts`
  - `src/app/api/posts/[postId]/like/route.test.ts`
  - `src/app/api/feed/nearby/route.test.ts`
  - `src/app/api/geo/reverse/route.test.ts`

## 23) Typecheck Stability (2026-04-09)

- `npm run typecheck` now runs:
  - `next typegen && tsc --noEmit --incremental false`
- Rationale:
  - generate `.next/types` before TS validation
  - avoid stale incremental cache artifacts in standalone typecheck runs
- Operational rule:
  - do not run `typecheck` and `build` in parallel in the same workspace.

## 24) Internal API Contract Coverage (2026-04-09)

- Added route-level contract tests for state + internal moderation paths:
  - `src/app/api/feed/state/route.test.ts`
  - `src/app/api/internal/feed/state/refresh/route.test.ts`
  - `src/app/api/internal/moderation/reports/route.test.ts`
  - `src/app/api/internal/moderation/reports/[reportId]/hide/route.test.ts`
- Covered branches:
  - auth failure (`UNAUTHORIZED`)
  - validation failure (`VALIDATION_ERROR`)
  - timeout path pass-through (`TIMEOUT_*` with 504)
  - domain not-found mappings (`REPORT_NOT_FOUND`, `POST_NOT_FOUND`)
  - unknown failure (`INTERNAL_ERROR`)
  - success payload shape and key parameter parsing behavior (limit clamp).

## 25) Error Code Single-Source Completion (2026-04-09)

- Added missing domain/client codes to `src/lib/api/common-errors.ts`:
  - domain: `COOLDOWN_ACTIVE`, `ALREADY_LIKED`, `CANNOT_LIKE_OWN`, `INVALID_REASON_CODE`
  - client transport: `TIMEOUT`, `NETWORK_ERROR`
- Added `API_TIMEOUT_CODE` constants and replaced raw timeout strings across:
  - route handlers (`runWithTimeout` code args)
  - client adapters (`timeoutCode` in `fetchApi` calls)
  - onboarding profile-create flow
- Replaced remaining raw code comparisons/throws with shared constants:
  - profile cooldown UI branch (`COOLDOWN_ACTIVE`)
  - moderation repository not-found throws (`REPORT_NOT_FOUND`, `POST_NOT_FOUND`)
  - posts mutation RPC error map (`ALREADY_LIKED`, `CANNOT_LIKE_OWN`, `INVALID_REASON_CODE`)
  - reverse-geocode client error-code switch (`GEOCODE_*`, `TIMEOUT`, `NETWORK_ERROR`)

## 26) Feed-State RPC Compatibility Fallback (2026-04-09)

- `readFeedStateRepository` now treats missing feed-state RPC/table compatibility errors as recoverable:
  - recognized compatibility signatures include `PGRST202`, `42883`, `42P01`, and function-missing message patterns.
  - fallback path reads latest active post activity directly and returns legacy snapshot version format: `legacy:<last_activity_at>` (or `legacy:empty`).
  - if fallback read also fails, repository returns `mock-static` snapshot instead of throwing.
- `refreshFeedStateRepository` applies the same compatibility fallback behavior for missing `refresh_feed_state`.
- Added repair migration:
  - `supabase/migrations/0010_feed_state_rpc_compat_repair.sql`
  - re-ensures `feed_state` table, `get_feed_state` / `refresh_feed_state` functions, and execute grants idempotently.

## 27) Profile Distance Consistency (2026-04-09)

- Profile post/like list APIs now accept optional viewer coordinates (`latitude`, `longitude`) and validate them with shared optional-coordinate parser.
- `fetchProfilePostsClient` / `fetchProfileLikesClient` append cached browser coordinates when available, while preserving no-coordinate fallback behavior.
- Profile repository + RPC contract now includes nullable `distanceMeters` / `distance_meters` for both posts and likes:
  - coordinates present: distance is computed server-side from the recorded post/like location.
  - coordinates absent: distance returns `null` and UI hides distance segment.
- Added migration:
  - `supabase/migrations/0011_profile_distance_consistency.sql`
  - updates `get_profile_posts` / `get_profile_likes` signatures to include optional viewer coordinates and returns `distance_meters`, with matching execute grants.

## 28) Coordinate Parser Unification (2026-04-09)

- `src/lib/api/coordinates.ts` now uses one parser entrypoint:
  - `parseCoordinatesFromSearchParams(...)`
  - default mode (`required: true`): strict validation for required coordinate routes (feed/geo).
  - optional mode (`required: false`): returns `{ ok: true, data: null }` when both coordinates are absent, while keeping the same validation/error behavior when one/both are present but invalid.
- Profile posts/likes routes now call the same parser with `required: false` instead of a separate optional parser implementation.
- Keep this rule for future routes:
  - coordinate required route: omit `required` (or set `true`)
  - coordinate optional route: set `required: false`

## 29) Hook Modularization: Coordinate + Paginated Fetch (2026-04-09)

- Introduced shared coordinate resolver:
  - `src/lib/geo/resolve-coordinates.ts` (`resolveCoordinatesWithRef`)
  - order: `ref -> cached -> browser`, with configurable `allowRef/allowCached/allowCurrent`
  - returns structured result (`source`, `message`, raw `error`) so hooks can keep their own UX policy.
- `use-feed` and `use-post-actions` now share the same coordinate resolution path:
  - `use-feed` keeps existing behavior (permission denied branch + cached-first + background browser refresh).
  - `use-post-actions` keeps existing behavior (location error callback on failure) but no longer duplicates ref/cache/browser logic.
- Introduced shared paginated API adapter:
  - `src/lib/hooks/cursor-paginated-fetcher.ts`
  - `createCursorPaginatedFetcher` maps `ApiResult<{items,nextCursor}>` to `PaginatedFetchResult`.
- `use-profile` now uses the shared adapter for both posts/likes page fetchers, removing duplicated success/error mapping.

## 30) Guest Google Link Banner + Callback Flow (2026-04-09)

- Added client-side Google OAuth starter utility:
  - `src/lib/auth/google-oauth.ts`
  - unified entrypoint for login (`signInWithOAuth`) and account linking (`linkIdentity`)
  - always clears my-profile/public-profile client caches before redirect start.
- Login page now uses the shared OAuth starter and handles immediate-start failure UI without leaving loading stuck:
  - `src/app/auth/login/page.tsx`
- OAuth callback route now supports explicit intent-based handling:
  - `src/app/auth/callback/route.ts`
  - `intent=link-google` branch returns to `next` path with `google_link=success|failed` (+ `google_link_reason` on failures)
  - login branch behavior remains: profile missing -> `/onboarding`, profile exists -> `next`.
- Extended my-profile contract with account-linking flags:
  - `src/lib/profiles/repository.ts` infers `isAnonymous`, `googleLinked`, `canLinkGoogle` from auth user metadata/identities.
  - `src/app/api/profiles/me/route.ts` returns those flags.
  - type updates: `src/types/api.ts`, `src/types/domain.ts`, `src/lib/api/profile-client.ts`.
- Profile screen now shows link flow UX:
  - `src/lib/hooks/use-profile-context.ts` exposes viewer account-linking flags.
  - `src/components/profile/profile-link-google-banner.tsx` new CTA banner component.
  - `src/components/profile/profile-screen.tsx`:
    - shows banner only when `isMyProfile && isAnonymous && !googleLinked && canLinkGoogle`
    - starts `intent=link-google` flow
    - shows success/error status message from callback query params.
- Added/updated tests:
  - `src/app/auth/callback/route.test.ts`
  - `src/app/api/profiles/me/route.test.ts` (GET coverage expanded).

## 31) Traffic Relief: Feed Dedupe, Poll Backoff Signal, Write Retry Safety (2026-04-09)

- `src/lib/api/feed-client.ts` now applies read-path dedupe and short cache:
  - `fetchFeedState`: in-flight dedupe + 2s TTL cache (with optional `force` bypass).
  - `fetchNearbyFeed`: in-flight dedupe by request key (`lat/lng/cursor/limit`).
- `use-visible-polling` now accepts a non-throw failure signal:
  - `onTick` may return `false` to mark tick failure and trigger exponential backoff.
  - throw behavior is unchanged and still counts as failure.
- `use-feed` polling now returns `false` on transient read-refresh failure:
  - `/api/feed/state` failure no longer silently resets backoff.
  - state-version change refresh failure also triggers backoff progression.
- Feed write clients now use single retry for retryable transport failures:
  - applied to `createPostClient`, `likePostClient`, `reportPostClient`.
  - retryable conditions: `NETWORK_ERROR` and write-timeout codes.
- Post creation retry safety hardened via idempotency key:
  - API contract adds optional `clientRequestId` on `CreatePostBody`.
  - `/api/posts` validates format and passes through domain/repository.
  - migration `supabase/migrations/0012_post_create_idempotency.sql`:
    - adds `posts.client_request_id`
    - adds unique index `(author_id, client_request_id)` (non-null)
    - upgrades `create_post` RPC to return existing `post_id` on duplicate request key.
- Added test coverage:
  - `src/lib/api/feed-client.test.ts`
  - `src/app/api/posts/route.test.ts`
  - `src/lib/hooks/use-feed.test.tsx` (polling failure signal assertion).

## 32) Integration Verification + Docs Closeout (BH-009, 2026-04-09)

- Goal:
  - close the execution loop for BH-001~BH-008 changes with reproducible verification evidence.
- Commands executed:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `npm test -- src/app/api`
  - `npm run test:e2e`
- Results:
  - typecheck: pass
  - unit/integration tests: pass (`22 files / 121 tests`)
  - API route smoke set: pass (`9 files / 48 tests`)
  - production build: pass
  - Playwright smoke: pass (`e2e/smoke.spec.ts`, 2/2)
- Notes:
  - Playwright run showed Next.js dev warning about cross-origin dev origin for `127.0.0.1`; this is non-blocking for current behavior.
  - If this warning needs to be eliminated in local-dev CI parity, configure `allowedDevOrigins` in `next.config.*`.
