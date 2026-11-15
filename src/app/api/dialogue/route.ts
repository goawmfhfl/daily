import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { AI_MODES, DIALOGUE_MAX_TURNS } from "@/lib/constants";
import { getSettings } from "@/lib/data";
import { nextDialogueTurn } from "@/lib/ai/tagging";
import { detectCrisis } from "@/lib/crisis";
import { hasOpenAI } from "@/lib/openai";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(DIALOGUE_MAX_TURNS * 2 + 1),
  ai_mode: z.enum(AI_MODES).optional(),
});

/** POST /api/dialogue — 다음 질문 한 개 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  if (!hasOpenAI()) return fail("OPENAI_API_KEY 가 설정되지 않았습니다.", 503);

  const { messages, ai_mode } = parsed.data;
  const userTurns = messages.filter((m) => m.role === "user");
  const lastUser = userTurns.at(-1)?.content ?? "";
  if (lastUser && detectCrisis(lastUser)) {
    return json({ message: null, done: true, risk: true });
  }

  const settings = await getSettings(supabase, user.id);
  const out = await nextDialogueTurn({
    messages,
    aiMode: ai_mode ?? settings.default_ai_mode,
    settings,
    turnIndex: userTurns.length,
    maxTurns: DIALOGUE_MAX_TURNS,
  });
  return json(out);
});
