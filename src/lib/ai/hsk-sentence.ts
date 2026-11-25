import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { openai, MODELS } from "@/lib/openai";
import { HSK_LEVEL_SPEC, HSK_TOPICS, type HskLevel } from "@/lib/hsk";
import type { HskBlank, HskChoice } from "@/lib/types";
import type { BuiltSet } from "./hsk";

/*
 * HSK 독해 2부분 · 문장 고르기 (选句填空)
 * 지문에서 문장 5개를 빼고, 보기 6개(A~F) 중 알맞은 것을 고른다. 1개는 남는다.
 * 출제 → 형식 검사 → 보기 섞기 → 블라인드 검수 → 걸리면 보기 문장만 고쳐서 재검수.
 */

const SentenceItem = z.object({
  text: z.string(),
  /** 들어갈 빈칸 번호 (1~n), 남는 보기는 0 */
  blank: z.number().int(),
  note: z.string(),
});

const GenSchema = z.object({
  title: z.string(),
  passage: z.string(),
  translation_ko: z.string(),
  sentences: z.array(SentenceItem),
});
type Generated = z.infer<typeof GenSchema>;

const RepairSchema = z.object({ sentences: z.array(SentenceItem) });

const VerifySchema = z.object({
  blanks: z.array(
    z.object({
      no: z.number().int(),
      choice: z.number().int(),
      acceptable: z.array(z.number().int()),
      reason: z.string(),
    }),
  ),
});
type VerifyRow = z.infer<typeof VerifySchema>["blanks"][number];

const effort = (model: string, e: "minimal" | "low" | "medium") =>
  model.startsWith("gpt-5") || model.startsWith("o") ? { reasoning: { effort: e } } : {};

const TIME_BUDGET_MS = 230_000;

function genSystem(level: HskLevel) {
  const spec = HSK_LEVEL_SPEC[level];
  const n = spec.blanks;
  return `
당신은 HSK ${level}급 독해 문제 출제위원입니다. 한국어 화자를 위한 연습 문제를 새로 만듭니다.
형식: 독해 2부분 문장 고르기(选句填空). 지문에서 완전한 문장 ${n}개를 빼서 빈칸으로 두고, 보기 ${n + 1}개 중에서 고르게 합니다. 보기 1개는 어디에도 들어가지 않고 남습니다.

[지문]
- 간체자, 중국 대륙 표준어. 빈칸 문장을 뺀 나머지 길이 ${spec.passage2[0]}~${spec.passage2[1]}자.
- 설명문·기사·이야기 등 하나의 흐름이 분명한 글. 실제 기출 지문을 베끼지 말고 새로 쓴다. 사실 관계가 틀린 내용은 쓰지 않는다.
- 빈칸 자리는 {{1}} … {{${n}}} 로, 번호 순서대로 각각 정확히 한 번. 빈칸은 문장 하나가 통째로 들어갈 자리다(앞 문장이 。！？로 끝난 뒤).
- 빈칸 두 개가 연달아 와도 된다.
- 어휘는 HSK ${level}급 범위.

[보기 문장 sentences: 정확히 ${n + 1}개]
- 각 문장은 완전한 문장으로, 。！？로 끝난다. 길이는 서로 비슷하게(12~30자).
- blank: 들어갈 빈칸 번호. 남는 보기 하나만 0.
- 정답은 빈칸마다 정확히 하나. 아래 단서로 자리가 정해져야 한다:
  - 앞뒤를 잇는 말: 刚开始 / 这样一来 / 可见 / 因此 / 然而 / 此外 / 后来 …
  - 가리키는 말: 这种方式 / 这一做法 / 他们 — 앞에 무엇을 가리키는지 나와 있어야 한다
  - 시간 순서, 원인→결과, 사례→결론, 주장→근거 같은 논리
  - 바로 뒤 문장이 그 문장을 받아서 이어 가는 경우
- 두 보기를 서로 바꿔 넣어도 말이 되는 일이 없게 한다.
- 남는 보기: 주제와 관련 있어 그럴듯하지만, 지문 어디에도 근거가 없거나 흐름과 어긋나는 문장 (예: 지문에 없는 원인을 끌어옴).
- note: 한국어 1~2문장. 정답 문장이면 "어떤 단서로 몇 번 자리에 들어가는지", 남는 보기면 "왜 어느 빈칸에도 맞지 않는지".

[번역]
- translation_ko: 빈칸에 정답 문장을 채운 지문 전체의 한국어 번역.

[출력 언어]
- title, passage, sentences.text 만 중국어. note, translation_ko 는 한국어.
`.trim();
}

