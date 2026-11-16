"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { useWipeAccount } from "@/lib/query/hooks";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function DangerZone() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const wipeAccount = useWipeAccount();
  const busy = wipeAccount.isPending;

  function wipe() {
    wipeAccount.mutate(undefined, {
      onSuccess: () => {
        toast.push({ tone: "success", title: "모든 기록을 삭제했습니다" });
        setOpen(false);
        router.push("/");
      },
      onError: (e) => toast.push({ tone: "error", title: "삭제 실패", description: e.message }),
    });
  }

  return (
    <Card>
      <CardHeader title="내 데이터" description="가장 사적인 정보입니다. 언제든 가져가고, 언제든 지울 수 있습니다." />
      <CardBody className="flex flex-col gap-3 pt-4 sm:flex-row">
        <a href="/api/export" download className="inline-flex">
          <Button variant="secondary" className="w-full">
            <Download className="size-4" /> JSON 으로 내보내기
          </Button>
        </a>
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" /> 모든 기록 삭제
        </Button>
      </CardBody>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="모든 기록을 삭제할까요?"
        description="기록, 태그, 활동, 리포트가 모두 삭제되며 되돌릴 수 없습니다. 먼저 내보내기를 권합니다."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
            <Button variant="danger" onClick={wipe} loading={busy} disabled={confirmText !== "삭제"}>영구 삭제</Button>
          </>
        }
      >
        <label className="block text-caption text-muted">
          확인을 위해 <b className="text-foreground">삭제</b> 라고 입력하세요
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-2" autoFocus />
        </label>
      </Dialog>
    </Card>
  );
}
