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
  };
  change_points: { date: string; description: string }[];
  comparison_with_previous: string | null;
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
