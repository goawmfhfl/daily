import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { AI_MODES } from "@/lib/constants";
import { saveSettings } from "@/lib/data";

const Patch = z.object({
  comfort_directness: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  analysis_coldness: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  default_mode: z.enum(["free", "dialogue"]).optional(),
  default_ai_mode: z.enum(AI_MODES).optional(),
  display_name: z.string().trim().max(40).nullable().optional(),
});

export const PATCH = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  const settings = await saveSettings(supabase, user.id, parsed.data);
  return json({ settings });
});
