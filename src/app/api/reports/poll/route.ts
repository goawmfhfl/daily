import { z } from "zod";
import { handler, requireUser, json, fail } from "@/lib/api-server";
import { pollReport } from "@/lib/ai/report";
import { hasOpenAI } from "@/lib/openai";
import { saveReport, type ReportJob } from "@/lib/report-store";

const Body = z.object({
  job: z.object({
    response_id: z.string().min(1),
    period_key: z.enum(["7d", "30d", "all"]),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    entry_count: z.number().int().nonnegative(),
    model: z.string().min(1),
    refs: z.record(z.string(), z.object({ id: z.string().uuid(), date: z.string() })),
  }),
});

/**
 * POST /api/reports/poll — 백그라운드 리포트 작업의 진행 상태를 확인한다.
 * 끝났으면 리포트를 저장해 돌려주고, 아직이면 pending.
 */
export const POST = handler(async (req) => {
  const { supabase, user } = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return fail("입력이 올바르지 않습니다.");
  if (!hasOpenAI()) return fail("OPENAI_API_KEY 가 설정되지 않았습니다.", 503);

  const job = parsed.data.job as ReportJob;
  const result = await pollReport(job.response_id, job.refs);
  if (result.status === "pending") return json({ status: "pending" as const });
  if (result.status === "failed") return fail(result.message, 502);

  const report = await saveReport(supabase, user.id, job, result.content);
  return json({ status: "done" as const, report });
});
