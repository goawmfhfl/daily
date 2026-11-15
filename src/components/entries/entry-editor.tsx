"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, MessageCircle, ShieldAlert } from "lucide-react";
import type { EntryWithTags, EntryTagRow } from "@/lib/types";
import {
  EMOTIONS,
  EMOTION_META,
  EVENT_TYPES,
  TAG_KIND_LABEL,
  AI_MODE_META,
  type Emotion,
} from "@/lib/constants";
import { api } from "@/lib/api";
import { formatDateKo, formatDateTimeKo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Chip, EmotionChip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { IntensityPicker } from "@/components/ui/intensity-picker";
import { useToast } from "@/components/ui/toast";
import type { ConfirmedTag } from "@/components/write/tag-confirm";

export function EntryEditor({ entry }: { entry: EntryWithTags }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState(false);
  const [content, setContent] = React.useState(entry.content);
  const [date, setDate] = React.useState(entry.entry_date);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const tags = entry.entry_tags;
  const get = (kind: string) => tags.filter((t) => t.kind === kind);

  async function saveContent() {
    setBusy(true);
    try {
      await api(`/api/entries/${entry.id}`, {
        method: "PATCH",
        body: { content, entry_date: date },
      });
      toast.push({ tone: "success", title: "수정되었습니다" });
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.push({ tone: "error", title: "수정 실패", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/entries/${entry.id}`, { method: "DELETE" });
      toast.push({ tone: "success", title: "삭제되었습니다" });
      router.push("/entries");
      router.refresh();
    } catch (e) {
      setBusy(false);
      toast.push({ tone: "error", title: "삭제 실패", description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/entries"
          className="inline-flex items-center gap-1.5 text-caption text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> 기록 목록
        </Link>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
            <Pencil className="size-3.5" /> {editing ? "취소" : "수정"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-danger hover:text-danger">
            <Trash2 className="size-3.5" /> 삭제
          </Button>
        </div>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2 text-caption text-muted">
          {editing ? (
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-auto" />
          ) : (
            <span className="text-body font-semibold text-foreground">
              {formatDateKo(entry.entry_date, "yyyy년 M월 d일 EEEE")}
            </span>
          )}
          <span className="text-subtle">· {formatDateTimeKo(entry.created_at)} 작성</span>
          {entry.mode === "dialogue" && (
            <Badge><MessageCircle className="size-3" /> 대화형</Badge>
          )}
          {entry.risk_flag && (
            <Badge tone="danger"><ShieldAlert className="size-3" /> 분석 제외</Badge>
          )}
        </div>
      </header>

      <Card>
        <CardBody>
          {editing ? (
            <div className="space-y-3">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[240px] text-[1.0625rem] leading-[1.75]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setEditing(false); setContent(entry.content); setDate(entry.entry_date); }}>취소</Button>
                <Button onClick={saveContent} loading={busy} disabled={!content.trim()}>저장</Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-[1.0625rem] leading-[1.8] text-foreground/95">
              {entry.content}
            </p>
          )}
        </CardBody>
      </Card>

      {entry.ai_reply && (
        <Card className="border-accent/30 bg-accent-soft/40">
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge tone="accent">AI</Badge>
              {entry.ai_mode && (
                <span className="text-micro text-muted">{AI_MODE_META[entry.ai_mode].label} 모드</span>
              )}
            </div>
            <p className="text-body leading-relaxed">{entry.ai_reply}</p>
          </CardBody>
        </Card>
      )}

      {!entry.risk_flag && <TagEditor entry={entry} />}

      {(get("self_view_positive").length > 0 || get("self_view_negative").length > 0) && (
        <Card>
          <CardHeader title="자기 평가 문장" description="AI가 원문에서 추출" />
          <CardBody className="space-y-1.5 pt-3">
            {[...get("self_view_positive"), ...get("self_view_negative")].map((t) => (
              <div key={t.id} className="flex items-start gap-2 text-caption">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full"
                  style={{ background: t.kind === "self_view_positive" ? "var(--calm)" : "var(--anger)" }}
                />
                <span className="text-foreground/85">“{t.value}”</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="이 기록을 삭제할까요?"
        description="태그와 근거 연결도 함께 삭제되며 되돌릴 수 없습니다."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>취소</Button>
            <Button variant="danger" onClick={remove} loading={busy}>삭제</Button>
          </>
        }
      />
    </div>
  );
}

function TagEditor({ entry }: { entry: EntryWithTags }) {
  const router = useRouter();
  const toast = useToast();
  const tags = entry.entry_tags;
  const pick = (kind: string) => tags.filter((t) => t.kind === kind);
  const srcOf = (kind: string, value: string) =>
    tags.find((t) => t.kind === kind && t.value === value)?.source ?? "user";

  const [emotions, setEmotions] = React.useState(pick("emotion").map((t) => t.value));
  const [events, setEvents] = React.useState(pick("event").map((t) => t.value));
  const [intensity, setIntensity] = React.useState<number | null>(
    pick("intensity")[0] ? Number(pick("intensity")[0].value) : null,
  );
  const [stressor, setStressor] = React.useState(pick("stressor")[0]?.value ?? "");
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    setDirty(true);
  };

  const aiCount = tags.filter((t) => t.source === "ai").length;
  const userCount = tags.filter((t) => t.source === "user").length;

  async function save() {
    setBusy(true);
    const keep = (kinds: string[]) =>
      tags.filter((t) => kinds.includes(t.kind)).map<ConfirmedTag>((t) => ({ kind: t.kind, value: t.value, source: t.source }));
    const next: ConfirmedTag[] = [
      ...emotions.map((v) => ({ kind: "emotion" as const, value: v, source: srcOf("emotion", v) })),
      ...(intensity ? [{ kind: "intensity" as const, value: String(intensity), source: "user" as const }] : []),
      ...events.map((v) => ({ kind: "event" as const, value: v, source: srcOf("event", v) })),
      ...(stressor.trim() ? [{ kind: "stressor" as const, value: stressor.trim(), source: srcOf("stressor", stressor.trim()) }] : []),
      ...keep(["energy", "stress_level", "self_view_positive", "self_view_negative"]),
    ];
    try {
      await api(`/api/entries/${entry.id}/tags`, { method: "PUT", body: { tags: next } });
      toast.push({ tone: "success", title: "태그가 저장되었습니다" });
      setDirty(false);
      router.refresh();
    } catch (e) {
      toast.push({ tone: "error", title: "태그 저장 실패", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  const dominant = emotions[0] as Emotion | undefined;

  return (
    <Card>
      <CardHeader
        title="태그"
        description={`AI 추출 ${aiCount} · 직접 선택 ${userCount}`}
        action={dirty ? <Button size="sm" onClick={save} loading={busy}>저장</Button> : undefined}
      />
      <CardBody className="space-y-5">
        <div className="space-y-2">
          <p className="text-caption font-medium text-muted">{TAG_KIND_LABEL.emotion}</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONS.map((m) => (
              <EmotionChip key={m} emotion={m} size="sm" selected={emotions.includes(m)} ai={emotions.includes(m) && srcOf("emotion", m) === "ai"} onClick={() => toggle(emotions, setEmotions, m)} />
            ))}
          </div>
        </div>
        <IntensityPicker
          label={TAG_KIND_LABEL.intensity}
          value={intensity}
          onChange={(v) => { setIntensity(v); setDirty(true); }}
          color={dominant ? EMOTION_META[dominant].color : "var(--accent)"}
        />
        <div className="space-y-2">
          <p className="text-caption font-medium text-muted">{TAG_KIND_LABEL.event}</p>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPES.map((ev) => (
              <Chip key={ev} size="sm" selected={events.includes(ev)} ai={events.includes(ev) && srcOf("event", ev) === "ai"} onClick={() => toggle(events, setEvents, ev)}>{ev}</Chip>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-caption font-medium text-muted">{TAG_KIND_LABEL.stressor}</p>
          <Input value={stressor} onChange={(e) => { setStressor(e.target.value); setDirty(true); }} placeholder="없음" className="h-9" />
        </div>
        <MetaRow tags={tags} />
      </CardBody>
    </Card>
  );
}

function MetaRow({ tags }: { tags: EntryTagRow[] }) {
  const energy = tags.find((t) => t.kind === "energy")?.value;
  const stress = tags.find((t) => t.kind === "stress_level")?.value;
  if (!energy && !stress) return null;
  return (
    <div className="flex gap-4 border-t border-border pt-4 text-caption text-muted">
      {energy && <span>에너지 <b className="tabular text-foreground">{energy}</b>/5</span>}
      {stress && <span>스트레스 정도 <b className="tabular text-foreground">{stress}</b>/5</span>}
      <span className="ml-auto text-subtle">AI 추정값</span>
    </div>
  );
}
