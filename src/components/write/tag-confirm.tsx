"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  EMOTIONS,
  EMOTION_META,
  EVENT_TYPES,
  type TagKind,
} from "@/lib/constants";
import type { TagSuggestion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Chip, EmotionChip } from "@/components/ui/chip";
import { IntensityPicker } from "@/components/ui/intensity-picker";
import { Input } from "@/components/ui/input";

export interface ConfirmedTag {
  kind: TagKind;
  value: string;
  source: "user" | "ai";
}

/**
 * 저장 직후 AI 제안을 한 번에 확인/수정하는 패널.
 * - AI가 제안한 값을 그대로 두면 source=ai, 사용자가 추가/변경하면 source=user
 * - 감정 강도는 항상 사용자 직접 선택(source=user)
 */
export function TagConfirm({
  suggestion,
  onConfirm,
  onSkip,
}: {
  suggestion: TagSuggestion;
  onConfirm: (tags: ConfirmedTag[]) => void;
  onSkip: () => void;
}) {
  const [emotions, setEmotions] = React.useState<string[]>(suggestion.emotions);
  const [events, setEvents] = React.useState<string[]>(suggestion.events);
  const [intensity, setIntensity] = React.useState<number>(suggestion.intensity);
  const [stressor, setStressor] = React.useState<string>(suggestion.stressor ?? "");
  const [positive, setPositive] = React.useState(suggestion.self_view_positive);
  const [negative, setNegative] = React.useState(suggestion.self_view_negative);
  const [busy, setBusy] = React.useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const dominant = emotions[0] as keyof typeof EMOTION_META | undefined;
  const intensityColor = dominant ? EMOTION_META[dominant].color : "var(--accent)";

  function submit() {
    setBusy(true);
    const src = (kind: "emotion" | "event", v: string): "user" | "ai" => {
      const suggested = kind === "emotion" ? suggestion.emotions : suggestion.events;
      return suggested.includes(v) ? "ai" : "user";
    };
    const tags: ConfirmedTag[] = [
      ...emotions.map((v) => ({ kind: "emotion" as const, value: v, source: src("emotion", v) })),
      { kind: "intensity", value: String(intensity), source: "user" },
      ...events.map((v) => ({ kind: "event" as const, value: v, source: src("event", v) })),
      ...(stressor.trim()
        ? [{
            kind: "stressor" as const,
            value: stressor.trim(),
            source: (stressor.trim() === suggestion.stressor ? "ai" : "user") as "user" | "ai",
          }]
        : []),
      { kind: "energy", value: String(suggestion.energy), source: "ai" },
      { kind: "stress_level", value: String(suggestion.stress_level), source: "ai" },
      ...positive.map((v) => ({ kind: "self_view_positive" as const, value: v, source: "ai" as const })),
      ...negative.map((v) => ({ kind: "self_view_negative" as const, value: v, source: "ai" as const })),
    ];
    onConfirm(tags);
  }

  return (
    <Card className="animate-fade-up">
      <CardHeader
        title="태그 확인"
        description="AI 제안을 한 번에 확인하거나 고치세요"
      />
      <CardBody className="space-y-5">
        <div className="space-y-2">
          <p className="text-caption font-medium text-muted">감정</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONS.map((m) => (
              <EmotionChip
                key={m}
                emotion={m}
                size="sm"
                selected={emotions.includes(m)}
                ai={suggestion.emotions.includes(m) && emotions.includes(m)}
                onClick={() => toggle(emotions, setEmotions, m)}
              />
            ))}
          </div>
        </div>

        <IntensityPicker
          label="감정 강도"
          value={intensity}
          onChange={setIntensity}
          color={intensityColor}
        />

        <div className="space-y-2">
          <p className="text-caption font-medium text-muted">사건 유형</p>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPES.map((ev) => (
              <Chip
                key={ev}
                size="sm"
                selected={events.includes(ev)}
                ai={suggestion.events.includes(ev) && events.includes(ev)}
                onClick={() => toggle(events, setEvents, ev)}
              >
                {ev}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-caption font-medium text-muted">스트레스 원인</p>
          <Input
            value={stressor}
            onChange={(e) => setStressor(e.target.value)}
            placeholder="없으면 비워 두세요"
            className="h-9"
          />
        </div>

        {(positive.length > 0 || negative.length > 0) && (
          <div className="space-y-2">
            <p className="text-caption font-medium text-muted">자기 평가 문장</p>
            <ul className="space-y-1.5">
              {positive.map((q) => (
                <QuoteRow key={"p" + q} tone="positive" text={q} onRemove={() => setPositive(positive.filter((x) => x !== q))} />
              ))}
              {negative.map((q) => (
                <QuoteRow key={"n" + q} tone="negative" text={q} onRemove={() => setNegative(negative.filter((x) => x !== q))} />
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onSkip} disabled={busy}>
            AI 값 그대로
          </Button>
          <Button onClick={submit} loading={busy}>
            확인
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function QuoteRow({
  tone,
  text,
  onRemove,
}: {
  tone: "positive" | "negative";
  text: string;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-start gap-2 rounded-md bg-surface-2 px-3 py-2 text-caption">
      <span
        className="mt-1.5 size-1.5 shrink-0 rounded-full"
        style={{ background: tone === "positive" ? "var(--calm)" : "var(--anger)" }}
      />
      <span className="flex-1 text-foreground/85">“{text}”</span>
      <button
        onClick={onRemove}
        className="rounded-sm p-0.5 text-subtle hover:text-foreground"
        aria-label="제거"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}
