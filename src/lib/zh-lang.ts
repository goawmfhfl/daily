/**
 * 단어장 카드의 한국어 칸(뜻·해석·품사·예문 해석)이 정말 한국어인지 검사한다.
 * 서버(생성 직후 재시도)와 화면(잘못 만들어진 카드 표시)이 같은 기준을 쓴다.
 *
 * 중국어 표현을 따옴표로 인용하는 건 괜찮다 ('来不及', “搭配”).
 * 따옴표 밖에 한자가 많거나 한글이 하나도 없으면 한국어가 아닌 것으로 본다.
 */

/** 인용부호로 감싼 부분은 빼고 본다 */
const QUOTED = /'[^']*'|‘[^’]*’|“[^”]*”|"[^"]*"|「[^」]*」|『[^』]*』|《[^》]*》/g;
const HANGUL = /[가-힣]/g;
const HAN = /\p{Script=Han}/gu;

export function isKoreanText(s: string | null | undefined): boolean {
  const text = (s ?? "").trim();
  if (!text) return true;
  const hangul = text.match(HANGUL)?.length ?? 0;
  if (hangul === 0) return false;
  const han = text.replace(QUOTED, "").match(HAN)?.length ?? 0;
  return han <= Math.max(2, hangul * 0.15);
}

export interface KoreanFields {
  meaning: string;
  explanation: string;
  part_of_speech: string;
  examples: Array<{ ko: string }>;
}

/** 한국어가 아닌 칸 이름들. 비어 있으면 문제없음 */
export function nonKoreanFields(card: KoreanFields): string[] {
  const bad: string[] = [];
  if (!isKoreanText(card.meaning)) bad.push("meaning");
  if (!isKoreanText(card.explanation)) bad.push("explanation");
  if (!isKoreanText(card.part_of_speech)) bad.push("part_of_speech");
  card.examples.forEach((e, i) => {
    if (!isKoreanText(e.ko)) bad.push(`examples[${i}].ko`);
  });
  return bad;
}
