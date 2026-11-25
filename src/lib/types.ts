import type { ReportMetrics } from "@/lib/report-metrics";
import type { TagKind, PeriodKey, AiMode } from "./constants";

export type EntryMode = "free" | "dialogue";

export interface EntryRow {
  id: string;
  user_id: string;
  entry_date: string; // yyyy-MM-dd
  mode: EntryMode;
  content: string;
  ai_reply: string | null;
  ai_mode: AiMode | null;
  risk_flag: boolean;
  /** 생각이 떠오른 시각. null 이면 작성 시각(created_at)으로 본다 */
  occurred_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntryTagRow {
  id: string;
  entry_id: string;
  user_id: string;
  kind: TagKind;
  value: string;
  source: "user" | "ai";
  created_at: string;
}

export interface EntryWithTags extends EntryRow {
  entry_tags: EntryTagRow[];
}

export interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  started_at: string;
  active: boolean;
  /** 해야 하는 요일 (0=일 … 6=토) */
  weekdays: number[];
  /** 보여 주는 순서 (작을수록 위) */
  sort_order: number;
  emoji: string | null;
  created_at: string;
}

export interface HabitCheckRow {
  id: string;
  habit_id: string;
  user_id: string;
  entry_date: string;
  done: boolean;
}

export interface ReportRow {
  id: string;
  user_id: string;
  period_key: PeriodKey;
  period_start: string;
  period_end: string;
  mode: string;
  content_json: ReportContent;
  model: string;
  entry_count: number;
  created_at: string;
}

export interface ReportEvidenceRow {
  id: string;
  report_id: string;
  entry_id: string;
  section: string;
  quote: string;
}

/* ───────── 리포트 구조 (OpenAI 구조화 출력과 1:1) ───────── */

export interface Evidence {
  /** 서버에서 ref → entry_id 로 치환 */
  entry_id: string;
  date: string;
  quote: string;
}

export interface ReportSection {
  summary: string;
  bullets: string[];
  evidence: Evidence[];
}

export interface ReportContent {
  headline: string;
  emotion_trend: ReportSection;
  stress_map: ReportSection & {
    top_stressors: { name: string; count: number; when: string }[];
  };
  coping: ReportSection;
  self_view: ReportSection & {
    positive_quotes: Evidence[];
    negative_quotes: Evidence[];
  };
  happiness_conditions: ReportSection & {
    happy: Evidence[];
    unhappy: Evidence[];
    happy_common: string;
    unhappy_common: string;
  };
  persistence: ReportSection & {
    sustained: { name: string; note: string }[];
    dropped: { name: string; note: string }[];
    counterexamples: string[];
  };
  next_step: {
    experiment: string;
    why: string;
    how_to_measure: string;
    /** 권하는 행동 / 피해야 할 행동 (이전 리포트에는 없음) */
    recommended?: { action: string; why: string }[];
    avoid?: { action: string; why: string }[];
  };
  /** 요일·시간대 패턴 (이전 리포트에는 없음) */
  time_patterns?: ReportSection & {
    items: { when: string; pattern: string; tone: "good" | "bad" | "neutral" }[];
  };
  change_points: { date: string; description: string }[];
  comparison_with_previous: string | null;
  /** 생성 시점에 태그로 계산한 흐름·요일·시간대 지표 (이전 리포트에는 없음) */
  metrics?: ReportMetrics;
}

/* ───────── 태깅 결과 ───────── */

export interface TagSuggestion {
  emotions: string[];
  intensity: number;
  events: string[];
  stressor: string | null;
  energy: number;
  stress_level: number;
  self_view_positive: string[];
  self_view_negative: string[];
  risk: boolean;
  reply: string;
}

/* ───────── 어제의 나 (아침 브리핑) ───────── */

export interface BriefItem {
  /** 짧은 한 줄 */
  title: string;
  /** 기록 본문에서 그대로 인용한 구절 (원문에 없으면 null) */
  quote: string | null;
  entry_id: string | null;
}

