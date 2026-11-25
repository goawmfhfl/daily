"use client";

import * as React from "react";
import { AlignLeft, BookOpen, BookOpenCheck, EyeOff, Languages, ListOrdered, Search, Sparkles } from "lucide-react";
import { ZH_LEVELS, ZH_LEVEL_META, ZH_MAX_INPUT, type ZhLevel } from "@/lib/constants";
import { useMe, useTranslateZh, useZhPhrases, useZhVocab } from "@/lib/query/hooks";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton, QueryError } from "@/components/ui/query-state";
import { useToast } from "@/components/ui/toast";
import { PhraseCard } from "@/components/chinese/phrase-card";
import { VocabPanel } from "@/components/chinese/vocab-panel";
import { HandwritingPad } from "@/components/chinese/handwriting-pad";
import { HskPanel } from "@/components/hsk/hsk-panel";
import type { ZhView } from "@/components/chinese/zh-study";
import type { ZhPhraseWithTranslations, ZhVocabRow } from "@/lib/types";

const LEVEL_KEY = "daily:zh-level";
const PINYIN_KEY = "daily:zh-pinyin";
const TAB_KEY = "daily:zh-tab";
const VIEW_KEY = "daily:zh-view";
const HIDE_KEY = "daily:zh-hide";
const VIEWS = ["paragraph", "sentences"] as const;
const TABS = ["translate", "vocab", "reading"] as const;
type Tab = (typeof TABS)[number];

/** 기기별 편의 설정: 마지막 난이도, 병음 보기 */
function readLocal<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function ChineseView() {
  const phrases = useZhPhrases();
  const vocab = useZhVocab();
  const failed = [phrases, vocab].find((q) => q.isError);
  if (failed) {
    return (
      <QueryError
        error={failed.error}
        onRetry={() => {
          void phrases.refetch();
          void vocab.refetch();
        }}
      />
    );
  }
  if (!phrases.data || !vocab.data) return <PageSkeleton />;
  return <Chinese phrases={phrases.data} vocab={vocab.data} />;
}

function Chinese({ phrases, vocab }: { phrases: ZhPhraseWithTranslations[]; vocab: ZhVocabRow[] }) {
  const me = useMe();
  const [tab, setTab] = React.useState<Tab>("translate");
  const [showPinyin, setShowPinyin] = React.useState(true);
  const [view, setView] = React.useState<ZhView>("paragraph");
  const [hide, setHide] = React.useState(false);

  // 저장된 기기 설정은 화면이 뜬 뒤 읽는다 (정적 HTML 과 어긋나지 않게)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(readLocal(TAB_KEY, "translate", TABS));
    setShowPinyin(readLocal(PINYIN_KEY, "on", ["on", "off"] as const) === "on");
    setView(readLocal(VIEW_KEY, "paragraph", VIEWS));
    setHide(readLocal(HIDE_KEY, "off", ["on", "off"] as const) === "on");
  }, []);

  const aiAvailable = me.data?.aiAvailable ?? true;

  function changeTab(t: Tab) {
    setTab(t);
    writeLocal(TAB_KEY, t);
  }
  function togglePinyin() {
    setShowPinyin((v) => {
      writeLocal(PINYIN_KEY, v ? "off" : "on");
      return !v;
    });
  }

  function changeView(v: ZhView) {
    setView(v);
    writeLocal(VIEW_KEY, v);
  }
  function toggleHide() {
    setHide((v) => {
      writeLocal(HIDE_KEY, v ? "off" : "on");
      return !v;
    });
  }

  // 가리기: 한국어만 보고 중국어를 떠올린 뒤 눌러서 확인 / 병음: 한자 아래 발음
  const pinyinToggle = (
    <div className="flex items-center gap-1.5">
      <Chip size="sm" selected={hide} onClick={toggleHide} title="한국어만 보고 중국어로 말해 보기">
        <EyeOff className="size-3.5" /> 중국어 가리기
      </Chip>
      <Chip size="sm" selected={showPinyin} onClick={togglePinyin}>
        병음 보기
      </Chip>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="중국어"
        description={
          tab === "translate"
            ? "한국어로 쓰면 원하는 난이도의 중국어로 바꿔 줍니다. 번역한 문장은 아래에 쌓입니다."
            : tab === "vocab"
              ? "외우고 싶은 단어·숙어·문장을 모아 둡니다. 뜻과 해석, 예문은 AI가 만들어 줍니다."
              : "AI가 만든 HSK 독해 문제(빈칸 채우기·문장 고르기·독해 이해)를 풀고, 틀린 문제는 오답노트로 다시 풉니다."
        }
        action={
          <Segmented<Tab>
            value={tab}
            onChange={changeTab}
            options={[
              { value: "translate", label: "번역", icon: <Languages className="size-4" /> },
              { value: "vocab", label: `단어장 ${vocab.length}`, icon: <BookOpen className="size-4" /> },
              { value: "reading", label: "독해", icon: <BookOpenCheck className="size-4" /> },
            ]}
          />
        }
      />

      {tab === "translate" ? (
        <TranslatePanel
          phrases={phrases}
          showPinyin={showPinyin}
          view={view}
          onViewChange={changeView}
          hide={hide}
          pinyinToggle={pinyinToggle}
          aiAvailable={aiAvailable}
        />
      ) : tab === "reading" ? (
        <HskPanel aiAvailable={aiAvailable} />
      ) : (
        <VocabPanel
          items={vocab}
          showPinyin={showPinyin}
          hide={hide}
          pinyinToggle={pinyinToggle}
          aiAvailable={aiAvailable}
        />
      )}

      {tab !== "reading" && <HandwritingPad />}
    </div>
  );
}

