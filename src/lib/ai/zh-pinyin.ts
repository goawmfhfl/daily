import { pinyin as toPinyin } from "pinyin-pro";
import type { ZhSegment } from "@/lib/types";

/**
 * AI 가 쓴 병음을 글자별로 검증한다 (번역·단어장 공용).
 * - 성조를 뗀 소리가 그 글자의 실제 읽기 후보 중 하나면 AI 값을 쓴다 (一·不 성조 변화, 경성 표기를 살리기 위해)
 * - 아니면(없는 읽기, 음절 수 불일치) 문장 문맥으로 계산한 pinyin-pro 값으로 바꾼다
 */

/** 성조 기호를 떼어 소리만 비교 (lǜ → lu) */
function toneless(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export const isHan = (ch: string) => /\p{Script=Han}/u.test(ch);

function acceptable(ch: string, ai: string) {
  const candidates = toPinyin(ch, { multiple: true, type: "array" }).map(toneless);
  // 儿化(r)는 儿 의 읽기로 인정
  return candidates.includes(toneless(ai)) || (ch === "儿" && toneless(ai) === "r");
}

/** 단어 분절 단위로 검증. AI 분절이 원문과 다르면 글자 단위로 다시 나눈다 */
export function verifySegments(
  hanzi: string,
  raw: { hanzi: string; pinyin: string; ko: string }[],
): ZhSegment[] {
  const chars = [...hanzi];
  const libPinyin = toPinyin(hanzi, { type: "array" });

  const joined = raw.map((s) => s.hanzi).join("");
  const segs = joined === hanzi ? raw : chars.map((c) => ({ hanzi: c, pinyin: "", ko: "" }));

  let offset = 0;
  return segs.map((seg) => {
    const segChars = [...seg.hanzi];
    const aiSyllables = seg.pinyin.trim().split(/\s+/).filter(Boolean);
    const sameCount = aiSyllables.length === segChars.length;

    const syllables = segChars.map((ch, i) => {
      const lib = libPinyin[offset + i] ?? ch;
      if (!isHan(ch)) return ch;
      const ai = sameCount ? aiSyllables[i] : undefined;
      return ai && acceptable(ch, ai) ? ai : lib;
    });
    offset += segChars.length;
    return { hanzi: seg.hanzi, pinyin: syllables.join(" "), ko: seg.ko.trim() };
  });
}

/** 문장부호 앞 공백은 붙이고 여는 따옴표 뒤 공백은 뗀다 */
export function tidyPinyin(s: string) {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([，。？！、；：,.?!;:”’）)…])/g, "$1")
    .replace(/([“‘（(])\s+/g, "$1")
    .trim();
}

export function joinSegmentsPinyin(segments: ZhSegment[]) {
  return tidyPinyin(segments.map((s) => s.pinyin).join(" "));
}

/**
 * 병음이 한 줄로만 올 때(단어, 예문). 한자와 AI 음절을 앞에서부터 하나씩 맞춰 간다.
 * AI 가 음절 하나를 빠뜨리거나 더 써도(儿化 등) 그 자리만 라이브러리 값으로 메우고
 * 나머지 글자는 계속 AI 값(문맥에 맞는 읽기, 一·不 성조 변화)을 살린다.
 */
export function verifyPinyin(hanzi: string, aiPinyin: string) {
  const chars = [...hanzi];
  const libPinyin = toPinyin(hanzi, { type: "array" });
  // 문장부호·영문은 음절이 아니므로 뺀다
  const ai = aiPinyin
    .split(/\s+/)
    .map((s) => s.replace(/[^\p{L}\p{M}]/gu, ""))
    .filter(Boolean);

  let k = 0;
  const out = chars.map((ch, i) => {
    if (!isHan(ch)) return ch;
    const lib = libPinyin[i] ?? ch;
    if (k < ai.length && acceptable(ch, ai[k])) return ai[k++];
    // AI 가 음절을 하나 더 쓴 경우: 다음 것이 맞으면 하나 건너뛴다
    if (k + 1 < ai.length && acceptable(ch, ai[k + 1])) {
      k += 2;
      return ai[k - 1];
    }
    // AI 가 이 글자를 빠뜨린 경우: 다음 글자가 지금 음절과 맞으면 소비하지 않는다
    const next = chars.slice(i + 1).find(isHan);
    if (!(next && k < ai.length && acceptable(next, ai[k]))) k += 1;
    return lib;
  });
  return tidyPinyin(out.join(" "));
}
