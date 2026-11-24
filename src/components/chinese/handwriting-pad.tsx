"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Eraser, Eye, EyeOff, PenLine, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Chip } from "@/components/ui/chip";

/** 좌표는 캔버스 한 변을 1 로 둔 비율 → 패널 크기가 바뀌어도 획이 그대로 남는다 */
type Point = { x: number; y: number; w: number };
type Stroke = Point[];
type Grid = "mi" | "tian" | "none";

const TEXT_KEY = "daily:zh-hand-text";
const GRID_KEY = "daily:zh-hand-grid";
const GUIDE_KEY = "daily:zh-hand-guide";
const GRIDS = ["mi", "tian", "none"] as const;
const MAX_CHARS = 40;
const HAN = /\p{Script=Han}/u;
/** 굵기: 캔버스 한 변 대비 */
const INK = 0.038;
/** 밑글씨는 손글씨에 가까운 해서체를 먼저 쓴다 */
const GUIDE_FONT =
  '"Kaiti SC", "STKaiti", "KaiTi", "BiauKai", "Noto Serif SC", "Songti SC", "SimSun", serif';

function hanChars(s: string) {
  return Array.from(s)
    .filter((c) => HAN.test(c))
    .slice(0, MAX_CHARS);
}

function readLocal(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** 획 시작점: 둥근 점 하나 (한 번 톡 찍은 점도 남도록) */
function drawDot(ctx: CanvasRenderingContext2D, p: Point, size: number) {
  ctx.beginPath();
  ctx.arc(p.x * size, p.y * size, (size * INK * p.w) / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** i 번째 점이 들어왔을 때 그릴 조각 — 중점을 잇는 곡선으로 각진 꺾임을 없앤다 */
function drawStep(ctx: CanvasRenderingContext2D, s: Stroke, i: number, size: number) {
  const prev = s[i - 1];
  const cur = s[i];
  ctx.lineWidth = size * INK * prev.w;
  ctx.beginPath();
  if (i === 1) {
    const m = mid(prev, cur);
    ctx.moveTo(prev.x * size, prev.y * size);
    ctx.lineTo(m.x * size, m.y * size);
  } else {
    const a = mid(s[i - 2], prev);
    const b = mid(prev, cur);
    ctx.moveTo(a.x * size, a.y * size);
    ctx.quadraticCurveTo(prev.x * size, prev.y * size, b.x * size, b.y * size);
  }
  ctx.stroke();
}

/** 획 끝: 마지막 중점에서 실제 끝점까지 */
function drawTail(ctx: CanvasRenderingContext2D, s: Stroke, size: number) {
  if (s.length < 2) return;
  const last = s[s.length - 1];
  const m = mid(s[s.length - 2], last);
  ctx.lineWidth = size * INK * last.w;
  ctx.beginPath();
  ctx.moveTo(m.x * size, m.y * size);
  ctx.lineTo(last.x * size, last.y * size);
  ctx.stroke();
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, size: number) {
  if (s.length === 0) return;
  drawDot(ctx, s[0], size);
  for (let i = 1; i < s.length; i++) drawStep(ctx, s, i, size);
  drawTail(ctx, s, size);
}

export function HandwritingPad() {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [index, setIndex] = React.useState(0);
  const [grid, setGrid] = React.useState<Grid>("mi");
  const [showGuide, setShowGuide] = React.useState(true);
  /** 글자 순번별로 그린 획 — 앞뒤로 넘겨도 써 둔 글씨가 남는다 */
  const [strokes, setStrokes] = React.useState<Record<number, Stroke[]>>({});
  const [pinyinOf, setPinyinOf] = React.useState<((c: string) => string) | null>(null);

  const fabRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pickedRef = React.useRef("");

  const chars = React.useMemo(() => hanChars(text), [text]);
  const current = Math.min(index, Math.max(chars.length - 1, 0));
  const char = chars[current] ?? "";
  const currentStrokes = React.useMemo(() => strokes[current] ?? [], [strokes, current]);

  // 기기별 설정은 화면이 뜬 뒤 읽는다 (정적 HTML 과 어긋나지 않게)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(readLocal(TEXT_KEY) ?? "");
    const g = readLocal(GRID_KEY) as Grid | null;
    if (g && GRIDS.includes(g)) setGrid(g);
    setShowGuide(readLocal(GUIDE_KEY) !== "off");
  }, []);

  // 병음 사전은 무거우니 패널을 처음 열 때만 불러온다
  React.useEffect(() => {
    if (!open || pinyinOf) return;
    let alive = true;
    void import("pinyin-pro").then((m) => {
      if (alive) setPinyinOf(() => (c: string) => m.pinyin(c, { multiple: true }));
    });
    return () => {
      alive = false;
    };
  }, [open, pinyinOf]);

  const changeText = React.useCallback(
    (next: string) => {
      setText(next);
      writeLocal(TEXT_KEY, next);
      if (hanChars(next).join("") !== chars.join("")) {
        setStrokes({});
        setIndex(0);
      }
    },
    [chars],
  );

  const go = React.useCallback(
    (delta: number) => {
      if (chars.length === 0) return;
      setIndex((current + delta + chars.length) % chars.length);
    },
    [chars.length, current],
  );

  const undo = React.useCallback(() => {
    setStrokes((m) => ({ ...m, [current]: (m[current] ?? []).slice(0, -1) }));
  }, [current]);

  const clear = React.useCallback(() => {
    setStrokes((m) => ({ ...m, [current]: [] }));
  }, [current]);

  const addStroke = React.useCallback(
    (s: Stroke) => setStrokes((m) => ({ ...m, [current]: [...(m[current] ?? []), s] })),
    [current],
  );

  function openPanel() {
    // 페이지에서 한자를 드래그해 둔 채 열면 그 글자로 바로 연습한다
    const picked = hanChars(pickedRef.current).join("");
    pickedRef.current = "";
    if (picked) changeText(picked);
    setOpen(true);
    // 렌더가 반영된 뒤(inert 해제 후) 포커스를 옮긴다
    setTimeout(() => {
      const fine = window.matchMedia("(pointer: fine)").matches;
      if (fine && !picked && chars.length === 0) inputRef.current?.focus();
      else panelRef.current?.focus();
    });
  }

  const close = React.useCallback(() => {
    setOpen(false);
    setTimeout(() => fabRef.current?.focus(), 0);
  }, []);

  // 단축키: Esc 닫기, ⌘/Ctrl+Z 한 획 취소, ←/→ 글자 넘기기 (입력칸에 있을 때는 입력이 우선)
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!panelRef.current?.contains(t)) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, undo, go]);

  const pinyin = char && pinyinOf ? pinyinOf(char) : "";

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onPointerDown={() => {
          pickedRef.current = window.getSelection()?.toString() ?? "";
        }}
        onClick={openPanel}
        aria-label="한자 손글씨 연습"
        aria-expanded={open}
        title="한자 손글씨 연습"
        className={cn(
          "fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 inline-flex size-13 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-[opacity,transform,scale] duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] md:right-8 md:bottom-8",
          open && "pointer-events-none scale-90 opacity-0",
        )}
      >
        <PenLine className="size-5.5" strokeWidth={2} />
      </button>

      <aside
        ref={panelRef}
        role="dialog"
        aria-label="한자 손글씨 연습"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface text-foreground outline-none duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-[24rem]",
          // 열 때는 바로 보이게(그래야 곧바로 포커스를 옮길 수 있다), 닫을 때는 미끄러진 뒤 숨긴다
          open
            ? "visible translate-x-0 shadow-lg transition-[translate,box-shadow]"
            : "invisible translate-x-full transition-[translate,visibility,box-shadow]",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 pt-4 pb-3">
          <div>
            <h2 className="text-heading font-semibold">손글씨 연습</h2>
            <p className="mt-0.5 text-caption text-muted">밑글씨를 따라 한 획씩 써 보세요.</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="닫기" onClick={close} className="-mr-2">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
          <label className="block space-y-1.5">
            <span className="text-caption font-medium text-muted">연습할 한자</span>
            <Input
              ref={inputRef}
              lang="zh-CN"
              value={text}
              onChange={(e) => changeText(e.target.value)}
              placeholder="例: 你好 学习"
              className="text-[1.0625rem]"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {chars.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                aria-label="이전 글자"
                onClick={() => go(-1)}
                disabled={chars.length < 2}
                className="shrink-0"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5" role="tablist" aria-label="글자 고르기">
                {chars.map((c, i) => (
                  <button
                    key={`${i}-${c}`}
                    type="button"
                    role="tab"
                    aria-selected={i === current}
                    onClick={() => setIndex(i)}
                    lang="zh-CN"
                    className={cn(
                      "relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-[1.125rem] transition-colors",
                      i === current
                        ? "bg-accent-soft font-semibold text-accent"
                        : "text-muted hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    {c}
                    {(strokes[i]?.length ?? 0) > 0 && i !== current && (
                      <span className="absolute bottom-1 size-1 rounded-full bg-accent" aria-hidden />
                    )}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="다음 글자"
                onClick={() => go(1)}
                disabled={chars.length < 2}
                className="shrink-0"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : (
            <p className="text-caption text-subtle">
              한자를 입력하면 칸 뒤에 밑글씨가 깔립니다. 페이지에서 한자를 드래그한 뒤 버튼을 눌러도 돼요.
            </p>
          )}

          <div>
            {char && (
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-caption text-muted">
                  <span lang="zh-CN" className="text-body font-semibold text-foreground">
                    {char}
                  </span>
                  {pinyin && <span className="ml-2">{pinyin}</span>}
                </p>
                <span className="text-micro text-subtle tabular">
                  {current + 1} / {chars.length}
                </span>
              </div>
            )}
            <PracticeCanvas
              strokes={currentStrokes}
              onStroke={addStroke}
              guide={showGuide ? char : ""}
              grid={grid}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={undo}
              disabled={currentStrokes.length === 0}
              title="한 획 취소 (⌘/Ctrl+Z)"
            >
              <Undo2 className="size-4" /> 되돌리기
            </Button>
            <Button variant="secondary" size="sm" onClick={clear} disabled={currentStrokes.length === 0}>
              <Eraser className="size-4" /> 지우기
            </Button>
            {chars.length > 1 && (
              <Button size="sm" onClick={() => go(1)} className="ml-auto">
                다음 <ChevronRight className="size-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip
              size="sm"
              selected={showGuide}
              onClick={() => {
                setShowGuide((v) => {
                  writeLocal(GUIDE_KEY, v ? "off" : "on");
                  return !v;
                });
              }}
              title="밑글씨 없이 기억으로 써 보려면 끄세요"
            >
              {showGuide ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} 밑글씨
            </Chip>
            <Segmented<Grid>
              size="sm"
              value={grid}
              onChange={(g) => {
                setGrid(g);
                writeLocal(GRID_KEY, g);
              }}
              options={[
                { value: "mi", label: "米자 칸" },
                { value: "tian", label: "田자 칸" },
                { value: "none", label: "빈 칸" },
              ]}
            />
          </div>

          <p className="text-micro text-subtle">
            마우스·트랙패드·펜·손가락으로 그릴 수 있어요.
            <span className="hidden md:inline"> ⌘/Ctrl+Z 한 획 취소, ←/→ 글자 넘기기</span>
          </p>
        </div>
      </aside>
    </>
  );
}

function PracticeCanvas({
  strokes,
  onStroke,
  guide,
  grid,
}: {
  strokes: Stroke[];
  onStroke: (s: Stroke) => void;
  guide: string;
  grid: Grid;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const sizeRef = React.useRef(0);
  const activeRef = React.useRef<{ id: number; stroke: Stroke } | null>(null);
  const strokesRef = React.useRef(strokes);

  const ctx = React.useCallback(() => {
    const c = canvasRef.current?.getContext("2d");
    if (!c) return null;
    // 잉크 색은 테마를 따른다 (text-foreground 의 계산값)
    const color = getComputedStyle(canvasRef.current!).color;
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineCap = "round";
    c.lineJoin = "round";
    return c;
  }, []);

  const redraw = React.useCallback(() => {
    const c = ctx();
    const size = sizeRef.current;
    if (!c || !size) return;
    c.clearRect(0, 0, size, size);
    for (const s of strokesRef.current) drawStroke(c, s, size);
    if (activeRef.current) drawStroke(c, activeRef.current.stroke, size);
  }, [ctx]);

  React.useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [strokes, redraw]);

  // 크기에 맞춰 캔버스 해상도를 다시 잡는다 (레티나 선명도)
  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const size = wrap.clientWidth;
      if (!size) return;
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = size;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    });
    ro.observe(wrap);
    // 라이트/다크 전환 시 잉크 색을 다시 칠한다
    const mo = new MutationObserver(redraw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [redraw]);

  function toPoint(e: PointerEvent | React.PointerEvent): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    const pen = e.pointerType === "pen" && e.pressure > 0;
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      w: pen ? 0.45 + e.pressure * 0.9 : 1,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activeRef.current) return; // 한 번에 한 손가락만
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPoint(e);
    activeRef.current = { id: e.pointerId, stroke: [p] };
    const c = ctx();
    if (c) drawDot(c, p, sizeRef.current);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    if (!active || active.id !== e.pointerId) return;
    const c = ctx();
    const size = sizeRef.current;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = toPoint(ev);
      const s = active.stroke;
      const last = s[s.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.003) continue;
      s.push(p);
      if (c) drawStep(c, s, s.length - 1, size);
    }
  }

  function finish(e: React.PointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    if (!active || active.id !== e.pointerId) return;
    activeRef.current = null;
    const c = ctx();
    if (c) drawTail(c, active.stroke, sizeRef.current);
    onStroke(active.stroke);
  }

  return (
    <div
      ref={wrapRef}
      className="relative aspect-square w-full overflow-hidden rounded-lg border border-border-strong bg-background [container-type:inline-size]"
    >
      <GridLines grid={grid} />
      {guide && (
        <span
          lang="zh-CN"
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center leading-none text-foreground opacity-[0.13] select-none"
          style={{ fontSize: "80cqw", fontFamily: GUIDE_FONT }}
        >
          {guide}
        </span>
      )}
      <canvas
        ref={canvasRef}
        aria-label={guide ? `${guide} 따라 쓰기 칸` : "손글씨 칸"}
        role="img"
        className="absolute inset-0 size-full cursor-crosshair touch-none text-foreground"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

/** 米자 칸(가로·세로·대각선 점선) / 田자 칸(가로·세로 점선) */
function GridLines({ grid }: { grid: Grid }) {
  if (grid === "none") return null;
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full text-danger opacity-40"
      aria-hidden
    >
      <g stroke="currentColor" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" fill="none">
        <line x1="50" y1="0" x2="50" y2="100" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="50" x2="100" y2="50" vectorEffect="non-scaling-stroke" />
        {grid === "mi" && (
          <>
            <line x1="0" y1="0" x2="100" y2="100" vectorEffect="non-scaling-stroke" />
            <line x1="100" y1="0" x2="0" y2="100" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </g>
    </svg>
  );
}
