"use client";

import * as React from "react";
import { Check, PenLine, ScanSearch, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/** 실제 진행 상황은 알 수 없어 흐른 시간으로 단계를 보여 준다 (보통 40초~1분 30초) */
const STEPS = [
  { at: 0, icon: PenLine, label: "주제를 고르고 지문을 쓰는 중" },
  { at: 20, icon: Shuffle, label: "빈칸마다 헷갈리는 보기 4개를 만드는 중" },
  { at: 40, icon: ScanSearch, label: "다른 눈으로 직접 풀어 보며 정답이 하나뿐인지 검수하는 중" },
] as const;

export function HskGenerating({ similar, onCancel }: { similar: boolean; onCancel: () => void }) {
  const [sec, setSec] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = STEPS.reduce((acc, s, i) => (sec >= s.at ? i : acc), 0);

  return (
    <Card>
      <CardBody className="space-y-6 py-10">
        <div className="flex flex-col items-center text-center">
          <Spinner className="size-6 text-accent" />
          <p className="mt-4 text-heading font-semibold">{similar ? "비슷한 문제를 만들고 있어요" : "새 세트를 만들고 있어요"}</p>
          <p className="mt-1 text-caption text-muted">
            준비된 세트가 없어 지금 만들어요. 검수에서 정답이 애매하면 버리고 다시 만들어서 1~2분 걸릴 수 있어요.
          </p>
        </div>
        <ol className="mx-auto max-w-sm space-y-3">
          {STEPS.map((s, i) => {
            const done = i < current;
            const on = i === current;
            const Icon = s.icon;
            return (
              <li key={s.label} className={cn("flex items-center gap-3 text-body transition-opacity", !done && !on && "opacity-40")}>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    done ? "bg-success-soft text-success" : on ? "bg-accent-soft text-accent" : "bg-surface-2 text-subtle",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : <Icon className={cn("size-3.5", on && "animate-pulse-soft")} />}
                </span>
                <span className={cn(on && "font-medium")}>{s.label}</span>
              </li>
            );
          })}
        </ol>
        <p className="text-center text-micro tabular text-subtle">{sec}초</p>
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            기다리지 않고 돌아가기
          </Button>
        </div>
        <p className="-mt-4 text-center text-micro text-subtle">돌아가도 만들던 세트는 완성되면 준비된 세트에 들어가요.</p>
      </CardBody>
    </Card>
  );
}
