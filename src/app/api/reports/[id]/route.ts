import { handler, requireUser, json, fail } from "@/lib/api-server";

export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
});
