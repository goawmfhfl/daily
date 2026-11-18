/** 기획안 태그 체계. 처음부터 많이 만들지 않는다. */

export const EMOTIONS = [
  "기쁨",
  "평온",
  "불안",
  "무기력",
  "분노",
  "슬픔",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const EMOTION_META: Record<
  Emotion,
  { color: string; token: string; polarity: "positive" | "negative" | "neutral" }
> = {
  기쁨: { color: "var(--joy)", token: "joy", polarity: "positive" },
  평온: { color: "var(--calm)", token: "calm", polarity: "positive" },
  불안: { color: "var(--anxiety)", token: "anxiety", polarity: "negative" },
  무기력: { color: "var(--lethargy)", token: "lethargy", polarity: "negative" },
  분노: { color: "var(--anger)", token: "anger", polarity: "negative" },
  슬픔: { color: "var(--sadness)", token: "sadness", polarity: "negative" },
};

export const EVENT_TYPES = [
  "일",
  "관계",
  "건강",
  "돈",
  "가족",
  "성취",
  "실패",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const TAG_KINDS = [
  "emotion",
  "intensity",
  "event",
  "stressor",
  "energy",
  "stress_level",
  "self_view_positive",
  "self_view_negative",
] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export const TAG_KIND_LABEL: Record<TagKind, string> = {
  emotion: "감정",
  intensity: "감정 강도",
  event: "사건 유형",
  stressor: "스트레스 원인",
  energy: "에너지",
  stress_level: "스트레스 정도",
  self_view_positive: "긍정적 자기 평가",
  self_view_negative: "부정적 자기 평가",
};

/** entries.ai_mode 컬럼 값. 새 기록은 항상 comfort(공감), 나머지는 예전 기록에만 남아 있다 */
export const AI_MODES = ["comfort", "organize", "analyze", "coach"] as const;
export type AiMode = (typeof AI_MODES)[number];
export const PERIODS = [
  { key: "7d", label: "최근 7일", days: 7 },
  { key: "30d", label: "최근 30일", days: 30 },
  { key: "all", label: "전체", days: null },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

/** 리포트 생성 최소 기록 수. 이보다 적으면 "아직 말할 수 없다" */
export const MIN_ENTRIES_FOR_REPORT = 7;


/**
 * 위기 대응 연락처.
 * 출시 시점에 최신 정보로 다시 확인해야 합니다. (2026-11 기준)
 */
export const CRISIS_RESOURCES = [
  {
    name: "자살예방상담전화",
    number: "109",
    note: "24시간, 전국 공통",
  },
  {
    name: "정신건강위기상담전화",
    number: "1577-0199",
    note: "24시간",
  },
  {
    name: "응급 상황",
    number: "112 / 119",
    note: "지금 바로 위험하다면",
  },
] as const;

export type UserSettings = {
  /** 저장 직후 AI 공감 말투 1(부드럽게) ~ 3(솔직하게) */
  comfort_directness: 1 | 2 | 3;
  /** 분석 모드 냉정함 1(따뜻하게) ~ 3(냉정하게) */
  analysis_coldness: 1 | 2 | 3;
  default_mode: "free" | "dialogue";
  display_name: string | null;
  /** 하루 첫 방문 때 "어제의 나" 브리핑을 자동으로 띄울지 */
  morning_brief: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  comfort_directness: 2,
  analysis_coldness: 2,
  default_mode: "free",
  display_name: null,
  morning_brief: true,
};

/* ───────── 중국어 학습 ───────── */

export const ZH_LEVELS = ["easy", "conversation", "native"] as const;
export type ZhLevel = (typeof ZH_LEVELS)[number];

export const ZH_LEVEL_META: Record<ZhLevel, { label: string; description: string }> = {
  easy: { label: "쉬운 버전", description: "HSK 1~3급 어휘, 짧고 기본 어순" },
  conversation: { label: "대화 버전", description: "실제 일상 회화체, 자연스러운 어기조사" },
  native: { label: "원어민 버전", description: "관용 표현과 요즘 말투까지" },
};

/** 한 번에 번역할 수 있는 한국어 최대 길이 */
export const ZH_MAX_INPUT = 500;

export const ZH_VOCAB_KINDS = ["word", "idiom", "sentence"] as const;
export type ZhVocabKind = (typeof ZH_VOCAB_KINDS)[number];
export const ZH_VOCAB_KIND_LABEL: Record<ZhVocabKind, string> = {
  word: "단어",
  idiom: "숙어",
  sentence: "문장",
};
/** 단어장에 직접 입력할 수 있는 최대 길이 */
export const ZH_VOCAB_MAX_INPUT = 120;
