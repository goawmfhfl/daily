import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-caption font-medium text-accent">404</p>
      <h1 className="mt-1 text-title font-semibold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-body text-muted">삭제되었거나 주소가 잘못되었습니다.</p>
      <ButtonLink href="/" variant="primary" className="mt-6">기록으로</ButtonLink>
    </div>
  );
}
