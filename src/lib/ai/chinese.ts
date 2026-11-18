import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { openai, MODELS } from "@/lib/openai";
import { ZH_LEVEL_META, type ZhLevel } from "@/lib/constants";
import type { ZhSegment } from "@/lib/types";
import { joinSegmentsPinyin, verifySegments } from "./zh-pinyin";

/* 스키마·프롬프트는 이 기능 안에서만 쓰므로 함께 둔다 (Structured Outputs strict) */

const TranslationSchema = z.object({
  hanzi: z.string(),
  segments: z.array(
    z.object({
      hanzi: z.string(),
      pinyin: z.string(),
      ko: z.string(),
    }),
  ),
  note: z.string(),
});

const LEVEL_RULES: Record<ZhLevel, string> = {
  easy: `쉬운 버전: HSK 1~3급 수준의 기본 어휘와 짧은 문장. 기본 어순(주어+부사+동사+목적어)을 지키고, 관용어·성어·복잡한 보어는 피한다. 원문이 길면 짧은 문장 두세 개로 나눠도 된다. 중국어를 막 배우는 사람이 읽고 따라 말할 수 있어야 한다.`,
  conversation: `대화 버전: 중국 사람이 일상에서 실제로 말하는 구어체. 吧·呢·啊·嘛 같은 어기조사, 자연스러운 생략, 회화에서 흔한 표현을 쓴다. 교과서 같은 딱딱한 표현은 피한다.`,
  native: `원어민 버전: 원어민이 그 상황에서 가장 자연스럽게 쓸 말. 어울리면 성어·관용 표현·요즘 쓰는 말투도 쓴다. 직역보다 뉘앙스와 감정을 살린다. 과장하거나 억지로 어려운 말을 넣지는 않는다.`,
};

function systemPrompt(level: ZhLevel) {
  return `
당신은 한국어 화자를 위한 중국어 선생님입니다. 사용자가 쓴 한국어 문장을 중국어(간체자, 중국 대륙 표준어)로 옮깁니다.

[난이도] ${ZH_LEVEL_META[level].label}
${LEVEL_RULES[level]}

[출력]
- hanzi: 완성된 중국어 문장. 중국어 문장부호(，。？！)를 쓴다.
- segments: hanzi 를 사전에 실리는 단어(词) 단위로 처음부터 끝까지 순서대로 나눈다. 모든 segments 의 hanzi 를 이어 붙이면 hanzi 와 글자 하나까지 정확히 같아야 한다. 문장부호도 별도 segment 로 둔다.
  - 두 글자 이상인 단어는 반드시 한 덩어리로 둔다. 예: 今天 / 公司 / 下班 / 散步 / 心情 / 不过 / 来得及. 今 / 天 처럼 글자 하나씩 쪼개지 않는다.
  - 결과보어·조사가 붙은 짧은 덩어리(好了, 一点)는 한 단어처럼 묶어도 된다.
  - pinyin: 그 단어의 병음. 성조 기호를 쓰고(nǐ hǎo), 글자마다 한 음절씩 공백으로 구분한다. 문맥에 맞는 읽기를 쓴다(예: 长得 zhǎng de, 银行 yín háng). 一·不 는 실제 발음되는 성조로 쓴다(一个 yí gè, 不是 bú shì). 문장부호는 그 기호 그대로.
  - ko: 그 단어의 짧은 한국어 뜻(예: "~했다(완료)", "은행"). 문장부호는 빈 문자열.
- note: 이 번역의 학습 포인트 1~2문장. 왜 이 표현을 골랐는지, 원문과 뉘앙스가 어떻게 다른지, 외워 둘 만한 표현이 무엇인지. 한국어로.

[출력 언어]
- hanzi 와 segments.hanzi 만 중국어다.
- segments.ko 와 note 는 반드시 한국어로 쓴다. 중국어 표현을 언급할 때만 그 표현을 따옴표로 인용한다.

[규칙]
- 원문에 없는 내용을 덧붙이지 않는다.
- 원문이 이미 중국어거나 번역할 수 없는 입력이면, 가능한 범위에서 자연스럽게 옮기고 note 에 그 사실을 적는다.
`.trim();
}

export async function translateToChinese(
  sourceKo: string,
  level: ZhLevel,
): Promise<{ hanzi: string; pinyin: string; segments: ZhSegment[]; note: string; model: string }> {
  const model = MODELS.fast;
  const res = await openai().responses.parse({
    model,
    ...(model.startsWith("gpt-5") || model.startsWith("o")
      ? { reasoning: { effort: "minimal" as const } }
      : {}),
    input: [
      { role: "system", content: systemPrompt(level) },
      { role: "user", content: sourceKo },
    ],
    text: { format: zodTextFormat(TranslationSchema, "zh_translation") },
  });

  const out = res.output_parsed;
  if (!out) throw new Error("번역 결과를 해석하지 못했습니다.");

  const hanzi = out.hanzi.trim();
  const segments = verifySegments(hanzi, out.segments);
  const pinyin = joinSegmentsPinyin(segments);

  return { hanzi, pinyin, segments, note: out.note.trim(), model };
}
