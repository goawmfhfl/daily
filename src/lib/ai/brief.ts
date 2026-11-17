import { zodTextFormat } from "openai/helpers/zod";
import { openai, MODELS } from "@/lib/openai";
import { z } from "zod";
import type {
  BriefContent,
  BriefItem,
  EntryWithTags,
  HabitCheckRow,
  HabitRow,
} from "@/lib/types";
import { SAFETY_RULES } from "./prompts";
import { serializeEntries } from "./report";

/* 스키마·프롬프트는 이 기능 안에서만 쓰므로 함께 둔다 (Structured Outputs strict: optional 대신 빈 값) */

const BriefItemOut = z.object({
  title: z.string(),
  ref: z.number().int(),
  quote: z.string(),
});

const BriefSchema = z.object({
  summary: z.string(),
  joys: z.array(BriefItemOut),
  stresses: z.array(BriefItemOut),
  healings: z.array(BriefItemOut),
  tip: z.string(),
});
type BriefOut = z.infer<typeof BriefSchema>;

const BRIEF_SYSTEM_PROMPT = `
당신은 개인 기록 앱 "Daily"의 아침 브리핑 작성자입니다. 사용자가 하루를 시작할 때, 지난 하루(가장 최근에 기록한 날)의 기록을 읽고 "그날의 나는 어땠는지"를 한눈에 보이게 정리합니다.

[출력]
- summary: 그날을 1~2문장으로. 예) "일이 몰려 지쳤지만, 저녁 산책으로 조금 회복한 하루였어요."
- joys: 가장 기뻤던·좋았던 순간 (0~3개)
- stresses: 스트레스받았던 일 (0~3개)
- healings: 쉬었다·회복했다·위로받았다고 느낀 순간 (산책, 대화, 휴식, 취미 등) (0~3개)
- 각 항목: title 은 25자 이내의 짧은 한 줄(명사구 또는 짧은 문장), ref 는 입력의 [#번호], quote 는 그 기록 "본문"에서 10~50자를 글자 그대로 인용.
- tip: 지난 하루를 바탕으로 오늘 해볼 만한 아주 작은 것 하나를 제안조 한 문장으로.

[규칙]
- 기록에 실제로 쓰인 것만 쓴다. 해당하는 것이 없으면 빈 배열로 둔다. 억지로 채우지 않는다.
- 같은 일을 여러 목록에 중복해서 넣지 않는다.
- "감정:", "지속활동 완료:" 같은 메타 줄은 인용하지 않는다. 메타 정보는 참고만 한다.
- 셀프 대화(대화형) 기록은 두 화자 모두 사용자 본인의 생각이다.
- summary, title, tip 안에 [#번호] 를 쓰지 않는다.

[말투] 따뜻하되 과장하지 않게. 한국어 존댓말, 짧고 담백하게.

${SAFETY_RULES}
`.trim();

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

function avg(values: number[]) {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/**
 * 태그·체크에서 계산하는 지표 (AI 를 거치지 않는다).
 * 태그 수정·활동 체크는 기록 수정 시각을 바꾸지 않으므로 요청마다 새로 계산한다
 */
export function briefStats(entries: EntryWithTags[], habits: HabitRow[], checks: HabitCheckRow[], date: string) {
  const tags = entries.flatMap((e) => e.entry_tags);
  const nums = (kind: string) =>
    tags.filter((t) => t.kind === kind).map((t) => Number(t.value)).filter((n) => Number.isFinite(n));
  const emotionCount = new Map<string, number>();
  for (const t of tags) if (t.kind === "emotion") emotionCount.set(t.value, (emotionCount.get(t.value) ?? 0) + 1);
  // 그날 시작해 있던 활동만 분모로
  const relevant = habits.filter((h) => h.started_at <= date && (h.active || checks.some((c) => c.habit_id === h.id)));
  const doneIds = new Set(checks.filter((c) => c.done && c.entry_date === date).map((c) => c.habit_id));
  return {
    emotions: [...emotionCount.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v),
    stress_level: avg(nums("stress_level")),
    energy: avg(nums("energy")),
    habits_done: relevant.filter((h) => doneIds.has(h.id)).map((h) => h.name),
    habits_total: relevant.length,
  };
}

export async function generateBrief(input: {
  date: string;
  entries: EntryWithTags[];
  habits: HabitRow[];
  checks: HabitCheckRow[];
}): Promise<{ content: BriefContent; model: string }> {
  const model = MODELS.fast;
  const { text, refs } = serializeEntries(input.entries, input.habits, input.checks);

  const res = await openai().responses.parse({
    model,
    ...(model.startsWith("gpt-5") || model.startsWith("o")
      ? { reasoning: { effort: "low" as const } }
      : {}),
    input: [
      { role: "system", content: BRIEF_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `===== ${input.date} 의 기록 (${input.entries.length}건) =====`,
          text,
          "",
          "위 기록만을 근거로 아침 브리핑을 작성하세요.",
        ].join("\n"),
      },
    ],
    text: { format: zodTextFormat(BriefSchema, "daily_brief") },
  });

  const out = res.output_parsed;
  if (!out) throw new Error("브리핑 결과를 해석하지 못했습니다.");

  const byId = new Map(input.entries.map((e) => [e.id, squash(e.content)]));
  // 인용은 원문에 실제로 있는 경우에만 남긴다 (없는 말을 지어내지 않도록)
  const items = (list: BriefOut["joys"]): BriefItem[] =>
    list
      .filter((i) => i.title.trim())
      .slice(0, 3)
      .map((i) => {
        const entryId = refs[i.ref]?.id ?? null;
        const quote = squash(i.quote);
        const ok = entryId && quote && byId.get(entryId)?.includes(quote);
        return { title: i.title.trim(), quote: ok ? quote : null, entry_id: entryId };
      });

  return {
    model,
    content: {
      summary: out.summary.trim(),
      joys: items(out.joys),
      stresses: items(out.stresses),
      healings: items(out.healings),
      tip: out.tip.trim(),
      ...briefStats(input.entries, input.habits, input.checks, input.date),
    },
  };
}
