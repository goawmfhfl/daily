"use client";

import * as React from "react";
import { AI_MODES, AI_MODE_META, type AiMode, type UserSettings } from "@/lib/constants";
import { useSaveSettings } from "@/lib/query/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Level = 1 | 2 | 3;

export function SettingsForm({ initial }: { initial: UserSettings }) {
  const toast = useToast();
  const saveSettings = useSaveSettings();
  const [s, setS] = React.useState(initial);
  const [dirty, setDirty] = React.useState(false);
  const busy = saveSettings.isPending;

  function patch(p: Partial<UserSettings>) {
    setS((prev) => ({ ...prev, ...p }));
    setDirty(true);
  }

  function save() {
    // 저장된 설정은 캐시에 바로 반영되어 기록 화면의 기본 모드에도 곧바로 적용된다
    saveSettings.mutate(s, {
      onSuccess: () => {
        toast.push({ tone: "success", title: "설정이 저장되었습니다" });
        setDirty(false);
      },
      onError: (e) => toast.push({ tone: "error", title: "저장 실패", description: e.message }),
    });
  }

  return (
    <Card>
      <CardHeader
        title="AI 말투와 모드"
        description="위로 모드의 직설 정도와 분석 모드의 냉정함을 고릅니다"
        action={dirty ? <Button size="sm" onClick={save} loading={busy}>저장</Button> : undefined}
      />
      <CardBody className="space-y-6">
        <Row label="위로 모드 — 얼마나 직설적으로" hint="부드럽게 ↔ 직설적으로">
          <Segmented<`${Level}`>
            fullWidth
            value={`${s.comfort_directness}`}
            onChange={(v) => patch({ comfort_directness: Number(v) as Level })}
            options={[
              { value: "1", label: "부드럽게" },
              { value: "2", label: "솔직하게" },
              { value: "3", label: "직설적으로" },
            ]}
          />
        </Row>
        <Row label="분석 모드 — 얼마나 냉정하게" hint="따뜻하게 ↔ 냉정하게">
          <Segmented<`${Level}`>
            fullWidth
            value={`${s.analysis_coldness}`}
            onChange={(v) => patch({ analysis_coldness: Number(v) as Level })}
            options={[
              { value: "1", label: "따뜻하게" },
              { value: "2", label: "중립" },
              { value: "3", label: "냉정하게" },
            ]}
          />
        </Row>
        <Row label="기본 기록 방식">
          <Segmented<"free" | "dialogue">
            value={s.default_mode}
            onChange={(v) => patch({ default_mode: v })}
            options={[
              { value: "free", label: "자유 메모" },
              { value: "dialogue", label: "대화형" },
            ]}
          />
        </Row>
        <Row label="저장 직후 AI 응답의 기본 모드">
          <div className="flex flex-wrap gap-1.5">
            {AI_MODES.map((m: AiMode) => (
              <Chip key={m} selected={s.default_ai_mode === m} onClick={() => patch({ default_ai_mode: m })} title={AI_MODE_META[m].description}>
                {AI_MODE_META[m].label}
              </Chip>
            ))}
          </div>
        </Row>
      </CardBody>
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-caption font-medium">{label}</p>
        {hint && <span className="text-micro text-subtle">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
