"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { useAddZhVocab, useZhVocab, useZhVocabJobs } from "@/lib/query/hooks";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

/** 단어장에 넣을 만한 선택인지: 한자가 있고, 너무 길지 않게 (문장까지 20자) */
const MAX_LEN = 20;
const EDGE = /^[\s\p{P}\p{S}\d]+|[\s\p{P}\p{S}\d]+$/gu;

function cleanSelection(raw: string) {
  const t = raw.replace(/\s+/g, "").replace(EDGE, "");
  if (!t || [...t].length > MAX_LEN || !/\p{Script=Han}/u.test(t)) return null;
  return t;
}

/** 선택한 글이 들어 있는 문장 (AI가 문맥에 맞는 뜻을 고르게) */
function sentenceAround(container: Element | null, text: string) {
  const all = (container?.textContent ?? "").replace(/\s+/g, "");
  const sentence = all.split(/(?<=[。！？；!?])/).find((s) => s.includes(text));
  return (sentence ?? all.slice(0, 120)).trim() || null;
}

interface Picked {
  text: string;
  context: string | null;
  /** 선택 영역 (화면 기준) */
  rect: { top: number; bottom: number; left: number; width: number };
}

/**
 * 안쪽 글에서 중국어를 드래그(모바일은 길게 눌러 선택)하면
 * 선택 위에 "단어장에 추가" 버튼이 뜬다. 뜻·예문 카드는 기존 단어장 AI가 만든다.
 * 문맥은 가장 가까운 [data-zh-context] 요소의 글에서 그 문장을 찾아 쓴다.
 */
export function SelectToVocab({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [picked, setPicked] = React.useState<Picked | null>(null);
  const vocab = useZhVocab();
  const add = useAddZhVocab();
  const jobs = useZhVocabJobs();

  const read = React.useCallback(() => {
    const sel = window.getSelection();
    const root = ref.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !root) return setPicked(null);
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return setPicked(null);
    const text = cleanSelection(sel.toString());
    if (!text) return setPicked(null);
    const r = range.getBoundingClientRect();
    if (!r.width && !r.height) return setPicked(null);
    const node = range.startContainer.nodeType === 1 ? (range.startContainer as Element) : range.startContainer.parentElement;
    setPicked({
      text,
      context: sentenceAround(node?.closest("[data-zh-context]") ?? null, text),
      rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width },
    });
  }, []);

  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    // 드래그하는 동안 계속 바뀌므로 잠깐 멈춘 뒤에 읽는다
    const onChange = () => {
      if (t) clearTimeout(t);
      t = setTimeout(read, 180);
    };
    const onScroll = () => setPicked(null);
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (t) clearTimeout(t);
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [read]);

  const saved = picked ? vocab.data?.some((v) => v.hanzi === picked.text || v.input === picked.text) : false;
  const pending = picked ? jobs.some((j) => j.status === "pending" && j.text === picked.text) : false;

  function save() {
    if (!picked || saved || pending) return;
    // 결과 알림·단어장 반영은 훅이 맡는다 (화면을 떠나도 끝까지)
    add.mutate({ text: picked.text, context: picked.context });
    window.getSelection()?.removeAllRanges();
    setPicked(null);
  }

  // 터치 화면은 기본 메뉴가 선택 위에 뜨므로 버튼은 아래에
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const top = picked ? (coarse ? picked.rect.bottom + 10 : picked.rect.top - 44) : 0;
  const left = picked ? Math.min(Math.max(picked.rect.left + picked.rect.width / 2, 110), window.innerWidth - 110) : 0;

  return (
    <div ref={ref} className={className}>
      {children}
      {picked &&
        createPortal(
          <button
            type="button"
            // 누르는 순간 선택이 풀리지 않게
            onMouseDown={(e) => e.preventDefault()}
            onClick={save}
            disabled={saved || pending}
            style={{ top: Math.max(top, 8), left }}
            className={cn(
              "fixed z-[60] inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full px-3.5 text-caption font-semibold shadow-lg animate-fade-in",
              saved ? "bg-surface text-accent ring-1 ring-border" : "bg-primary text-primary-foreground hover:opacity-90",
            )}
          >
            {pending ? <Spinner className="size-3.5" /> : saved ? <BookmarkCheck className="size-3.5" /> : <BookmarkPlus className="size-3.5" />}
            <span lang="zh-CN" className="max-w-[9rem] truncate">{picked.text}</span>
            <span className="opacity-80">{saved ? "단어장에 있음" : pending ? "만드는 중" : "단어장에 추가"}</span>
          </button>,
          document.body,
        )}
    </div>
  );
}
