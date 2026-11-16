"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        queryClient.clear();
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          queryClient.clear();
          router.replace(next);
          router.refresh();
        } else {
          setNotice("확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인하세요.");
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? translate(err.message) : "실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="이메일">
        <Input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <Field label="비밀번호" hint={mode === "signup" ? "6자 이상" : undefined}>
        <Input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {error && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">{error}</p>
      )}
      {notice && (
        <p className="rounded-md bg-accent-soft px-3 py-2 text-caption text-accent">{notice}</p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {mode === "signin" ? "로그인" : "계정 만들기"}
      </Button>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="w-full text-center text-caption text-muted hover:text-foreground"
      >
        {mode === "signin" ? "처음이신가요? 계정 만들기" : "이미 계정이 있나요? 로그인"}
      </button>
    </form>
  );
}

function translate(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (/email not confirmed/i.test(msg)) return "이메일 확인이 필요합니다. 받은 메일의 링크를 눌러 주세요.";
  if (/already registered/i.test(msg)) return "이미 가입된 이메일입니다.";
  if (/rate limit/i.test(msg)) return "잠시 후 다시 시도해 주세요.";
  return msg;
}
