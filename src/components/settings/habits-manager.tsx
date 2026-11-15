"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pause, Play, Trash2 } from "lucide-react";
import type { HabitRow } from "@/lib/types";
import { api } from "@/lib/api";
import { formatDateKo } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export function HabitsManager({ habits }: { habits: HabitRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.push({ tone: "success", title: ok });
      router.refresh();
    } catch (e) {
      toast.push({ tone: "error", title: "실패", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="지속하고 싶은 활동"
        description="기록 화면에서 매일 체크합니다. 지속력 분석의 핵심 데이터입니다."
      />
      <CardBody className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            void run(
              () => api("/api/habits", { method: "POST", body: { name: name.trim() } }).then(() => setName("")),
              "활동을 추가했습니다",
            );
          }}
          className="flex gap-2"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 아침 산책, 영어 10분" maxLength={60} />
          <Button type="submit" variant="secondary" disabled={!name.trim() || busy}>
            <Plus className="size-4" /> 추가
          </Button>
        </form>

        {habits.length === 0 ? (
          <p className="text-caption text-muted">아직 없습니다. 작게 시작하세요. 하나면 충분합니다.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {habits.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={h.active ? "font-medium" : "font-medium text-muted line-through"}>{h.name}</p>
                  <p className="text-micro text-subtle">{formatDateKo(h.started_at, "yyyy.MM.dd")} 시작</p>
                </div>
                {!h.active && <Badge>중단</Badge>}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={h.active ? "중단" : "재개"}
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api(`/api/habits/${h.id}`, { method: "PATCH", body: { active: !h.active } }),
                      h.active ? "활동을 중단했습니다" : "활동을 재개했습니다",
                    )
                  }
                >
                  {h.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="삭제"
                  disabled={busy}
                  className="text-danger hover:text-danger"
                  onClick={() => {
                    if (!window.confirm(`"${h.name}" 활동과 체크 기록을 모두 삭제할까요?`)) return;
                    void run(() => api(`/api/habits/${h.id}`, { method: "DELETE" }), "활동을 삭제했습니다");
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
