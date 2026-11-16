import { handler, requireUser, json, fail } from "@/lib/api-server";
import { fetchReport } from "@/lib/data";

export const GET = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const report = await fetchReport(supabase, id);
  if (!report) return fail("리포트를 찾을 수 없습니다.", 404);
  return json({ report });
});

export const DELETE = handler(async (_req, { params }) => {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return json({ ok: true });
});
