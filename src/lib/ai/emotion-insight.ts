import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, MODELS } from "@/lib/openai";
import { EMOTIONS } from "@/lib/constants";
import type { EmotionInsightContent, EntryWithTags, Evidence } from "@/lib/types";
import { SAFETY_RULES } from "./prompts";
import { serializeEntries } from "./report";

/* 스키마·프롬프트는 이 기능 안에서만 쓰므로 함께 둔다 (Structured Outputs strict: optional 대신 빈 값) */

const EvidenceOut = z.object({ ref: z.number().int(), quote: z.string() });

const InsightSchema = z.object({
  overview: z.string(),
  emotions: z.array(
    z.object({
      emotion: z.enum(EMOTIONS),
      summary: z.string(),
      drivers: z.array(
        z.object({
          factor: z.string(),
          detail: z.string(),
          evidence: z.array(EvidenceOut),
        }),
      ),
    }),
  ),
});

const SYSTEM_PROMPT = `
당신은 개인 기록 앱 "Daily"의 감정 분석가입니다. 사용자의 한 주 기록을 읽고, 감정 태그별로 "무엇이 그 감정을 만들었는지"를 찾습니다.

[출력]
- overview: 이번 주 감정 전체를 1~2문장으로. 예) "주 초반엔 일 때문에 불안이 컸고, 주말 운동과 친구와의 시간이 평온을 만들었어요."
- emotions: 입력의 "이번 주 감정 태그"에 있는 감정마다 하나씩.
  - summary: 그 감정이 주로 언제·무엇 때문에 생겼는지 1문장.
  - drivers: 그 감정을 만든 요인 1~3개. 많이 반복된 요인부터.
    - factor: 요인을 20자 이내로 (사람·상황·활동·생각). 예) "사장의 무시하는 태도", "퇴근 후 자전거", "미래에 대한 걱정"
    - detail: 그 요인이 어떻게 그 감정으로 이어졌는지 1문장.
    - evidence: 근거 1~2개. ref 는 입력의 [#번호], quote 는 그 기록 "본문"에서 10~60자를 글자 그대로 인용.

[규칙]
- 근거는 그 감정이 태그된 기록에서 우선 찾는다. 기록에 실제로 쓰인 것만 쓰고 추측하지 않는다.
- "감정:", "지속활동 완료:" 같은 메타 줄은 인용하지 않는다.
- 셀프 대화(대화형) 기록은 두 화자 모두 사용자 본인의 생각이다.
- summary, factor, detail 안에 [#번호] 를 쓰지 않는다.
- 감정을 판단하거나 고치려 하지 않는다. "~해야 한다" 같은 조언을 쓰지 않는다.

[말투] 따뜻하되 담백하게. 한국어 존댓말.

${SAFETY_RULES}
`.trim();

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

export async function generateEmotionInsight(input: {
  weekStart: string;
  weekEnd: string;
  entries: EntryWithTags[];
}): Promise<{ content: EmotionInsightContent; model: string }> {
  const model = MODELS.fast;
  const { text, refs } = serializeEntries(input.entries, [], []);

  const counts = new Map<string, number>();
  for (const e of input.entries)
    for (const t of e.entry_tags) if (t.kind === "emotion") counts.set(t.value, (counts.get(t.value) ?? 0) + 1);
  const emotionLine = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}회`)
    .join(", ");

  const res = await openai().responses.parse({
    model,
    ...(model.startsWith("gpt-5") || model.startsWith("o")
      ? { reasoning: { effort: "low" as const } }
      : {}),
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `===== ${input.weekStart} ~ ${input.weekEnd} 의 기록 (${input.entries.length}건) =====`,
          text,
          "",
          `===== 이번 주 감정 태그 =====`,
          emotionLine || "없음",
          "",
          "위 기록만을 근거로 감정별 요인을 정리하세요.",
        ].join("\n"),
      },
    ],
    text: { format: zodTextFormat(InsightSchema, "emotion_insight") },
  });

  const out = res.output_parsed;
  if (!out) throw new Error("감정 분석 결과를 해석하지 못했습니다.");

  const body = new Map(input.entries.map((e) => [e.id, squash(e.content)]));
  // 인용은 원문에 실제로 있는 것만 남긴다 (없는 말을 지어내지 않도록)
  const evidence = (list: { ref: number; quote: string }[]): Evidence[] =>
    list.flatMap((ev) => {
      const r = refs[ev.ref];
      const quote = squash(ev.quote);
      return r && quote && body.get(r.id)?.includes(quote) ? [{ entry_id: r.id, date: r.date, quote }] : [];
    });

  const seen = new Set<string>();
  return {
    model,
    content: {
      overview: out.overview.trim(),
      emotions: out.emotions
        .filter((e) => counts.has(e.emotion) && !seen.has(e.emotion) && seen.add(e.emotion))
        .map((e) => ({
          emotion: e.emotion,
          summary: e.summary.trim(),
          drivers: e.drivers
            .filter((d) => d.factor.trim())
            .slice(0, 3)
            .map((d) => ({ factor: d.factor.trim(), detail: d.detail.trim(), evidence: evidence(d.evidence).slice(0, 2) })),
        })),
    },
  };
}
