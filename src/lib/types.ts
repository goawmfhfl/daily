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

export interface DialogueMessage {
  role: "user" | "assistant";
  content: string;
}
