import { handler, requireUser, json } from "@/lib/api-server";
import { MODELS, hasOpenAI } from "@/lib/openai";

/** GET /api/me — 로그인 사용자와 서버 설정(AI 사용 가능 여부, 모델명) */
export const GET = handler(async () => {
  const { user } = await requireUser();
  return json({ email: user.email ?? null, aiAvailable: hasOpenAI(), models: MODELS });
});
