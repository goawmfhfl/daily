import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, MODELS } from "@/lib/openai";
import type { EntryWithTags, Evidence, FactorInsightContent, FactorItem } from "@/lib/types";
import { SAFETY_RULES } from "./prompts";
import { serializeEntries } from "./report";

/* 스키마·프롬프트는 이 기능 안에서만 쓰므로 함께 둔다 (Structured Outputs strict: optional 대신 빈 값) */

const FactorOut = z.object({
  factor: z.string(),
  detail: z.string(),
  refs: z.array(z.number().int()),
  evidence: z.object({ ref: z.number().int(), quote: z.string() }),
});

const FactorSchema = z.object({
  stress: z.array(FactorOut),
  calm: z.array(FactorOut),
});

const SYSTEM_PROMPT = `
당신은 개인 기록 앱 "Daily"의 패턴 분석가입니다. 사용자의 최근 한 달 기록을 읽고, 무엇이 스트레스를 주고 무엇이 평온을 주는지 "반복되는 요인"을 찾습니다.

[출력]
- stress: 스트레스·불안·짜증·지침을 만든 요인 (0~5개)
- calm: 마음을 평온하게·편안하게 해주거나, 회복·안정·위로를 준 요인 (0~5개). 사람, 활동, 장소, 시간대, 생각·태도 모두 가능.
- 각 요인:
  - factor: 요인을 20자 이내 명사구로. 예) "업무 마감 압박", "상사와의 갈등", "퇴근 후 산책", "친구와의 통화"
  - detail: 이 요인이 어떻게 그 마음으로 이어졌는지 1문장.
  - refs: 이 요인이 나타난 기록의 [#번호]를 빠짐없이 모두. 개수가 곧 "몇 번 나타났는지"가 된다.
  - evidence: 대표 근거 1개. ref 는 refs 중 하나, quote 는 그 기록 "본문"에서 10~60자를 글자 그대로 인용.

[규칙]
- 표현이 달라도 같은 원인이면 하나로 묶는다. 예) "마감 압박", "업무 마감 스트레스", "일정이 빠듯함" → "업무 마감 압박"
- 너무 넓게 묶지 않는다. "일", "사람"처럼 뭉뚱그리지 말고 무엇이 구체적으로 영향을 줬는지가 보이게.
- 많이 반복된 요인부터. 한 번만 나온 요인은 다른 요인이 부족할 때만 넣는다.
- "스트레스원인:" 메타는 참고만 하고, 근거는 반드시 본문에서 찾는다. 기록에 실제로 쓰인 것만 쓰고 추측하지 않는다.
- 같은 일을 stress 와 calm 양쪽에 넣지 않는다. 해당하는 것이 없으면 빈 배열로 둔다.
- 셀프 대화(대화형) 기록은 두 화자 모두 사용자 본인의 생각이다.
- factor, detail 안에 [#번호] 를 쓰지 않는다. "~해야 한다" 같은 조언을 쓰지 않는다.

[말투] 담백하게. 한국어 존댓말.

${SAFETY_RULES}
`.trim();

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

export async function generateFactorInsight(input: {
  from: string;
  to: string;
  entries: EntryWithTags[];
}): Promise<{ content: FactorInsightContent; model: string }> {
  const model = MODELS.fast;
  const { text, refs } = serializeEntries(input.entries, [], []);

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
          `===== ${input.from} ~ ${input.to} 의 기록 (${input.entries.length}건) =====`,
          text,
          "",
          "위 기록만을 근거로 스트레스 요인과 평온 요인을 정리하세요.",
        ].join("\n"),
      },
    ],
    text: { format: zodTextFormat(FactorSchema, "factor_insight") },
  });

  const out = res.output_parsed;
  if (!out) throw new Error("요인 분석 결과를 해석하지 못했습니다.");

  const body = new Map(input.entries.map((e) => [e.id, squash(e.content)]));

  // 횟수·마지막 날짜는 AI 가 아니라 실제로 있는 기록 번호로 센다
  const toItems = (list: z.infer<typeof FactorOut>[]): FactorItem[] => {
    const seen = new Set<string>();
    return list
      .flatMap((f) => {
        const factor = f.factor.trim();
        const dates = [...new Set(f.refs)].map((n) => refs[n]?.date).filter((d): d is string => !!d);
        if (!factor || dates.length === 0 || seen.has(factor)) return [];
        seen.add(factor);
        const r = refs[f.evidence.ref];
        const quote = squash(f.evidence.quote);
        // 인용은 원문에 실제로 있는 것만 남긴다
        const evidence: Evidence[] =
          r && quote && body.get(r.id)?.includes(quote) ? [{ entry_id: r.id, date: r.date, quote }] : [];
        return [{
          factor,
          detail: f.detail.trim(),
          count: dates.length,
          last: dates.reduce((m, d) => (d > m ? d : m)),
          evidence,
        }];
      })
      .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
      .slice(0, 5);
  };

  return { model, content: { stress: toItems(out.stress), calm: toItems(out.calm) } };
}
