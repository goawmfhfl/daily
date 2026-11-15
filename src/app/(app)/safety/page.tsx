import type { Metadata } from "next";
import Link from "next/link";
import { Phone, Heart, ArrowLeft } from "lucide-react";
import { CRISIS_RESOURCES } from "@/lib/constants";
import { Button, ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "지금 안전한가요" };

/**
 * 위기 대응 화면.
 * 기록에서 자해·극단적 선택 암시가 감지되면 분석·태그를 멈추고 이 화면으로 옵니다.
 * 연락처는 출시 시점에 최신 정보로 다시 확인해야 합니다.
 */
export default async function SafetyPage({ searchParams }: PageProps<"/safety">) {
  const sp = await searchParams;
  const entryId = typeof sp.entry === "string" ? sp.entry : null;

  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="mb-8 flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
        <Heart className="size-7" />
      </div>
      <h1 className="text-display font-semibold tracking-tight text-balance">
        지금, 안전한가요?
      </h1>
      <p className="mt-3 text-body leading-relaxed text-muted">
        방금 쓴 글에서 힘든 마음이 느껴졌습니다. 기록은 저장되었고, 이 기록은 분석하지 않습니다.
        지금은 데이터보다 당신이 먼저입니다. 혼자 버티지 않아도 됩니다.
      </p>

      <div className="mt-8 space-y-3">
        {CRISIS_RESOURCES.map((r) => (
          <a
            key={r.name}
            href={`tel:${r.number.replace(/[^\d]/g, "").slice(0, 11)}`}
            className="surface-card flex items-center justify-between gap-4 px-5 py-4 transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-md"
          >
            <div>
              <p className="text-body font-semibold">{r.name}</p>
              <p className="text-caption text-muted">{r.note}</p>
            </div>
            <span className="inline-flex items-center gap-2 text-heading font-semibold tabular text-danger">
              <Phone className="size-4" />
              {r.number}
            </span>
          </a>
        ))}
      </div>

      <div className="mt-8 rounded-lg bg-surface-2 px-5 py-4 text-caption leading-relaxed text-muted">
        가까운 사람에게 지금 상태를 한 문장으로 알려 주는 것도 방법입니다.
        “지금 많이 힘들어. 잠깐 같이 있어 줄 수 있어?” 정도면 충분합니다.
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <ButtonLink href="/" variant="primary">
          <ArrowLeft className="size-4" /> 기록으로 돌아가기
        </ButtonLink>
        {entryId && (
          <ButtonLink href={`/entries/${entryId}`} variant="secondary">
            방금 쓴 기록 보기
          </ButtonLink>
        )}
        <Link href="/settings" className="inline-flex">
          <Button variant="ghost">설정</Button>
        </Link>
      </div>
    </div>
  );
}
