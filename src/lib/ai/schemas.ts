import { z } from "zod";
import { EMOTIONS, EVENT_TYPES } from "@/lib/constants";

/**
 * OpenAI Structured Outputs (strict) 호환 규칙:
 * - optional 금지 → nullable 사용
 * - 모든 필드 required
 */

export const TagSuggestionSchema = z.object({
  emotions: z.array(z.enum(EMOTIONS)),
  intensity: z.number().int(),
  events: z.array(z.enum(EVENT_TYPES)),
  stressor: z.string().nullable(),
  energy: z.number().int(),
  stress_level: z.number().int(),
  self_view_positive: z.array(z.string()),
  self_view_negative: z.array(z.string()),
  risk: z.boolean(),
  reply: z.string(),
});
export type TagSuggestionOut = z.infer<typeof TagSuggestionSchema>;

const EvidenceRef = z.object({
  ref: z.number().int(),
  quote: z.string(),
});

const Section = z.object({
  summary: z.string(),
  bullets: z.array(z.string()),
  evidence: z.array(EvidenceRef),
});

export const ReportSchema = z.object({
  headline: z.string(),
  emotion_trend: Section,
  stress_map: Section.extend({
    top_stressors: z.array(
      z.object({ name: z.string(), count: z.number().int(), when: z.string() }),
    ),
  }),
  coping: Section,
  self_view: Section.extend({
    positive_quotes: z.array(EvidenceRef),
    negative_quotes: z.array(EvidenceRef),
  }),
  happiness_conditions: Section.extend({
    happy: z.array(EvidenceRef),
    unhappy: z.array(EvidenceRef),
    happy_common: z.string(),
    unhappy_common: z.string(),
  }),
  persistence: Section.extend({
    sustained: z.array(z.object({ name: z.string(), note: z.string() })),
    dropped: z.array(z.object({ name: z.string(), note: z.string() })),
    counterexamples: z.array(z.string()),
  }),
  next_step: z.object({
    experiment: z.string(),
    why: z.string(),
    how_to_measure: z.string(),
  }),
  change_points: z.array(
    z.object({ date: z.string(), description: z.string() }),
  ),
  comparison_with_previous: z.string().nullable(),
});
export type ReportOut = z.infer<typeof ReportSchema>;