export interface BriefContent {
  summary: string;
  joys: BriefItem[];
  stresses: BriefItem[];
  healings: BriefItem[];
  tip: string;
  /** 아래는 AI 가 아니라 태그·체크에서 계산 */
  emotions: string[];
  stress_level: number | null;
  energy: number | null;
  habits_done: string[];
  habits_total: number;
}

export interface DailyBriefRow {
  id: string;
  user_id: string;
  target_date: string;
  content_json: BriefContent;
  model: string;
  entry_count: number;
  source_updated_at: string;
  created_at: string;
}

/** GET /api/briefs 응답 */
export type BriefResponse =
  | { status: "ok"; target_date: string; entry_ids: string[]; brief: DailyBriefRow }
  /** 위기 표시가 있던 날: 분석 대신 안부만 */
  | { status: "care"; target_date: string; entry_ids: string[] }
  /** OPENAI 키가 없어 만들 수 없음 */
  | { status: "no_ai"; target_date: string; entry_ids: string[] }
  /** 오늘 이전 기록이 없음 */
  | { status: "none" };

/* ───────── 중국어 학습 ───────── */

export interface ZhSegment {
  hanzi: string;
  pinyin: string;
  /** 이 단어의 한국어 뜻. 문장부호는 빈 문자열 */
  ko: string;
}

export interface ZhTranslationRow {
  id: string;
  phrase_id: string;
  user_id: string;
  level: import("./constants").ZhLevel;
  hanzi: string;
  pinyin: string;
  segments: ZhSegment[];
  note: string | null;
  /** 문장별 외우기용 짝. null 이면 아직 나누지 않음 */
  pairs: ZhPair[] | null;
  model: string;
  created_at: string;
}

/** 한국어 한 문장 ↔ 중국어 한 문장. from/to 는 segments 인덱스 (to 미포함) */
export interface ZhPair {
  ko: string;
  from: number;
  to: number;
}

export interface ZhPhraseRow {
  id: string;
  user_id: string;
  source_ko: string;
  favorite: boolean;
  created_at: string;
}

export interface ZhPhraseWithTranslations extends ZhPhraseRow {
  zh_translations: ZhTranslationRow[];
}

export interface ZhExample {
  hanzi: string;
  pinyin: string;
  ko: string;
}

export interface ZhVocabRow {
  id: string;
  user_id: string;
  kind: import("./constants").ZhVocabKind;
  input: string;
  hanzi: string;
  pinyin: string;
  part_of_speech: string;
  meaning: string;
  explanation: string;
  examples: ZhExample[];
  segments: ZhSegment[];
  source_translation_id: string | null;
  model: string | null;
  /** 0 외우지 않음·외우는 중, 1~6 외움(복습 단계), 7 완전히 외움 */
  stage: number;
  /** 다음 복습 날짜 (yyyy-MM-dd) */
  due_on: string | null;
  review_count: number;
  last_reviewed_at: string | null;
  created_at: string;
}

/* ───────── 주간 감정 요인 분석 ───────── */

export interface EmotionDriver {
  /** 요인 한 줄 (사람·상황·활동·생각) */
  factor: string;
  /** 어떻게 그 감정으로 이어졌는지 한 문장 */
  detail: string;
  evidence: Evidence[];
}

export interface EmotionInsightContent {
  /** 이번 주 감정 전체를 한두 문장으로 */
  overview: string;
  emotions: { emotion: string; summary: string; drivers: EmotionDriver[] }[];
}

export interface EmotionInsightRow {
  id: string;
  user_id: string;
  week_start: string;
  content_json: EmotionInsightContent;
  model: string;
  entry_count: number;
  source_sig: string;
  created_at: string;
}

