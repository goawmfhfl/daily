import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { openai, MODELS } from "@/lib/openai";
import { HSK_LEVEL_SPEC, HSK_TOPICS, stripUnderline, type HskLevel } from "@/lib/hsk";
import type { HskBlank } from "@/lib/types";
import type { BuiltSet } from "./hsk";

/*
 * HSK 독해 3부분 · 독해 이해 (阅读理解)
 * 지문 하나에 4문항, 보기 A~D. 세부 정보 2 + 태도·심경 추론 1 + 종합 추론 1 이 기본.
 * 출제 → 형식 검사 → 보기 섞기 → 블라인드 검수 → 걸린 문항만 고쳐서 재검수 → 그래도 안 되면 새로.
 */

const KIND = z.enum(["detail", "attitude", "inference", "meaning"]);

const Question = z.object({
  kind: KIND,
  stem: z.string(),
  options: z.array(z.string()),
  answer: z.number().int(),
  evidence: z.string(),
  explanation: z.string(),
  option_notes: z.array(z.string()),
});
type Q = z.infer<typeof Question>;

const GenSchema = z.object({
  title: z.string(),
  passage: z.string(),
  translation_ko: z.string(),
  questions: z.array(Question),
});
type Generated = z.infer<typeof GenSchema>;

const RepairSchema = z.object({ questions: z.array(Question.extend({ no: z.number().int() })) });

const VerifySchema = z.object({
  questions: z.array(
    z.object({
      no: z.number().int(),
      choice: z.number().int(),
      /** 본문으로 정답이라고 방어할 수 있는 보기 전부 */
      acceptable: z.array(z.number().int()),
      evidence: z.string(),
      reason: z.string(),
    }),
  ),
});
type VerifyRow = z.infer<typeof VerifySchema>["questions"][number];

const effort = (model: string, e: "minimal" | "low" | "medium") =>
  model.startsWith("gpt-5") || model.startsWith("o") ? { reasoning: { effort: e } } : {};

const TIME_BUDGET_MS = 230_000;

function genSystem(level: HskLevel) {
  const spec = HSK_LEVEL_SPEC[level];
  const n = spec.questions3;
  return `
당신은 HSK ${level}급 독해 문제 출제위원입니다. 한국어 화자를 위한 연습 문제를 새로 만듭니다.
형식: 독해 3부분 독해 이해(阅读理解). 지문 1개를 읽고 ${n}문항, 문항마다 보기 4개(A~D).

[지문]
- 간체자, 중국 대륙 표준어. 길이 ${spec.passage3[0]}~${spec.passage3[1]}자. 3~5개 문단(문단 사이는 줄바꿈 한 번).
- 신문 기사·사회 현상·과학 상식·인물 이야기·생활 정보 등 HSK ${level}급 독해에 나올 법한 글. 시범 운영, 처음의 우려, 의외의 결과, 새로 생긴 문제와 대응, 관계자의 평가처럼 정보가 여러 겹인 구성이 좋다.
- 실제 기출 지문을 베끼지 말고 새로 쓴다. 사실처럼 단정하기 어려운 수치·고유명사는 지어내지 말고 "某市" "一家公司"처럼 쓴다.
- 어휘는 HSK ${level}급 범위.
- title: 지문 제목(중국어, 짧게).

[문항 questions: 정확히 ${n}개, 지문 순서를 따르고 종합 추론은 마지막]
- kind 구성: detail(세부 정보) 2개, attitude(인물의 태도·심경 추론) 1개, inference(본문 전체로 알 수 있는 것) 1개.
  - 원하면 detail 하나 대신 meaning(밑줄 친 표현의 뜻) 1개. 이때 지문의 그 표현을 [[ ]]로 감싸고, stem 은 "第X段画线词语“…”的意思是：" 형식.
- stem: 질문형("那位常客为什么喜欢晚上去图书馆？") 또는 완성형("对于夜间开放，起初工作人员：", "根据上文，可以知道：")을 섞는다.
- 정답: 본문의 한 문장(또는 두 문장)으로 근거를 댈 수 있어야 한다. 정답 보기는 본문 표현을 그대로 베끼지 말고 바꿔 말한다(同义替换).
- evidence: 정답 근거가 되는 본문 문장을 지문에서 글자 그대로 복사 ([[ ]] 표시는 빼고).
- 오답 보기 3개는 아래 패턴을 섞어 만든다. 본문과 분명히 어긋나야 하며, 그럴듯해야 한다.
  1) 반대로 뒤집기: 본문 내용을 정반대로
  2) 과장·범위 넘기기: 坚决 / 所有 / 一定 / 完全 / 只 처럼 본문보다 세게
  3) 본문에 없는 내용: 주제와 관련 있지만 언급되지 않은 것
  4) 대상 바꾸기: 다른 사람·다른 시점의 내용을 섞기
- 보기 4개는 길이와 문체를 비슷하게. 정답만 길거나 자세하지 않게.
- answer: 정답 보기 번호(0~3).
- explanation: 한국어 2문장. 근거 문장이 무엇을 말하는지와 정답이 그것을 어떻게 바꿔 말했는지.
- option_notes: 보기 4개 각각 한국어 한 문장. 오답이면 어떤 패턴(반대/과장/본문에 없음/대상 바꿈)인지와 본문과 어디가 어긋나는지.

[번역]
- translation_ko: 지문 전체의 자연스러운 한국어 번역 (문단 유지).

[출력 언어]
- title, passage, stem, options, evidence 는 중국어. explanation, option_notes, translation_ko 는 한국어.
`.trim();
}

