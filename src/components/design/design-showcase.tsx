"use client";

import * as React from "react";
import { Flame, Sparkles } from "lucide-react";
import { EMOTIONS, EMOTION_META, EVENT_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Chip, EmotionChip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Field } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { IntensityPicker } from "@/components/ui/intensity-picker";
import { StatTile } from "@/components/ui/stat-tile";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Logo } from "@/components/layout/nav";
import { EmotionFlowChart, type DayPoint } from "@/components/charts/emotion-flow";
import { MeterList } from "@/components/charts/meter-list";
import { TimelineCharts } from "@/components/charts/timeline-chart";

const COLOR_TOKENS = [
  ["--bg", "배경"], ["--surface", "표면"], ["--surface-2", "표면 2"], ["--surface-3", "표면 3"],
  ["--border", "경계"], ["--fg", "글자"], ["--fg-muted", "보조 글자"], ["--fg-subtle", "흐린 글자"],
  ["--primary", "주요 버튼"], ["--accent", "강조"], ["--accent-soft", "강조 배경"],
  ["--success", "성공"], ["--warning", "주의"], ["--danger", "위험"],
];

function sampleFlow(): DayPoint[] {
  const emos = ["기쁨", "평온", "불안", "무기력", "분노", "슬픔", null, "평온", "기쁨", "불안", "평온", "기쁨", null, "슬픔"];
  return emos.map((e, i) => ({
    date: `2026-11-${String(i + 2).padStart(2, "0")}`,
    intensity: e ? ((i * 7) % 5) + 1 : 0,
    emotion: e,
    emotions: e ? [e] : [],
    count: e ? 1 : 0,
  }));
}

function sampleTimeline() {
  const out = [];
  for (let i = 0; i < 70; i++) {
    const d = new Date(2026, 8, 1 + i);
    const e = EMOTIONS[(i * 5) % EMOTIONS.length];
    out.push({
      id: String(i),
      date: d.toISOString().slice(0, 10),
      emotions: [e, ...(i % 3 === 0 ? [EMOTIONS[(i + 2) % EMOTIONS.length]] : [])],
      intensity: ((i * 3) % 5) + 1,
      events: [EVENT_TYPES[i % EVENT_TYPES.length]],
      stressor: null,
      snippet: "",
    });
  }
  return out;
}