/** GET·POST /api/emotion-insights 응답 */
export type EmotionInsightResponse =
  /** stale: 분석 뒤로 그 주 기록·태그가 바뀜 */
  | { status: "ok"; insight: EmotionInsightRow; stale: boolean }
  /** 아직 분석하지 않음 */
  | { status: "none" }
  /** 그 주에 분석할 기록이 없음 */
  | { status: "empty" }
  | { status: "no_ai" };

/* ───────── 최근 30일 스트레스·평온 상위 요인 ───────── */

export interface FactorItem {
  factor: string;
  detail: string;
  /** 이 요인이 나타난 기록 수 */
  count: number;
  /** 마지막으로 나타난 날 */
  last: string;
  evidence: Evidence[];
}

export interface FactorInsightContent {
  stress: FactorItem[];
  calm: FactorItem[];
}

export interface FactorInsightRow {
  id: string;
  user_id: string;
  window_from: string;
  window_to: string;
  content_json: FactorInsightContent;
  model: string;
  entry_count: number;
  source_sig: string;
  created_at: string;
}

/** GET·POST /api/factor-insights 응답 */
export type FactorInsightResponse =
  /** stale: 분석 뒤로 최근 30일 기록·태그가 바뀜 */
  | { status: "ok"; insight: FactorInsightRow; stale: boolean }
  | { status: "none" }
  | { status: "empty" }
  | { status: "no_ai" };

/* ───────── HSK 독해 ───────── */

/** 빈칸 유형: 실사 호응 / 성어 / 접속어·부사(논리) / 문장(2부분) */
export type HskBlankKind = "collocation" | "idiom" | "connective" | "sentence";

/** 2부분 공용 보기 (A~F) */
export interface HskChoice {
  text: string;
  /** 어느 빈칸의 어떤 단서와 이어지는지, 남는 보기면 왜 어디에도 안 맞는지 (한국어) */
  note: string;
}

export interface HskBlank {
  no: number;
  kind: HskBlankKind;
  /** 보기 4개 */
  options: string[];
  /** 정답 보기 번호 (0~3) */
  answer: number;
  /** 왜 정답인지 (한국어) */
  explanation: string;
  /** 보기별 뜻과 맞고 틀린 이유 (한국어, options 와 같은 순서) */
  option_notes: string[];
}

export interface HskSetRow {
  id: string;
  user_id: string;
  level: number;
  part: number;
  topic: string;
  title: string;
  /** {{1}} … {{n}} 으로 빈칸을 표시한 지문 */
  passage: string;
  blanks: HskBlank[];
  /** 2부분: 빈칸들이 함께 쓰는 보기 6개. 1부분은 null */
  choices: HskChoice[] | null;
  translation_ko: string;
  status: "active" | "reported";
  origin: "pool" | "similar";
  focus_words: string[];
  model: string | null;
  served_at: string | null;
  created_at: string;
}

export interface HskAttemptRow {
  id: string;
  set_id: string;
  mode: "first" | "retry";
  /** 빈칸 번호(문자열) → 고른 보기 번호 */
  selected: Record<string, number>;
  correct: number;
  total: number;
  duration_sec: number | null;
  created_at: string;
}

export interface HskWrongRow {
  id: string;
  set_id: string;
  blank_no: number;
  selected: number;
  answer: number;
  /** 0~3, 3번 연속 맞히면 resolved */
  stage: number;
  due_on: string | null;
  review_count: number;
  resolved_at: string | null;
  created_at: string;
}

export type HskWrongWithSet = HskWrongRow & { hsk_sets: HskSetRow };
export type HskAttemptWithSet = HskAttemptRow & { hsk_sets: HskSetRow };

export interface HskSummary {
  /** 부분별로 아직 안 꺼낸 세트 수 */
  pools: Record<string, number>;
  stats: { sets: number; correct: number; total: number };
  wrong: HskWrongWithSet[];
  recent: HskAttemptWithSet[];
}

export interface HskGraded {
  no: number;
  selected: number;
  answer: number;
  correct: boolean;
}
