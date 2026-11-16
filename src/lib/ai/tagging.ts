import { zodTextFormat } from "openai/helpers/zod";
import { openai, MODELS } from "@/lib/openai";
import { clamp } from "@/lib/utils";
import type { AiMode, UserSettings } from "@/lib/constants";
import type { TagSuggestion } from "@/lib/types";
import { TagSuggestionSchema } from "./schemas";
import { taggingSystemPrompt } from "./prompts";

function reasoningFor(model: string, effort: "minimal" | "low" | "medium") {
  // gpt-5 계열만 reasoning 파라미터를 받는다.
  return model.startsWith("gpt-5") || model.startsWith("o")
    ? { reasoning: { effort } }
    : {};
}

export async function suggestTagsAndReply(input: {
  content: string;
  entryDate: string;
  mode: "free" | "dialogue";
  aiMode: AiMode;
  settings: UserSettings;
  habitNames: string[];
}): Promise<TagSuggestion> {
  const model = MODELS.fast;
  const res = await openai().responses.parse({
    model,
    ...reasoningFor(model, "minimal"),
    input: [
      { role: "system", content: taggingSystemPrompt(input.settings, input.aiMode) },
      {
        role: "user",
        content: [
          `날짜: ${input.entryDate}`,
          `기록 방식: ${
            input.mode === "free"
              ? "자유 메모"
              : "셀프 대화(사용자가 두 화자를 모두 직접 맡아 '이름: 말' 형식으로 스스로와 나눈 대화. 양쪽 모두 사용자 본인의 생각)"
          }`,
          input.habitNames.length
            ? `사용자가 지속하고 싶은 활동: ${input.habitNames.join(", ")}`
            : "",
          "",
          "----- 기록 -----",
          input.content,
        ]
          .filter((l) => l !== "")
          .join("\n"),
      },
    ],
    text: { format: zodTextFormat(TagSuggestionSchema, "tag_suggestion") },
  });

  const out = res.output_parsed;
  if (!out) throw new Error("태그 제안 결과를 해석하지 못했습니다.");

  return {
    emotions: out.emotions.slice(0, 3),
    intensity: clamp(out.intensity, 1, 5),
    events: out.events.slice(0, 3),
    stressor: out.stressor?.trim() || null,
    energy: clamp(out.energy, 1, 5),
    stress_level: clamp(out.stress_level, 1, 5),
    self_view_positive: out.self_view_positive.slice(0, 3),
    self_view_negative: out.self_view_negative.slice(0, 3),
    risk: out.risk,
    reply: out.reply.trim(),
  };
}