export function DesignShowcase() {
  const toast = useToast();
  const [seg, setSeg] = React.useState("a");
  const [intensity, setIntensity] = React.useState<number | null>(3);
  const [open, setOpen] = React.useState(false);
  const [sel, setSel] = React.useState<string[]>(["기쁨"]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo className="size-10 rounded-xl" />
          <div>
            <h1 className="text-title font-semibold tracking-tight">Daily 디자인 시스템</h1>
            <p className="text-caption text-muted">토큰 · 타이포 · 컴포넌트 · 차트</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <Section title="색 토큰">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {COLOR_TOKENS.map(([v, label]) => (
            <div key={v} className="space-y-1.5">
              <div className="h-14 rounded-md border border-border" style={{ background: `var(${v})` }} />
              <p className="text-micro font-medium">{label}</p>
              <p className="font-mono text-micro text-subtle">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-caption font-medium text-muted">감정 색 (색각 이상 검증 완료)</p>
        <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {EMOTIONS.map((e) => (
            <div key={e} className="space-y-1.5">
              <div className="h-14 rounded-md" style={{ background: EMOTION_META[e].color }} />
              <p className="text-micro font-medium">{e}</p>
              <p className="font-mono text-micro text-subtle">--{EMOTION_META[e].token}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="타이포그래피">
        <div className="space-y-3">
          <p className="text-display font-semibold tracking-tight">Display · 지금 떠오르는 걸 적어두세요</p>
          <p className="text-title font-semibold">Title · 지금의 나를 한눈에</p>
          <p className="text-heading font-semibold">Heading · 스트레스 상위 요인</p>
          <p className="text-body">Body · 아무렇게나 적어도 감정·사건·상황 태그가 붙어 나중에 분석할 수 있다. Pretendard Variable 기반, 한국어 줄바꿈은 keep-all.</p>
          <p className="text-caption text-muted">Caption · 보조 설명과 메타 정보</p>
          <p className="text-micro text-subtle">MICRO · 라벨과 뱃지</p>
        </div>
      </Section>

      <Section title="버튼">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg"><Sparkles className="size-4" /> Large</Button>
        </div>
      </Section>

      <Section title="칩 · 뱃지 · 세그먼트">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {EMOTIONS.map((e) => (
              <EmotionChip key={e} emotion={e} selected={sel.includes(e)} ai={e === "기쁨"} onClick={() => setSel(sel.includes(e) ? sel.filter((x) => x !== e) : [...sel, e])} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPES.map((ev) => <Chip key={ev} size="sm" selected={ev === "일"} onClick={() => {}}>{ev}</Chip>)}
            <Chip size="sm" onRemove={() => {}}>제거 가능</Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge><Badge tone="accent">Accent</Badge><Badge tone="success">Success</Badge><Badge tone="warning">Warning</Badge><Badge tone="danger">Danger</Badge>
          </div>
          <Segmented value={seg} onChange={setSeg} options={[{ value: "a", label: "최근 7일" }, { value: "b", label: "최근 30일" }, { value: "c", label: "전체" }]} />
        </div>
      </Section>

      <Section title="입력">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="이메일" hint="로그인에 사용"><Input placeholder="you@example.com" /></Field>
          <Field label="스트레스 원인"><Input defaultValue="마감 압박" /></Field>
          <div className="sm:col-span-2"><Textarea rows={3} placeholder="아무렇게나 적어도 괜찮습니다." /></div>
          <div className="sm:col-span-2"><IntensityPicker label="감정 강도" value={intensity} onChange={setIntensity} color="var(--anxiety)" /></div>
        </div>
      </Section>

      <Section title="카드 · 스탯 · 상태">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="연속 기록일" value={12} unit="일" icon={<Flame className="size-4" />} hint="오늘도 이어가고 있습니다" />
          <StatTile label="이번 주 기록" value={5} unit="건" hint="최근 7일" />
          <StatTile label="전체 기록" value={48} unit="건" hint="첫 번째 지속력 실험" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader title="카드 제목" description="보조 설명" action={<Button size="sm" variant="secondary">액션</Button>} />
            <CardBody className="space-y-2 pt-3">
              <Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-3/5" /><Skeleton className="h-3 w-2/3" />
            </CardBody>
          </Card>
          <EmptyState title="아직 리포트가 없습니다" description="기록 7건부터 생성할 수 있습니다." action={<Button variant="secondary" size="sm">리포트로</Button>} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setOpen(true)}>다이얼로그 열기</Button>
          <Button variant="secondary" onClick={() => toast.push({ tone: "success", title: "기록이 저장되었습니다", description: "태그 4개가 제안되었습니다" })}>토스트</Button>
          <Button variant="secondary" onClick={() => toast.push({ tone: "error", title: "저장하지 못했습니다" })}>에러 토스트</Button>
        </div>
        <Dialog open={open} onClose={() => setOpen(false)} title="이 기록을 삭제할까요?" description="되돌릴 수 없습니다." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>취소</Button><Button variant="danger" onClick={() => setOpen(false)}>삭제</Button></>} />
      </Section>

      <Section title="차트">
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="최근 감정 흐름" description="막대 높이는 강도, 색은 주 감정" />
            <CardBody className="pt-4"><EmotionFlowChart data={sampleFlow()} /></CardBody>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="스트레스 상위 요인" description="최근 30일" />
            <CardBody className="pt-4">
              <MeterList rows={[
                { name: "마감 압박", value: 1, figure: "7회", hint: "마지막 11/13", tone: "warning" },
                { name: "수면 부족", value: 0.57, figure: "4회", hint: "마지막 11/10", tone: "warning" },
                { name: "대인 갈등", value: 0.28, figure: "2회", hint: "마지막 11/02", tone: "warning" },
              ]} />
            </CardBody>
          </Card>
        </div>
        <Card className="mt-6">
          <CardBody><TimelineCharts entries={sampleTimeline()} changePoints={[{ date: "2026-10-05", description: "스트레스 요인이 일에서 관계로 이동" }]} /></CardBody>
        </Card>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-caption font-semibold uppercase tracking-wider text-subtle">{title}</h2>
      {children}
    </section>
  );
}
