# Daily — 나를 연구하는 기록

매일 쌓는 기록을 AI가 분석해 "나는 어떤 사람이고, 무엇을 지속할 수 있으며, 언제 무너지는가"에 답해주는 개인 데이터 서비스. 일기장이 아니라 나를 연구하는 도구.

- **쓰는 순간 데이터가 된다** — 저장 즉시 AI가 감정·강도·사건·스트레스 원인을 제안하고 한 번에 확인
- **분석은 내가 누를 때** — 리포트는 "생성" 버튼을 눌렀을 때만, 모든 주장에 근거 기록(날짜·인용)을 붙여서
- **변화가 보인다** — 대시보드는 지금의 나, 타임라인은 시간에 따른 변화

## 기술 스택

| 영역 | 선택 |
| --- | --- |
| 앱 | Next.js 16 (App Router, Proxy) · React 19 · TypeScript |
| 스타일 | Tailwind CSS v4 + 자체 디자인 토큰 (`src/app/globals.css`) · Pretendard |
| DB / 인증 | Supabase (Postgres + RLS, pgvector, Auth) |
| AI | OpenAI Responses API + Structured Outputs (zod) · 임베딩 |
| 차트 | Recharts (색각 이상 검증된 감정 팔레트) |

## 시작하기

### 1. 키 준비

`.env.example` 을 `.env.local` 로 복사하고 채웁니다.

| 키 | 어디서 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 대시보드 → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 같은 화면 → `anon` `public` 키 |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `OPENAI_MODEL_FAST` (선택) | 태깅·응답·대화용. 기본 `gpt-5-mini` |
| `OPENAI_MODEL_REPORT` (선택) | 리포트용. 기본 `gpt-5` |
| `OPENAI_MODEL_EMBEDDING` (선택) | 기본 `text-embedding-3-small` |

### 2. 데이터베이스

Supabase SQL Editor 에서 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) 을 실행합니다. (또는 Supabase CLI: `supabase db push`)

- 모든 표에 `user_id` + 행 단위 보안(RLS). 본인 행만 읽고 쓸 수 있음
- `vector` 확장 사용 (의미 기반 검색). Supabase 는 기본 제공

혼자 쓰는 앱이므로 Supabase → Authentication → Providers → Email 에서 **Confirm email 을 끄면** 가입 즉시 로그인됩니다. 켜 두면 확인 메일을 거칩니다.

### 3. 실행

```bash
pnpm install
pnpm dev
```

`http://localhost:3000` → 로그인 화면에서 "계정 만들기".
환경변수 없이 실행하면 `/setup` 안내 화면으로, `/design` 에서 디자인 시스템을 볼 수 있습니다.

## 화면

| 경로 | 화면 | 핵심 |
| --- | --- | --- |
| `/` | 기록 | 자유 메모 / 대화형 전환, AI 모드(위로·정리·분석·코칭), 저장 후 태그 확인, 지속 활동 체크. 데스크톱 3단(최근 기록 · 입력 · 태그/AI) |
| `/dashboard` | 대시보드 | 연속 기록일, 최근 14일 감정 흐름, 감정 분포, 스트레스 상위 요인, 지속 활동 체크율, 최신 리포트 |
| `/timeline` | 타임라인 | 주·월 단위 감정 구성과 평균 강도, 리포트가 찾은 변화 구간, 주요 사건 |
| `/reports` | 리포트 | 기간 선택(7일/30일/전체) → 생성, 7개 섹션 + 근거 링크, 이전 리포트 비교 |
| `/entries` | 기록 목록 | 감정·사건·기간·키워드 필터, 의미 검색("불안했던 날") |
| `/entries/[id]` | 기록 상세 | 수정·삭제, 태그 편집(AI/직접 구분 표시) |
| `/settings` | 설정 | 테마, AI 말투(위로 직설 정도·분석 냉정함), 기본 모드, 지속 활동 관리, 내보내기, 전체 삭제, AI 데이터 안내 |
| `/safety` | 위기 대응 | 위기 표현 감지 시 분석을 멈추고 안전 확인 + 연락처 |

## AI 동작

- **태깅 + 한 줄 응답** (`POST /api/entries`): 저장 1건당 1회 호출. Structured Outputs 로 감정·강도·사건·스트레스 원인·에너지·자기 평가 문장·위기 플래그·응답을 한 번에 받음
- **대화형** (`POST /api/dialogue`): 질문 하나씩, 최대 6교환. 저장 시 사용자의 답만 모아 기록으로
- **리포트** (`POST /api/reports`): 기록 7건 미만이면 모델을 호출하지 않고 "아직 말할 수 없다". 근거(`ref`)는 서버에서 실제 `entry_id` 로 치환·검증. 같은 기간을 다시 생성하면 직전 리포트와 비교
- **프롬프트 캐싱**: 시스템 지시문 → 누적 기록(날짜 오름차순) → 요청별 지시 순서로 접두사를 고정해 OpenAI 자동 캐싱을 유도
- **안전장치**: 규칙 기반 위기 표현 감지 (`src/lib/crisis.ts`) + AI `risk` 플래그. 감지 시 태깅·응답·리포트 근거에서 제외. 진단·성격 단정·기록에 없는 추측 금지, 부정 패턴에는 반례 필수 (`src/lib/ai/prompts.ts`)

## 디자인 시스템

- 토큰: `src/app/globals.css` (`@theme`) — 배경/표면/경계/글자 3단계, primary(잉크)/accent(teal), 상태색, 감정 6색, 반경, 그림자, 타이포 스케일
- 다크 모드: `data-theme` 속성, 시스템 설정 추종 + 수동 전환, 첫 렌더 전 인라인 스크립트로 플래시 방지
- 컴포넌트: `src/components/ui` — Button, Input/Textarea/Select, Card, Chip/EmotionChip, Badge, Segmented, IntensityPicker, Dialog, Toast, Skeleton, EmptyState, StatTile, PageHeader
- 감정 팔레트는 dataviz 검증기로 라이트/다크 모두 명도 대역·채도·색각 이상 분리·대비를 통과한 값. 차트 스택 순서는 `EMOTION_CHART_ORDER`
- 미리보기: `/design`

## 데이터 모델

`entries`(원문) ↔ `entry_tags`(태그, `source` 로 AI/사용자 구분) · `habits` / `habit_checks` · `reports` / `report_evidence` · `entry_embeddings` · `experiences`(이력서 단계, 스키마만)

## 로드맵 대응

| 단계 | 상태 |
| --- | --- |
| 0 기반 — 로그인, 기록 CRUD, RLS, 반응형 | ✅ |
| 1 MVP — 태그 제안·확인, 한 줄 응답, 목록, 대시보드 | ✅ |
| 2 분석 — 생성 버튼, 7개 섹션, 근거 연결, 위기 대응 | ✅ |
| 3 변화 추적 — 타임라인, 지속 활동, 리포트 비교, 의미 검색 | ✅ |
| 4 이력서 — 경험 카드, 역량, 직무별 초안 | 스키마만 (`experiences`) |
| 5 확장 — 알림, 오프라인, 앱 잠금, 네이티브 래핑 | 미착수 (PWA 매니페스트만) |
# daily
