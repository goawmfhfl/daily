import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { openai, MODELS } from "@/lib/openai";
import { ZH_VOCAB_KINDS, type ZhVocabKind } from "@/lib/constants";
import type { ZhExample } from "@/lib/types";
import { verifyPinyin } from "./zh-pinyin";
import { nonKoreanFields } from "@/lib/zh-lang";

/* 스키마·프롬프트는 이 기능 안에서만 쓰므로 함께 둔다 (Structured Outputs strict) */

// 칸마다 쓸 언어를 설명으로 붙인다 (스키마 설명도 모델에 전달된다)
const KO = "반드시 한국어로. 중국어 표현은 작은따옴표로 인용할 때만.";
const VocabSchema = z.object({
  kind: z.enum(ZH_VOCAB_KINDS),
  hanzi: z.string().describe("중국어(간체자)"),
  pinyin: z.string().describe("병음, 성조 기호, 글자마다 한 음절"),
  part_of_speech: z.string().describe(`품사 한 단어. ${KO}`),
  meaning: z.string().describe(`뜻. ${KO}`),
  explanation: z.string().describe(`쓰임·뉘앙스·搭配 설명 2~3문장. ${KO}`),
  examples: z.array(
    z.object({
      hanzi: z.string().describe("중국어 예문"),
      pinyin: z.string(),
      ko: z.string().describe(`예문의 한국어 해석. ${KO}`),
    }),
  ),
});

const SYSTEM_PROMPT = `
당신은 한국어 화자를 위한 중국어 선생님입니다. 사용자가 단어장에 넣고 싶은 항목 하나를 받아, 외우기 좋은 단어장 카드로 정리합니다.
중국어는 간체자, 중국 대륙 표준어 기준입니다.
가장 중요한 규칙: 카드를 읽는 사람은 한국인이다. 입력과 문맥이 중국어여도 뜻·해석·품사·예문 해석은 모두 한국어로 쓴다.

[입력]
- 중국어(단어·숙어·문장) 또는 한국어로 들어온다.
- 한국어면 그 뜻을 가장 자연스럽게 나타내는 중국어 표현 하나를 골라 카드로 만든다. 예) "여유가 없다" → 来不及 또는 没空, 상황상 더 흔한 것.
- 문맥 문장이 함께 주어지면, 그 문장에서 쓰인 뜻을 기준으로 정리한다.

[출력]
- kind: 다음 기준으로 하나를 고른다.
  - word: 사전에 표제어로 실리는 단어. 두세 글자 동사·형용사·부사·가능보어 형태도 여기에 넣는다. 예) 来得及, 来不及, 马上, 舒服, 看得懂.
  - idiom: 성어(대개 네 글자 고정 표현), 관용어, 비유적으로 굳어진 여러 단어 표현. 예) 马马虎虎, 一举两得, 走后门, 吃醋.
  - sentence: 주어·서술어가 있는 완결된 문장.
- hanzi: 카드의 중국어. 입력이 중국어면 그대로(오타만 바로잡는다).
- pinyin: 성조 기호를 쓰고 글자마다 한 음절씩 공백으로 구분(lái bu jí). 문맥에 맞는 읽기, 一·不 는 실제 성조.
- part_of_speech: 품사를 한국어로(동사, 명사, 형용사, 부사, 양사, 조사, 성어, 관용구 등). sentence 면 빈 문자열.
- meaning: 뜻. 한국어로 짧게, 뜻이 여럿이면 자주 쓰는 순서로 "1) … 2) …". sentence 면 자연스러운 한국어 해석 한 문장.
- explanation: 해석. 언제·어떻게 쓰는지, 비슷한 말과의 차이, 뉘앙스, 자주 붙는 짝(搭配)을 2~3문장 한국어로. sentence 면 문법·표현 포인트.
- examples: 이 표현을 쓴 예문 3개. 첫 번째는 짧고 쉬운 문장, 두 번째는 일상 회화, 세 번째는 조금 더 자연스러운 원어민 말투.
  sentence 면 같은 뜻을 다르게 말하는 문장 3개.
  각 예문: hanzi(중국어 문장, 중국어 문장부호), pinyin(글자마다 한 음절, 문장부호 제외), ko(한국어 해석).

[출력 언어]
- hanzi, examples.hanzi 만 중국어다. meaning, explanation, examples.ko, part_of_speech 는 반드시 한국어로 쓴다.
- 한국어 문장 안에 중국어 낱말(否定形, 搭配 등)이나 일본어를 섞지 않는다. 중국어 표현을 예로 들 때만 작은따옴표로 인용한다. 예) 부정형은 '来不及'이다.
- part_of_speech 는 한 단어로 짧게(동사, 형용사, 성어 등).

[규칙]
- 지어낸 뜻을 쓰지 않는다. 잘 모르는 신조어면 explanation 에 그 사실을 적는다.
`.trim();

