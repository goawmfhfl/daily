-- 보안 어드바이저 대응 (0001 적용 후 실행)

-- 1) vector 확장을 extensions 스키마로 (Supabase 권장)
alter extension vector set schema extensions;

-- 2) 함수 search_path 고정
alter function public.set_updated_at() set search_path = public;
alter function public.match_entries(vector, int) set search_path = public, extensions;
alter function public.handle_new_user() set search_path = public;

-- 3) 트리거 전용 security definer 함수는 REST RPC 로 호출 불가하게
revoke execute on function public.handle_new_user() from public, anon, authenticated;
