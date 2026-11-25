import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { openai, MODELS } from "@/lib/openai";
import { HSK_LEVEL_SPEC, HSK_TOPICS, type HskLevel, type HskPart } from "@/lib/hsk";
import type { HskBlank, HskChoice } from "@/lib/types";
import { buildSentenceSet } from "./hsk-sentence";

/* ───────── 출제 ───────── */

const GenSchema = z.object({
  title: z.string(),
  passage: z.string(),
  translation_ko: z.string(),
  blanks: z.array(
    z.object({
      no: z.number().int(),
      kind: z.enum(["collocation", "idiom", "connective"]),
      options: z.array(z.string()),
      answer: z.number().int(),
      explanation: z.string(),
      option_notes: z.array(z.string()),
    }),
  ),
});
type Generated = z.infer<typeof GenSchema>;

function genSystem(level: HskLevel) {
  const spec = HSK_LEVEL_SPEC[level];
  return `
당신은 HSK ${level}급 독해 문제 출제위원입니다. 한국어 화자를 위한 연습 문제를 새로 만듭니다.
형식: 지문 1개에 빈칸 ${spec.blanks}개, 빈칸마다 보기 4개 (选词填空).

[지문]
- 간체자, 중국 대륙 표준어. 길이 ${spec.passage[0]}~${spec.passage[1]}자(문장부호 포함).
- 설명문·논설문·이야기 등 HSK ${level}급 독해에 나올 법한 글. 실제 기출 지문을 베끼지 말고 새로 쓴다. 사실 관계가 틀린 내용은 쓰지 않는다.
- 빈칸 자리는 {{1}}, {{2}} … {{${spec.blanks}}} 로 표시한다. 번호 순서대로 각각 정확히 한 번씩. 빈칸 표시 바로 앞뒤에 정답 단어의 일부를 남기지 않는다.
- 어휘는 HSK ${level}급 공식 어휘 범위 안에서 쓴다.
- title: 지문 제목(중국어, 짧게).

[빈칸과 보기]
- 정답은 정확히 하나. 나머지 세 보기는 문법·호응(搭配)·의미·논리 가운데 하나 이상에서 분명히 틀려야 한다. 원어민 교사가 봐도 다른 보기가 들어갈 여지가 없어야 한다.
- 한 빈칸의 보기 4개는 같은 품사, 같은 글자 수로 맞춘다 (2자 단어끼리, 4자 성어끼리). 뜻이 비슷한 유의어나 한 글자를 공유하는 단어로 헷갈리게 만든다.
- ${spec.blanks}개 빈칸의 유형을 섞는다: kind
  - collocation: 동사·명사·형용사의 호응 (예: 提高 水平 / 改善 条件)
  - idiom: 4자 성어
  - connective: 접속어·부사로 앞뒤 논리 관계 (예: 尽管 / 何况 / 反而 / 毕竟)
  최소 collocation 2개, idiom 1개, connective 1개.
- answer: 정답 보기 번호 (0~3).
- explanation: 왜 정답인지 한국어 2~3문장. 빈칸 앞뒤의 어떤 말과 호응하는지, 문맥 논리가 무엇인지 근거를 든다.
- option_notes: 보기 4개 각각에 대해 한국어 한두 문장. "뜻 — 맞거나 틀린 이유" 형식. options 와 같은 순서.

[번역]
- translation_ko: 정답을 채운 지문 전체의 자연스러운 한국어 번역.

[출력 언어]
- title, passage, options 만 중국어. explanation, option_notes, translation_ko 는 한국어 (중국어 표현은 인용할 때만).
`.trim();
}

/* ───────── 블라인드 검수: 정답을 숨기고 직접 풀게 한다 ───────── */

const VerifySchema = z.object({
  blanks: z.array(
    z.object({
      no: z.number().int(),
      choice: z.number().int(),
      /** 문법·의미상 들어갈 수 있는 보기 전부 */
      acceptable: z.array(z.number().int()),
      reason: z.string(),
    }),
  ),
});
export type VerifyResult = z.infer<typeof VerifySchema>;