const VERIFY_SYSTEM = `
당신은 중국어 원어민 교사이자 HSK 문제 검수자입니다. 독해 문제를 정답 없이 받아 수험생처럼 풉니다.
각 문항에 대해:
- choice: 정답 보기 번호 (0~3).
- acceptable: 본문을 근거로 정답이라고 방어할 수 있는 보기 번호를 모두. 본문과 어긋나거나 근거가 없으면 넣지 않는다. 엄격하게 판단한다.
- evidence: 판단 근거가 된 본문 문장 (그대로 인용).
- reason: 한국어 한 문장.
`.trim();

const norm = (s: string) => stripUnderline(s).replace(/\s+/g, "");

function checkShape(g: Generated, n: number): string | null {
  if (g.questions.length !== n) return `문항 ${g.questions.length}개`;
  const len = [...norm(g.passage)].length;
  if (len < 400) return `지문 ${len}자`;
  for (const [i, q] of g.questions.entries()) {
    if (q.options.length !== 4 || q.option_notes.length !== 4) return `${i + 1}번 보기 수`;
    const opts = q.options.map((o) => o.trim());
    if (new Set(opts).size !== 4 || opts.some((o) => !o)) return `${i + 1}번 보기 중복`;
    if (!(q.answer >= 0 && q.answer <= 3)) return `${i + 1}번 정답 번호`;
    if (!q.stem.trim()) return `${i + 1}번 줄기 없음`;
  }
  const meanings = g.questions.filter((q) => q.kind === "meaning").length;
  const marks = [...g.passage.matchAll(/\[\[(.+?)\]\]/g)].length;
  if (meanings > 1) return "뜻 추론 2개";
  if (meanings === 1 && marks !== 1) return `밑줄 ${marks}개`;
  return null;
}

/** 보기를 섞어 정답 위치를 고르게 (설명도 같이) */
function toBlank(q: Q, no: number, passage: string): HskBlank {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // 근거가 본문에 그대로 있을 때만 남긴다 (화면에서 본문에 표시하므로)
  const evidence = q.evidence.trim();
  const found = evidence && norm(passage).includes(norm(evidence));
  return {
    no,
    kind: q.kind,
    stem: q.stem.trim(),
    options: order.map((k) => q.options[k].trim()),
    option_notes: order.map((k) => q.option_notes[k].trim()),
    answer: order.indexOf(q.answer),
    explanation: q.explanation.trim(),
    evidence: found ? stripUnderline(evidence) : "",
  };
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
    text: { format: zodTextFormat(GenSchema, "hsk_reading_set") },
  });
  if (!res.output_parsed) throw new Error("출제 결과를 해석하지 못했습니다.");
  return { g: res.output_parsed, model };
}

/** 블라인드 검수. only 를 주면 그 문항만 */
async function verifyBlind(passage: string, blanks: HskBlank[], only?: number[]) {
  const model = MODELS.report;
  const asked = only ? blanks.filter((b) => only.includes(b.no)) : blanks;
  const problem = [
    passage,
    "",
    ...asked.flatMap((b) => [`${b.no}. ${b.stem}`, ...b.options.map((o, i) => `  ${i}) ${o}`)]),
  ].join("\n");
  const res = await openai().responses.parse({
    model,
    ...effort(model, "low"),
    input: [
      { role: "system", content: VERIFY_SYSTEM },
      { role: "user", content: problem },
    ],
    text: { format: zodTextFormat(VerifySchema, "hsk_reading_verify") },
  });
  if (!res.output_parsed) throw new Error("검수 결과를 해석하지 못했습니다.");
  return res.output_parsed.questions;
}

function failed(blanks: HskBlank[], result: VerifyRow[], only?: number[]) {
  return blanks
    .filter((b) => !only || only.includes(b.no))
    .filter((b) => {
      const v = result.find((r) => r.no === b.no);
      return !v || v.choice !== b.answer || v.acceptable.some((a) => a !== b.answer);
    })
    .map((b) => b.no);
}