const VERIFY_SYSTEM = `
당신은 중국어 원어민 교사이자 HSK 문제 검수자입니다. 문장 고르기 문제를 정답 없이 받아 실제 수험생처럼 풉니다.
보기는 0번부터 번호가 붙어 있고, 한 보기는 한 번만 쓰며 하나는 남습니다. 확실한 빈칸부터 채우고 소거법도 쓴다.
각 빈칸에 대해:
- choice: 최종 답 보기 번호. 빈칸끼리 같은 보기를 고르지 않는다 (전체 배치가 일대일).
- acceptable: 소거하기 전, 앞뒤 흐름만 보고 들어갈 수 있다고 본 보기 번호 (참고용).
- reason: 한국어 한 문장 (어떤 단서로 판단했는지).
`.trim();

function checkShape(g: Generated, n: number): string | null {
  const markers = [...g.passage.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  if (markers.join(",") !== Array.from({ length: n }, (_, i) => i + 1).join(",")) return `빈칸 표시 ${markers.join(",")}`;
  if (g.sentences.length !== n + 1) return `보기 ${g.sentences.length}개`;
  const blanks = g.sentences.map((s) => s.blank).sort((a, b) => a - b);
  if (blanks.join(",") !== [0, ...Array.from({ length: n }, (_, i) => i + 1)].join(",")) return `보기 배정 ${blanks.join(",")}`;
  const texts = g.sentences.map((s) => s.text.trim());
  if (new Set(texts).size !== texts.length || texts.some((t) => !t)) return "보기 중복";
  return null;
}

/** 보기를 A~F 로 섞고, 빈칸별 정답 번호를 만든다 */
function arrange(sentences: Generated["sentences"], n: number): { choices: HskChoice[]; blanks: HskBlank[] } {
  const order = sentences.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const shuffled = order.map((k) => sentences[k]);
  const choices = shuffled.map((s) => ({ text: s.text.trim(), note: s.note.trim() }));
  const blanks: HskBlank[] = Array.from({ length: n }, (_, i) => {
    const idx = shuffled.findIndex((s) => s.blank === i + 1);
    return {
      no: i + 1,
      kind: "sentence",
      options: [],
      option_notes: [],
      answer: idx,
      explanation: shuffled[idx].note.trim(),
    };
  });
  return { choices, blanks };
}

/** 지금 배치를 출제 형식으로 되돌린다 (고치기 요청용) */
function toItems(choices: HskChoice[], blanks: HskBlank[]) {
  return choices.map((c, i) => ({ text: c.text, note: c.note, blank: blanks.find((b) => b.answer === i)?.no ?? 0 }));
}

async function generateOnce(level: HskLevel, topic: string, avoidTitles: string[]) {
  const model = MODELS.report;
  const res = await openai().responses.parse({
    model,
    ...effort(model, "low"),
    input: [
      { role: "system", content: genSystem(level) },
      {
        role: "user",
        content: [`주제: ${topic}`, avoidTitles.length ? `최근 출제한 제목과 겹치지 않게: ${avoidTitles.join(" / ")}` : ""]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    text: { format: zodTextFormat(GenSchema, "hsk_sentence_set") },
  });
  if (!res.output_parsed) throw new Error("출제 결과를 해석하지 못했습니다.");
  return { g: res.output_parsed, model };
}

async function verifyBlind(passage: string, choices: HskChoice[]) {
  const model = MODELS.report;
  const res = await openai().responses.parse({
    model,
    ...effort(model, "low"),
    input: [
      { role: "system", content: VERIFY_SYSTEM },
      { role: "user", content: [passage, "", ...choices.map((c, i) => `${i}) ${c.text}`)].join("\n") },
    ],
    text: { format: zodTextFormat(VerifySchema, "hsk_sentence_verify") },
  });
  if (!res.output_parsed) throw new Error("검수 결과를 해석하지 못했습니다.");
  return res.output_parsed.blanks;
}

/**
 * 2부분 통과 기준: 검수자가 정답 없이 일대일로 채운 배치가 정답과 똑같아야 한다.
 * (실제 시험처럼 단서와 소거로 하나로 정해지면 된다. acceptable 은 참고용)
 */
function failed(blanks: HskBlank[], result: VerifyRow[]) {
  return blanks
    .filter((b) => {
      const v = result.find((r) => r.no === b.no);
      return !v || v.choice !== b.answer;
    })
    .map((b) => b.no);
}

async function repair(level: HskLevel, passage: string, choices: HskChoice[], blanks: HskBlank[], result: VerifyRow[], bad: number[]) {
  const model = MODELS.report;
  const feedback = bad
    .map((no) => {
      const b = blanks.find((x) => x.no === no)!;
      const v = result.find((r) => r.no === no);
      const also = v ? v.acceptable.filter((a) => a !== b.answer).map((a) => `「${choices[a]?.text}」`) : [];
      return [
        `${no}번 — 정답: 「${choices[b.answer].text}」`,
        v && v.choice !== b.answer ? `  검수자는 「${choices[v.choice]?.text}」를 골랐음.` : "",
        also.length ? `  함께 들어갈 수 있다고 본 보기: ${also.join(", ")}` : "",
        v ? `  검수 의견: ${v.reason}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
  const items = toItems(choices, blanks);
  const res = await openai().responses.parse({
    model,
    ...effort(model, "low"),
    input: [
      { role: "system", content: genSystem(level) },
      {
        role: "user",
        content: [
          "아래 문제의 일부 빈칸에서 정답이 하나로 모이지 않았습니다. 지문은 그대로 두고, 보기 문장만 고쳐서 빈칸마다 정답이 하나만 남게 하세요.",
          "- 각 보기의 blank 배정은 바꾸지 않는다. 문장에 앞뒤를 잇는 말·가리키는 말·논리 단서를 더 분명히 넣는다.",
          "- 헷갈린 보기끼리는 서로의 자리에 들어가지 못하게 다듬는다. 남는 보기(blank 0)는 어느 빈칸에도 맞지 않게.",
          "- 보기 6개 전부를 같은 순서로 돌려준다 (고칠 필요 없는 문장은 그대로).",
          "",
          "[지문]",
          passage,
          "",
          "[현재 보기]",
          ...items.map((it, i) => `${i}) blank=${it.blank} ${it.text}`),
          "",
          "[검수 결과]",
          feedback,
        ].join("\n"),
      },
    ],
    text: { format: zodTextFormat(RepairSchema, "hsk_sentence_repair") },
  });
  const out = res.output_parsed?.sentences;
  if (!out || out.length !== choices.length) return null;
  // 배정이 바뀌었으면 받아들이지 않는다
  if (out.some((s, i) => s.blank !== items[i].blank)) return null;
  return {
    choices: out.map((s) => ({ text: s.text.trim(), note: s.note.trim() })),
    blanks: blanks.map((b) => ({ ...b, explanation: out[b.answer].note.trim() })),
  };
}

export async function buildSentenceSet(opts: {
  level: HskLevel;
  topic?: string | null;
  avoidTitles?: string[];
}): Promise<BuiltSet> {
  const n = HSK_LEVEL_SPEC[opts.level].blanks;
  const topic = opts.topic || HSK_TOPICS[Math.floor(Math.random() * HSK_TOPICS.length)];
  const problems: string[] = [];
  const began = Date.now();
  const left = () => TIME_BUDGET_MS - (Date.now() - began);
  let calls = 0;

  // 2부분은 새로 쓰기(약 30초)가 고치기(약 80초)보다 빨라서, 걸리면 고치기 대신 새로 쓴다.
  // 고치기는 빈칸 하나만 걸렸고 시간이 넉넉할 때만.
  for (let attempt = 1; attempt <= 3 && left() > 75_000; attempt++) {
    const t0 = Date.now();
    const { g, model } = await generateOnce(opts.level, topic, opts.avoidTitles ?? []);
    calls++;
    const shape = checkShape(g, n);
    if (shape) {
      problems.push(`형식: ${shape}`);
      console.info(`[hsk2] 출제#${attempt} ${Date.now() - t0}ms, 형식 탈락: ${shape}`);
      continue;
    }
    let { choices, blanks } = arrange(g.sentences, n);
    const t1 = Date.now();
    let result = await verifyBlind(g.passage, choices);
    calls++;
    let bad = failed(blanks, result);
    console.info(`[hsk2] 출제#${attempt} ${t1 - t0}ms, 검수 ${Date.now() - t1}ms, 걸림 [${bad.join(",")}]`);

    for (let round = 1; bad.length === 1 && round <= 1 && left() > 150_000; round++) {
      const t2 = Date.now();
      const fixed = await repair(opts.level, g.passage, choices, blanks, result, bad).catch(() => null);
      calls++;
      if (!fixed) break;
      ({ choices, blanks } = fixed);
      result = await verifyBlind(g.passage, choices);
      calls++;
      bad = failed(blanks, result);
      console.info(`[hsk2]  고치기#${round} ${Date.now() - t2}ms, 걸림 [${bad.join(",")}]`);
    }

    if (bad.length) {
      problems.push(`검수: ${bad.join(",")}번 정답이 하나로 모이지 않음`);
      continue;
    }
    console.info(`[hsk2] 완성 ${Date.now() - began}ms, 호출 ${calls}회`);
    return {
      level: opts.level,
      part: 2,
      topic,
      title: g.title.trim(),
      passage: g.passage.trim(),
      translation_ko: g.translation_ko.trim(),
      blanks,
      choices,
      verify: { attempts: calls, result: result.sort((a, b) => a.no - b.no) },
      model,
    };
  }
  throw new Error(`좋은 문제를 만들지 못했습니다. 잠시 뒤 다시 시도하세요. (${problems.join(" / ") || "시간 초과"})`);
}