const VERIFY_SYSTEM = `
당신은 중국어 원어민 교사이자 HSK 문제 검수자입니다. 빈칸 채우기 문제를 정답 없이 받습니다.
각 빈칸에 대해:
- choice: 가장 알맞은 보기 번호 (0~3).
- acceptable: 문법·호응·의미·문맥상 자연스럽게 들어갈 수 있는 보기 번호를 모두. 조금이라도 원어민이 쓸 만하면 넣는다. 엄격하게 판단한다.
- reason: 한국어 한 문장.
`.trim();

/* ───────── 실행 ───────── */

export interface BuiltSet {
  level: number;
  part: number;
  topic: string;
  title: string;
  passage: string;
  translation_ko: string;
  blanks: HskBlank[];
  /** 2부분 공용 보기. 1부분은 null */
  choices: HskChoice[] | null;
  verify: { attempts: number; result: VerifyResult["blanks"] };
  model: string;
}

/** 형식 검사. 문제가 있으면 이유를, 없으면 null */
function checkShape(g: Generated, blanksWanted: number): string | null {
  if (g.blanks.length !== blanksWanted) return `빈칸 ${g.blanks.length}개`;
  const markers = [...g.passage.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const expected = Array.from({ length: blanksWanted }, (_, i) => i + 1);
  if (markers.join(",") !== expected.join(",")) return `빈칸 표시 ${markers.join(",")}`;
  for (const [i, b] of g.blanks.entries()) {
    if (b.no !== i + 1) return `빈칸 번호 ${b.no}`;
    if (b.options.length !== 4 || b.option_notes.length !== 4) return `${b.no}번 보기 수`;
    const opts = b.options.map((o) => o.trim());
    if (new Set(opts).size !== 4 || opts.some((o) => !o)) return `${b.no}번 보기 중복`;
    if (new Set(opts.map((o) => [...o].length)).size !== 1) return `${b.no}번 보기 글자 수`;
    if (!(b.answer >= 0 && b.answer <= 3)) return `${b.no}번 정답 번호`;
  }
  return null;
}

/** 정답 위치가 한쪽에 몰리지 않게 보기를 섞는다 (설명도 같이) */
function shuffleBlank(b: Generated["blanks"][number]): HskBlank {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    no: b.no,
    kind: b.kind,
    options: order.map((k) => b.options[k].trim()),
    option_notes: order.map((k) => b.option_notes[k].trim()),
    answer: order.indexOf(b.answer),
    explanation: b.explanation.trim(),
  };
}

export const effort = (model: string, e: "minimal" | "low" | "medium") =>
  model.startsWith("gpt-5") || model.startsWith("o") ? { reasoning: { effort: e } } : {};

