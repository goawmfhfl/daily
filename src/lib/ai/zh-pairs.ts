import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { openai, MODELS } from "@/lib/openai";
import type { ZhPair, ZhSegment } from "@/lib/types";

/** 문장을 끝내는 부호. 닫는 따옴표가 바로 뒤따르면 그것까지 한 문장 */
const END = /[。！？!?；;…]/;
const CLOSE = /^[”’」』"')）]+$/;

/** segments 를 중국어 문장 단위 [from, to) 로 자른다 */
export function splitZhUnits(segments: ZhSegment[]): Array<{ from: number; to: number }> {
  const units: Array<{ from: number; to: number }> = [];
  let from = 0;
  for (let i = 0; i < segments.length; i++) {
    const h = segments[i].hanzi;
    if (!END.test(h[h.length - 1] ?? "")) continue;
    let to = i + 1;
    while (to < segments.length && CLOSE.test(segments[to].hanzi)) to++;
    units.push({ from, to });
    from = to;
    i = to - 1;
  }
  if (from < segments.length) {
    // 부호 없이 끝난 꼬리: 글자가 있으면 문장, 부호뿐이면 앞 문장에 붙인다
    const tail = segments.slice(from).some((s) => /\p{Script=Han}/u.test(s.hanzi));
    if (tail || units.length === 0) units.push({ from, to: segments.length });
    else units[units.length - 1].to = segments.length;
  }
  return units;
}

/** 한국어를 문장 단위로 (마침표·물음표·느낌표·줄바꿈) */
function splitKo(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?。？！…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const PairsSchema = z.object({ ko: z.array(z.string()) });

const SYSTEM = `
한국어 원문과, 그것을 옮긴 중국어 문장들(번호 순서)이 주어집니다.
학습자가 한국어만 보고 중국어 문장 하나를 떠올려 말해 보는 연습을 합니다. 각 중국어 문장에 대응하는 한국어를 정해 주세요.

[출력]
- ko: 중국어 문장과 같은 개수, 같은 순서의 배열. i번째는 i번째 중국어 문장에 해당하는 한국어.
- 원문의 표현을 최대한 그대로 가져온다. 원문의 한 문장이 중국어 두 문장으로 나뉘었으면 원문을 그 경계에서 자연스럽게 나눈다.
- 중국어 두 문장 이상이 원문의 한 구절에서 나왔거나 원문에 없는 내용(번역에서 덧붙인 말)이면, 그 중국어의 뜻을 짧고 자연스러운 한국어로 쓴다.
- 모든 원문 내용이 빠짐없이 어딘가에 들어가야 한다. 빈 문자열은 쓰지 않는다.
- 한국어만 쓴다.
`.trim();

/**
 * 번역 하나를 [한국어 ↔ 중국어 한 문장] 짝으로 나눈다.
 * 중국어 문장이 하나면 AI 없이, 문장 수가 같으면 순서대로, 다르면 AI 로 맞춘다.
 */
export async function buildPairs(sourceKo: string, segments: ZhSegment[]): Promise<ZhPair[]> {
  const units = splitZhUnits(segments);
  if (units.length <= 1) return [{ ko: sourceKo.trim(), from: 0, to: segments.length }];

  const koSentences = splitKo(sourceKo);
  if (koSentences.length === units.length) {
    return units.map((u, i) => ({ ko: koSentences[i], ...u }));
  }

  const zhLines = units.map(
    (u, i) => `${i + 1}. ${segments.slice(u.from, u.to).map((s) => s.hanzi).join("")}`,
  );
  const model = MODELS.fast;
  const res = await openai().responses.parse({
    model,
    ...(model.startsWith("gpt-5") || model.startsWith("o")
      ? { reasoning: { effort: "minimal" as const } }
      : {}),
    input: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `[한국어 원문]\n${sourceKo}\n\n[중국어 문장 ${units.length}개]\n${zhLines.join("\n")}` },
    ],
    text: { format: zodTextFormat(PairsSchema, "zh_pairs") },
  });
  const ko = res.output_parsed?.ko.map((s) => s.trim());
  if (!ko || ko.length !== units.length || ko.some((s) => !s)) {
    // 개수가 안 맞으면 억지로 짝짓지 않고 문단 하나로
    return [{ ko: sourceKo.trim(), from: 0, to: segments.length }];
  }
  return units.map((u, i) => ({ ko: ko[i], ...u }));
}
