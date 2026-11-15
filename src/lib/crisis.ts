/**
 * 위기 표현 1차 감지 (규칙 기반).
 * AI 태깅 결과의 risk 플래그와 OR 로 결합합니다.
 * 과탐지는 받아들이고, 미탐지를 줄이는 방향으로 둡니다.
 */
const PATTERNS: RegExp[] = [
  /자살/,
  /자해/,
  /죽고\s*싶/,
  /죽어\s*버리/,
  /죽어야/,
  /사라지고\s*싶/,
  /없어지고\s*싶/,
  /끝내고\s*싶/,
  /살기\s*싫/,
  /살고\s*싶지\s*않/,
  /목숨을?\s*끊/,
  /생을?\s*마감/,
  /뛰어\s*내리/,
  /손목/,
  /유서/,
  /극단적\s*(인\s*)?선택/,
];

export function detectCrisis(text: string): boolean {
  const t = text.replace(/\s+/g, " ");
  return PATTERNS.some((p) => p.test(t));
}