export interface VocabCard {
  kind: ZhVocabKind;
  hanzi: string;
  pinyin: string;
  part_of_speech: string;
  meaning: string;
  explanation: string;
  examples: ZhExample[];
  model: string;
}

/** 입력·문맥이 중국어일수록 모델이 답까지 중국어로 쓰는 일이 있어, 요청 끝에 한 번 더 못 박는다 */
const KO_REMINDER = "※ meaning, explanation, part_of_speech, examples.ko 는 모두 한국어로 쓰세요. 중국어로 쓰지 마세요.";

/**
 * 시도 순서: 빠른 모델(최소 추론) → 빠른 모델(조금 더 생각, 지적 포함) → 리포트 모델.
 * 가벼운 모델은 입력이 중국어 위주면 뜻·해석을 중국어로 쓰는 경우가 있어,
 * 한국어 칸이 한국어가 아니면 다음 단계로 다시 만든다.
 */
const ATTEMPTS = [
  { model: () => MODELS.fast, effort: "minimal" as const },
  { model: () => MODELS.fast, effort: "low" as const },
  { model: () => MODELS.report, effort: "low" as const },
];

async function requestCard(input: string, context: string | null | undefined, model: string, effort: "minimal" | "low", feedback?: string) {
  const res = await openai().responses.parse({
    model,
    ...(model.startsWith("gpt-5") || model.startsWith("o") ? { reasoning: { effort } } : {}),
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `항목: ${input}`,
          context ? `문맥 문장: ${context}` : "",
          feedback ?? "",
          KO_REMINDER,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    text: { format: zodTextFormat(VocabSchema, "zh_vocab_card") },
  });
  return res.output_parsed;
}

export async function buildVocabCard(input: string, context?: string | null): Promise<VocabCard> {
  let out: z.infer<typeof VocabSchema> | null = null;
  let model = MODELS.fast;
  let feedback: string | undefined;

  for (const [i, step] of ATTEMPTS.entries()) {
    model = step.model();
    out = await requestCard(input, context, model, step.effort, feedback);
    if (!out) continue;
    const bad = nonKoreanFields(out);
    if (!bad.length) break;
    console.info(`[zh-vocab] "${input}" 시도${i + 1} 한국어 아님: ${bad.join(", ")}`);
    feedback = `직전 결과에서 ${bad.join(", ")} 칸이 한국어가 아니었습니다(중국어로 쓰였거나 중국어가 섞임). 이 칸들을 한국어로 다시 쓰세요.`;
    if (i === ATTEMPTS.length - 1) {
      throw new Error("뜻을 한국어로 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
  }
  if (!out) throw new Error("단어장 카드를 만들지 못했습니다.");

  const hanzi = out.hanzi.trim();
  return {
    kind: out.kind,
    hanzi,
    pinyin: verifyPinyin(hanzi, out.pinyin),
    part_of_speech: out.part_of_speech.trim(),
    meaning: out.meaning.trim(),
    explanation: out.explanation.trim(),
    examples: out.examples.slice(0, 3).map((e) => {
      const h = e.hanzi.trim();
      return { hanzi: h, pinyin: verifyPinyin(h, e.pinyin), ko: e.ko.trim() };
    }),
    model,
  };
}