/** 걸린 문항만 다시: 지문은 그대로, 줄기·보기·해설을 고친다 */
async function repair(level: HskLevel, passage: string, blanks: HskBlank[], result: VerifyRow[], bad: number[]) {
  const model = MODELS.report;
  const feedback = bad
    .map((no) => {
      const b = blanks.find((x) => x.no === no)!;
      const v = result.find((r) => r.no === no);
      const also = v ? v.acceptable.filter((a) => a !== b.answer).map((a) => `「${b.options[a]}」`) : [];
      return [
        `${no}번 (${b.kind}) ${b.stem}`,
        ...b.options.map((o, i) => `  ${i}) ${o}${i === b.answer ? "  ← 정답" : ""}`),
        v && v.choice !== b.answer ? `  검수자는 「${b.options[v.choice]}」를 골랐음.` : "",
        also.length ? `  검수자가 함께 정답으로 방어할 수 있다고 본 보기: ${also.join(", ")}` : "",
        v ? `  검수 의견: ${v.reason}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
  const res = await openai().responses.parse({
    model,
    ...effort(model, "low"),
    input: [
      { role: "system", content: genSystem(level) },
      {
        role: "user",
        content: [
          "아래 지문의 일부 문항에서 정답이 하나로 모이지 않았습니다. 지문은 그대로 두고, 지적된 문항만 다시 만드세요.",
          "- kind 는 유지한다. 정답은 본문 한 문장으로 근거를 댈 수 있게, 오답은 본문과 분명히 어긋나게(반대/과장/본문에 없음/대상 바꿈).",
          "- 검수자가 함께 방어할 수 있다고 본 보기는 빼거나 본문과 확실히 어긋나게 고친다.",
          "- 지적된 문항만 questions 에 담고, no 에 원래 번호를 넣는다.",
          "",
          "[지문]",
          passage,
          "",
          "[검수 결과]",
          feedback,
        ].join("\n"),
      },
    ],
    text: { format: zodTextFormat(RepairSchema, "hsk_reading_repair") },
  });
  return (res.output_parsed?.questions ?? []).filter(
    (q) =>
      bad.includes(q.no) &&
      q.options.length === 4 &&
      q.option_notes.length === 4 &&
      new Set(q.options.map((o) => o.trim())).size === 4 &&
      q.answer >= 0 &&
      q.answer <= 3 &&
      q.stem.trim(),
  );
}

export async function buildReadingSet(opts: {
  level: HskLevel;
  topic?: string | null;
  avoidTitles?: string[];
}): Promise<BuiltSet> {
  const n = HSK_LEVEL_SPEC[opts.level].questions3;
  const topic = opts.topic || HSK_TOPICS[Math.floor(Math.random() * HSK_TOPICS.length)];
  const problems: string[] = [];
  const began = Date.now();
  const left = () => TIME_BUDGET_MS - (Date.now() - began);
  let calls = 0;

  for (let attempt = 1; attempt <= 2 && left() > 100_000; attempt++) {
    const t0 = Date.now();
    const { g, model } = await generateOnce(opts.level, topic, opts.avoidTitles ?? []);
    calls++;
    const shape = checkShape(g, n);
    if (shape) {
      problems.push(`형식: ${shape}`);
      console.info(`[hsk3] 출제#${attempt} ${Date.now() - t0}ms, 형식 탈락: ${shape}`);
      continue;
    }
    // 뜻 추론이 없으면 밑줄 표시가 남지 않게
    const passage = g.questions.some((q) => q.kind === "meaning") ? g.passage.trim() : stripUnderline(g.passage).trim();
    let blanks = g.questions.map((q, i) => toBlank(q, i + 1, passage));
    const t1 = Date.now();
    let result = await verifyBlind(passage, blanks);
    calls++;
    let bad = failed(blanks, result);
    console.info(`[hsk3] 출제#${attempt} ${t1 - t0}ms, 검수 ${Date.now() - t1}ms, 걸림 [${bad.join(",")}]`);

    for (let round = 1; bad.length && round <= 2 && left() > 45_000; round++) {
      const t2 = Date.now();
      const fixed = await repair(opts.level, passage, blanks, result, bad).catch(() => []);
      calls++;
      if (!fixed.length) break;
      const checking = fixed.map((f) => f.no);
      blanks = blanks.map((b) => {
        const f = fixed.find((x) => x.no === b.no);
        return f ? toBlank(f, b.no, passage) : b;
      });
      const recheck = await verifyBlind(passage, blanks, checking);
      calls++;
      result = [...result.filter((r) => !checking.includes(r.no)), ...recheck];
      bad = failed(blanks, result);
      console.info(`[hsk3]  고치기#${round} ${Date.now() - t2}ms, 걸림 [${bad.join(",")}]`);
    }

    if (bad.length) {
      problems.push(`검수: ${bad.join(",")}번 정답이 하나로 모이지 않음`);
      continue;
    }
    console.info(`[hsk3] 완성 ${Date.now() - began}ms, 호출 ${calls}회`);
    return {
      level: opts.level,
      part: 3,
      topic,
      title: g.title.trim(),
      passage,
      translation_ko: g.translation_ko.trim(),
      blanks,
      choices: null,
      verify: {
        attempts: calls,
        result: result
          .sort((a, b) => a.no - b.no)
          .map(({ no, choice, acceptable, reason }) => ({ no, choice, acceptable, reason })),
      },
      model,
    };
  }
  throw new Error(`좋은 문제를 만들지 못했습니다. 잠시 뒤 다시 시도하세요. (${problems.join(" / ") || "시간 초과"})`);
}