async function generateOnce(level: HskLevel, topic: string, focusWords: string[], avoidTitles: string[]) {
  const model = MODELS.report;
  const res = await openai().responses.parse({
    model,
    ...effort(model, "low"),
    input: [
      { role: "system", content: genSystem(level) },
      {
        role: "user",
        content: [
          `주제: ${topic}`,
          focusWords.length
            ? `다음 단어를 정답으로 꼭 포함하세요 (각각 한 빈칸의 정답): ${focusWords.join(", ")}`
            : "",
          avoidTitles.length ? `최근 출제한 제목과 겹치지 않게: ${avoidTitles.join(" / ")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    text: { format: zodTextFormat(GenSchema, "hsk_set") },
  });
  if (!res.output_parsed) throw new Error("출제 결과를 해석하지 못했습니다.");
  return { g: res.output_parsed, model };
}

/** 블라인드 검수. only 를 주면 그 빈칸들만 묻는다 (지문 전체는 문맥으로 준다) */
async function verifyBlind(passage: string, blanks: HskBlank[], only?: number[]) {
  const model = MODELS.report;
  const asked = only ? blanks.filter((b) => only.includes(b.no)) : blanks;
  const problem = [
    passage,
    "",
    only ? `아래 빈칸만 답하세요: ${only.join(", ")}번` : "",
    ...asked.map((b) => `${b.no}. ${b.options.map((o, i) => `${i}) ${o}`).join("  ")}`),
  ]
    .filter((l, i) => l !== "" || i === 1)
    .join("\n");
  const res = await openai().responses.parse({
    model,
    ...effort(model, "low"),
    input: [
      { role: "system", content: VERIFY_SYSTEM },
      { role: "user", content: problem },
    ],
    text: { format: zodTextFormat(VerifySchema, "hsk_verify") },
  });
  if (!res.output_parsed) throw new Error("검수 결과를 해석하지 못했습니다.");
  return res.output_parsed.blanks;
}

/** 검수에서 정답이 하나로 모이지 않은 빈칸 번호 */
function failedBlanks(blanks: HskBlank[], result: VerifyResult["blanks"], only?: number[]) {
  return blanks
    .filter((b) => !only || only.includes(b.no))
    .filter((b) => {
      const v = result.find((r) => r.no === b.no);
      return !v || v.choice !== b.answer || v.acceptable.some((a) => a !== b.answer);
    })
    .map((b) => b.no);
}

/* ───────── 고치기: 걸린 빈칸의 보기만 다시 만든다 ───────── */

const RepairSchema = z.object({
  blanks: z.array(
    z.object({
      no: z.number().int(),
      kind: z.enum(["collocation", "idiom", "connective"]),
      options: z.array(z.string()),
      answer: z.number().int(),
      explanation: z.string(),
      option_notes: z.array(z.string()),
    }),
  ),
});

async function repairBlanks(level: HskLevel, passage: string, blanks: HskBlank[], result: VerifyResult["blanks"], nos: number[]) {
  const model = MODELS.report;
  const feedback = nos
    .map((no) => {
      const b = blanks.find((x) => x.no === no)!;
      const v = result.find((r) => r.no === no);
      const also = v ? v.acceptable.filter((a) => a !== b.answer).map((a) => b.options[a]) : [];
      return [
        `${no}번 — 정답: ${b.options[b.answer]} / 보기: ${b.options.join(", ")}`,
        v && v.choice !== b.answer ? `  검수자는 ${b.options[v.choice]}를 골랐음.` : "",
        also.length ? `  검수자가 함께 가능하다고 본 보기: ${also.join(", ")}` : "",
        v ? `  검수 의견: ${v.reason}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
  const res = await openai().responses.parse({
    model,
    ...effort(model, "low"),
    input: [
      { role: "system", content: genSystem(level) },
      {
        role: "user",
        content: [
          "아래 지문의 일부 빈칸이 검수에서 정답이 하나로 모이지 않았습니다. 지문은 그대로 두고, 지적된 빈칸의 보기만 다시 만드세요.",
          "- 정답 단어는 문맥에 확실히 맞으면 그대로 두고, 애매하면 더 분명한 단어로 바꾼다.",
          "- 오답 보기는 같은 품사·같은 글자 수·비슷한 모양을 유지하되, 이 문맥에서는 호응·의미·논리상 분명히 들어갈 수 없는 단어로 고른다. 검수자가 가능하다고 본 단어는 빼고 다른 단어로.",
          "- 지적된 빈칸만 blanks 에 담는다.",
          "",
          "[지문]",
          passage,
          "",
          "[검수 결과]",
          feedback,
        ].join("\n"),
      },
    ],
    text: { format: zodTextFormat(RepairSchema, "hsk_repair") },
  });
  const out = res.output_parsed?.blanks ?? [];
  // 형식이 맞는 것만 받아들인다
  return out.filter(
    (b) =>
      nos.includes(b.no) &&
      b.options.length === 4 &&
      b.option_notes.length === 4 &&
      new Set(b.options.map((o) => o.trim())).size === 4 &&
      new Set(b.options.map((o) => [...o.trim()].length)).size === 1 &&
      b.answer >= 0 &&
      b.answer <= 3,
  );
}

/** 생성 한 건에 쓸 수 있는 시간 (서버 제한 300초 안에서 여유를 둔다) */
export const TIME_BUDGET_MS = 230_000;

/**
 * 세트 하나를 만든다: 출제 → 형식 검사 → 보기 섞기 → 블라인드 검수.
 * 검수에 걸린 빈칸은 버리지 않고 그 빈칸의 보기만 고쳐서 다시 검수한다 (최대 2번).
 * 그래도 안 되거나 형식이 틀리면 새로 출제한다. 시간 예산을 넘기면 멈춘다.
 */
export async function buildHskSet(opts: {
  level: HskLevel;
  part: HskPart;
  topic?: string | null;
  focusWords?: string[];
  avoidTitles?: string[];
}): Promise<BuiltSet> {
  return opts.part === 2 ? buildSentenceSet(opts) : buildWordSet(opts);
}

/** 1부분: 단어 빈칸 */
async function buildWordSet(opts: {
  level: HskLevel;
  topic?: string | null;
  focusWords?: string[];
  avoidTitles?: string[];
}): Promise<BuiltSet> {
  const spec = HSK_LEVEL_SPEC[opts.level];
  const topic = opts.topic || HSK_TOPICS[Math.floor(Math.random() * HSK_TOPICS.length)];
  const problems: string[] = [];
  const began = Date.now();
  const left = () => TIME_BUDGET_MS - (Date.now() - began);
  let calls = 0;

  for (let attempt = 1; attempt <= 2 && left() > 90_000; attempt++) {
    const t0 = Date.now();
    const { g, model } = await generateOnce(opts.level, topic, opts.focusWords ?? [], opts.avoidTitles ?? []);
    calls++;
    const shape = checkShape(g, spec.blanks);
    if (shape) {
      problems.push(`형식: ${shape}`);
      console.info(`[hsk] 출제#${attempt} ${Date.now() - t0}ms, 형식 탈락: ${shape}`);
      continue;
    }
    let blanks = g.blanks.map(shuffleBlank);
    const t1 = Date.now();
    let result = await verifyBlind(g.passage, blanks);
    calls++;
    let bad = failedBlanks(blanks, result);
    console.info(`[hsk] 출제#${attempt} ${t1 - t0}ms, 검수 ${Date.now() - t1}ms, 걸림 [${bad.join(",")}]`);

    for (let round = 1; bad.length && round <= 2 && left() > 45_000; round++) {
      const t2 = Date.now();
      const fixed = await repairBlanks(opts.level, g.passage, blanks, result, bad).catch(() => []);
      calls++;
      if (!fixed.length) break;
      blanks = blanks.map((b) => {
        const f = fixed.find((x) => x.no === b.no);
        return f ? shuffleBlank({ ...f, no: b.no }) : b;
      });
      const recheck = await verifyBlind(g.passage, blanks, bad);
      calls++;
      result = [...result.filter((r) => !bad.includes(r.no)), ...recheck];
      bad = failedBlanks(blanks, result);
      console.info(`[hsk]  고치기#${round} ${Date.now() - t2}ms, 걸림 [${bad.join(",")}]`);
    }

    if (bad.length) {
      problems.push(`검수: ${bad.join(",")}번 정답이 하나로 모이지 않음`);
      continue;
    }
    console.info(`[hsk] 완성 ${Date.now() - began}ms, 호출 ${calls}회`);
    return {
      level: opts.level,
      part: 1,
      topic,
      title: g.title.trim(),
      passage: g.passage.trim(),
      translation_ko: g.translation_ko.trim(),
      blanks,
      choices: null,
      verify: { attempts: calls, result: result.sort((a, b) => a.no - b.no) },
      model,
    };
  }
  throw new Error(`좋은 문제를 만들지 못했습니다. 잠시 뒤 다시 시도하세요. (${problems.join(" / ") || "시간 초과"})`);
}
