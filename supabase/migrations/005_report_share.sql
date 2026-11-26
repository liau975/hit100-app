-- 학부모 리포트 링크: 선생님이 만든 보고서 사본을 링크(토큰)로 공유. 로그인 없이 그 보고서 하나만 볼 수 있다.
create table if not exists report_shares (
  token text primary key check (char_length(token) >= 16),
  academy_id uuid not null references academies on delete cascade,
  attempt_id uuid,
  student_id uuid,
  created_by uuid default auth.uid() references auth.users on delete set null,
  snapshot jsonb not null,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '120 days'
);
create index if not exists report_shares_attempt_idx on report_shares (attempt_id);
alter table report_shares enable row level security;
drop policy if exists rs_sel on report_shares;
create policy rs_sel on report_shares for select using (is_staff(academy_id));
drop policy if exists rs_ins on report_shares;
create policy rs_ins on report_shares for insert with check (is_staff(academy_id));
drop policy if exists rs_del on report_shares;
create policy rs_del on report_shares for delete using (is_staff(academy_id));
grant select, insert, delete on report_shares to authenticated;

-- 링크로 보기 (로그인 없이). 토큰이 맞고 기간 안이면 그 보고서 사본만 돌려준다.
create or replace function get_report(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select r.snapshot || jsonb_build_object('academy', a.name, 'shared_at', r.created_at)
  from report_shares r join academies a on a.id = r.academy_id
  where r.token = p_token and r.expires_at > now()
$$;
grant execute on function get_report(text) to anon, authenticated;