function TranslatePanel({
  phrases,
  showPinyin,
  view,
  onViewChange,
  hide,
  pinyinToggle,
  aiAvailable,
}: {
  phrases: ZhPhraseWithTranslations[];
  showPinyin: boolean;
  view: ZhView;
  onViewChange: (v: ZhView) => void;
  hide: boolean;
  pinyinToggle: React.ReactNode;
  aiAvailable: boolean;
}) {
  const toast = useToast();
  const translate = useTranslateZh();

  const [level, setLevel] = React.useState<ZhLevel>("conversation");
  const [text, setText] = React.useState("");
  const [lastId, setLastId] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [onlyFav, setOnlyFav] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLevel(readLocal(LEVEL_KEY, "conversation", ZH_LEVELS));
  }, []);

  const trimmed = text.trim();

  function changeLevel(l: ZhLevel) {
    setLevel(l);
    writeLocal(LEVEL_KEY, l);
  }

  function submit() {
    if (!trimmed || translate.isPending) return;
    translate.mutate(
      { source_ko: trimmed, level },
      {
        onSuccess: (p) => {
          setText("");
          setLastId(p.id);
          setQ("");
          setOnlyFav(false);
        },
        onError: (e) => toast.push({ tone: "error", title: "번역하지 못했습니다", description: e.message }),
      },
    );
  }

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return phrases.filter((p) => {
      if (onlyFav && !p.favorite) return false;
      if (!needle) return true;
      return (
        p.source_ko.toLowerCase().includes(needle) ||
        p.zh_translations.some(
          (t) => t.hanzi.includes(needle) || t.pinyin.toLowerCase().includes(needle),
        )
      );
    });
  }, [phrases, q, onlyFav]);

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden">
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Segmented<ZhLevel>
              value={level}
              onChange={changeLevel}
              options={ZH_LEVELS.map((l) => ({ value: l, label: ZH_LEVEL_META[l].label }))}
            />
            <p className="text-caption text-subtle">{ZH_LEVEL_META[level].description}</p>
          </div>

          <Textarea
            autoResize
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            maxLength={ZH_MAX_INPUT}
            disabled={translate.isPending}
            placeholder="예: 오늘 회사에서 너무 바빠서 점심도 못 먹었어."
            className="min-h-[96px] text-[1.0625rem]"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-micro text-subtle">
              {text.length > 0 ? `${text.length}/${ZH_MAX_INPUT}자 · ` : ""}⌘/Ctrl + Enter
            </span>
            <Button onClick={submit} disabled={!trimmed || !aiAvailable} loading={translate.isPending}>
              <Sparkles className="size-4" /> 번역
            </Button>
          </div>
          {!aiAvailable && (
            <p className="text-caption text-warning">OPENAI_API_KEY 가 설정되지 않아 번역할 수 없습니다.</p>
          )}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <SectionTitle action={pinyinToggle}>
          {`쌓인 문장 ${phrases.length}`}
        </SectionTitle>

        {phrases.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Segmented<ZhView>
              value={view}
              onChange={onViewChange}
              size="sm"
              options={[
                { value: "paragraph", label: "문단", icon: <AlignLeft className="size-3.5" /> },
                { value: "sentences", label: "문장별", icon: <ListOrdered className="size-3.5" /> },
              ]}
            />
            <p className="text-caption text-subtle">
              {hide
                ? "한국어만 보고 중국어로 말해 본 뒤, 눌러서 맞춰 보세요."
                : view === "sentences"
                  ? "한 문장씩 나눠 외우기 좋게 보여 줍니다."
                  : "중국어 가리기를 켜면 즉석 번역 연습을 할 수 있어요."}
            </p>
          </div>
        )}

        {phrases.length > 0 && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="한국어, 한자, 병음으로 찾기"
                className="pl-9"
              />
            </div>
            <Chip selected={onlyFav} onClick={() => setOnlyFav((v) => !v)} className="h-10 px-3.5">
              즐겨찾기
            </Chip>
          </div>
        )}

        {phrases.length === 0 ? (
          <EmptyState
            icon={<Languages className="size-5" />}
            title="아직 번역한 문장이 없습니다"
            description="오늘 하고 싶었던 말 한 문장부터 중국어로 바꿔 보세요."
          />
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong/70 px-4 py-8 text-center text-caption text-muted">
            조건에 맞는 문장이 없습니다.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((p) => (
              <li key={p.id}>
                <PhraseCard
                  phrase={p}
                  showPinyin={showPinyin}
                  preferredLevel={level}
                  highlight={p.id === lastId}
                  view={view}
                  hide={hide}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
