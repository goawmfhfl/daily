"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck, Copy, Plus, RotateCw, Star, Trash2 } from "lucide-react";
import { ZH_LEVELS, ZH_LEVEL_META, type ZhLevel } from "@/lib/constants";
import type { ZhPhraseWithTranslations } from "@/lib/types";
import { cn, relativeDayLabel, todayKey } from "@/lib/utils";
import {
  useAddZhLevel,
  useDeleteZhPhrase,
  useDeleteZhVocab,
  useSaveZhSentence,
  useToggleZhFavorite,
  useZhVocab,
} from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ZhSentence } from "./zh-sentence";

export function PhraseCard({
  phrase,
  showPinyin,
  preferredLevel,
  highlight,
}: {
  phrase: ZhPhraseWithTranslations;
  showPinyin: boolean;
  /** 처음 보여 줄 난이도. 그 번역이 없으면 가지고 있는 것 중 첫 번째 */
  preferredLevel: ZhLevel;
  highlight?: boolean;
}) {
  const toast = useToast();
  const addLevel = useAddZhLevel();
  const toggleFav = useToggleZhFavorite();
  const del = useDeleteZhPhrase();
  const vocab = useZhVocab();
  const saveSentence = useSaveZhSentence();
  const unsaveSentence = useDeleteZhVocab();

  const byLevel = React.useMemo(
    () => new Map(phrase.zh_translations.map((t) => [t.level, t])),
    [phrase.zh_translations],
  );
  const firstAvailable = ZH_LEVELS.find((l) => byLevel.has(l)) ?? preferredLevel;
  const [level, setLevel] = React.useState<ZhLevel>(byLevel.has(preferredLevel) ? preferredLevel : firstAvailable);
  const [pending, setPending] = React.useState<ZhLevel | null>(null);
  const [confirm, setConfirm] = React.useState(false);

  const current = byLevel.get(level);
  // 지금 보이는 난이도의 문장이 단어장에 있는지
  const savedItem = current
    ? vocab.data?.find(
        (v) => v.kind === "sentence" && (v.source_translation_id === current.id || v.hanzi === current.hanzi),
      )
    : undefined;

  function toggleSentence() {
    if (!current) return;
    if (savedItem) {
      unsaveSentence.mutate(savedItem.id, {
        onSuccess: () => toast.push({ tone: "info", title: "단어장에서 뺐습니다" }),
        onError: (e) => toast.push({ tone: "error", title: "실패", description: e.message }),
      });
    } else {
      saveSentence.mutate(current.id, {
        onSuccess: () => toast.push({ tone: "success", title: "문장을 단어장에 저장했습니다" }),
        onError: (e) => toast.push({ tone: "error", title: "저장하지 못했습니다", description: e.message }),
      });
    }
  }

  function translate(l: ZhLevel) {
    setLevel(l);
    setPending(l);
    addLevel.mutate(
      { phraseId: phrase.id, level: l },
      {
        onError: (e) => toast.push({ tone: "error", title: "번역하지 못했습니다", description: e.message }),
        onSettled: () => setPending(null),
      },
    );
  }

  function selectLevel(l: ZhLevel) {
    if (byLevel.has(l)) setLevel(l);
    else translate(l);
  }

  async function copy() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(`${current.hanzi}\n${current.pinyin}`);
      toast.push({ tone: "success", title: "한자와 병음을 복사했습니다" });
    } catch {
      toast.push({ tone: "error", title: "복사하지 못했습니다" });
    }
  }

  return (
    <article
      className={cn(
        "surface-card overflow-hidden transition-[border-color,box-shadow]",
        highlight && "border-accent/40 shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <p className="text-micro font-medium text-subtle">
            {relativeDayLabel(todayKey(new Date(phrase.created_at)), todayKey())}
          </p>
          <p className="mt-0.5 text-body text-foreground/85">{phrase.source_ko}</p>
        </div>
        <button
          type="button"
          onClick={() => toggleFav.mutate({ id: phrase.id, favorite: !phrase.favorite })}
          aria-pressed={phrase.favorite}
          aria-label={phrase.favorite ? "즐겨찾기 해제" : "즐겨찾기"}
          className="-mr-1 rounded-md p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Star className={cn("size-4", phrase.favorite && "fill-warning text-warning")} />
        </button>
      </div>

      {/* 난이도 탭: 이미 있는 번역은 바로 전환, 없는 난이도는 눌러서 번역 */}
      <div className="mt-3 flex flex-wrap gap-1.5 px-5" role="tablist">
        {ZH_LEVELS.map((l) => {
          const has = byLevel.has(l);
          const active = level === l;
          const loading = pending === l;
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectLevel(l)}
              disabled={loading}
              title={ZH_LEVEL_META[l].description}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-caption font-medium transition-colors",
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : has
                    ? "border-border bg-surface text-muted hover:text-foreground"
                    : "border-dashed border-border-strong bg-transparent text-subtle hover:text-foreground",
              )}
            >
              {loading ? <Spinner className="size-3" /> : !has && <Plus className="size-3" />}
              {ZH_LEVEL_META[l].label}
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-4 pt-4">
        {pending === level ? (
          <div className="flex items-center gap-2 py-6 text-caption text-muted">
            <Spinner className="size-4" /> {ZH_LEVEL_META[level].label}으로 번역하는 중…
          </div>
        ) : current ? (
          <>
            <ZhSentence key={current.id} segments={current.segments} showPinyin={showPinyin} context={current.hanzi} />
            {current.note && (
              <p className="mt-4 border-l-2 border-accent/50 pl-3 text-caption leading-relaxed text-muted">
                {current.note}
              </p>
            )}
          </>
        ) : (
          <p className="py-6 text-caption text-subtle">이 난이도 번역이 아직 없습니다.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border bg-surface-2/40 px-3 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSentence}
          disabled={!current || !!pending}
          loading={saveSentence.isPending || unsaveSentence.isPending}
          aria-pressed={!!savedItem}
          className={cn("mr-auto", savedItem && "text-accent hover:text-accent")}
        >
          {savedItem ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
          {savedItem ? "단어장에 저장됨" : "문장 저장"}
        </Button>
        <Button variant="ghost" size="sm" onClick={copy} disabled={!current}>
          <Copy className="size-3.5" /> 복사
        </Button>
        <Button variant="ghost" size="sm" onClick={() => translate(level)} disabled={!!pending || !current}>
          <RotateCw className="size-3.5" /> 다시 번역
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirm(true)} className="text-danger hover:text-danger">
          <Trash2 className="size-3.5" /> 삭제
        </Button>
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="이 문장을 삭제할까요?"
        description="모든 난이도의 번역이 함께 삭제되며 되돌릴 수 없습니다."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>취소</Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() =>
                del.mutate(phrase.id, {
                  onSuccess: () => setConfirm(false),
                  onError: (e) => toast.push({ tone: "error", title: "삭제 실패", description: e.message }),
                })
              }
            >
              삭제
            </Button>
          </>
        }
      />
    </article>
  );
}
