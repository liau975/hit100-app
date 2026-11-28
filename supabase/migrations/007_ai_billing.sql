-- AI 사용량 기록 · 학원별 월 한도 · 학원 자체 API 키(BYOK)
-- 기록(ai_usage)은 서버 함수만 쓴다(service role). 학원 선생님은 자기 학원 것만, 앱 관리자는 전부 본다.
create table if not exists ai_usage (
  id bigint generated always as identity primary key,
  academy_id uuid not null references academies on delete cascade,
  user_id uuid references auth.users on delete set null,
  action text,
  model text,
  in_tokens int default 0,
  out_tokens int default 0,
  cost_krw numeric(10,2) default 0,
  byok boolean default false,
  created_at timestamptz default now()
);
create index if not exists ai_usage_acad_idx on ai_usage (academy_id, created_at desc);
alter table ai_usage enable row level security;
drop policy if exists au_sel on ai_usage;
create policy au_sel on ai_usage for select using (is_staff(academy_id) or is_admin());
grant select on ai_usage to authenticated;

-- 학원별 한도. 행이 없으면 기본 한도(월 5,000원)를 쓴다. monthly_limit_krw가 null이면 무제한.
-- 앱 관리자만 바꿀 수 있다(원장이 스스로 한도를 올리지 못하게).
create table if not exists academy_billing (
  academy_id uuid primary key references academies on delete cascade,
  monthly_limit_krw int default 5000,
  ai_enabled boolean not null default true,
  plan text default 'free',
  memo text,
  updated_at timestamptz default now()
);
alter table academy_billing enable row level security;
drop policy if exists ab_sel on academy_billing;
create policy ab_sel on academy_billing for select using (is_staff(academy_id) or is_admin());
grant select on academy_billing to authenticated;

-- 학원 자체 Anthropic 키. 정책이 없으므로 앱에서는 아무도 읽을 수 없고, 서버 함수(service role)만 읽는다.
create table if not exists academy_ai_keys (
  academy_id uuid primary key references academies on delete cascade,
  api_key text not null,
  updated_at timestamptz default now()
);
alter table academy_ai_keys enable row level security;
revoke all on academy_ai_keys from anon, authenticated;

drop function if exists ai_month_cost(uuid);
create or replace function ai_month_cost(aid uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_krw), 0) from ai_usage
  where academy_id = aid and not byok
    and created_at >= date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
$$;
revoke all on function ai_month_cost(uuid) from public, anon, authenticated;
grant execute on function ai_month_cost(uuid) to service_role;

-- 학원 화면용: 이번 달 사용량·한도·키 등록 여부
drop function if exists ai_status(uuid);
create or replace function ai_status(aid uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare b academy_billing; k text; r json;
begin
  if not (is_staff(aid) or is_admin()) then raise exception 'forbidden'; end if;
  select * into b from academy_billing where academy_id = aid;
  select api_key into k from academy_ai_keys where academy_id = aid;
  select json_build_object(
    'used', ai_month_cost(aid),
    'byok_used', (select coalesce(sum(cost_krw),0) from ai_usage where academy_id = aid and byok and created_at >= date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'),
    'limit', case when b.academy_id is null then 5000 else b.monthly_limit_krw end,
    'enabled', coalesce(b.ai_enabled, true),
    'plan', coalesce(b.plan, 'free'),
    'byok', k is not null,
    'key_tail', case when k is null then null else right(k, 4) end,
    'by_action', (select coalesce(json_object_agg(action, c), '{}'::json) from (select coalesce(action,'기타') action, count(*) c from ai_usage where academy_id = aid and created_at >= date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' group by 1) t)
  ) into r;
  return r;
end $$;
grant execute on function ai_status(uuid) to authenticated;

-- 원장(owner)이 학원 키를 등록/삭제
drop function if exists set_ai_key(uuid, text);
create or replace function set_ai_key(aid uuid, k text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner(aid) then raise exception '관리자(원장)만 바꿀 수 있어요'; end if;
  if k is null or btrim(k) = '' then delete from academy_ai_keys where academy_id = aid; return; end if;
  if btrim(k) !~ '^sk-ant-api' then raise exception 'Anthropic API 키(sk-ant-api…)가 아니에요'; end if;
  insert into academy_ai_keys (academy_id, api_key, updated_at) values (aid, btrim(k), now())
  on conflict (academy_id) do update set api_key = excluded.api_key, updated_at = now();
end $$;
grant execute on function set_ai_key(uuid, text) to authenticated;

-- 앱 관리자용: 전체 학원 사용량 목록과 한도 설정
drop function if exists admin_ai_list();
create or replace function admin_ai_list() returns table (academy_id uuid, name text, used numeric, byok_used numeric, monthly_limit_krw int, has_row boolean, ai_enabled boolean, plan text, byok boolean, members bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query
  select a.id, a.name, ai_month_cost(a.id),
    (select coalesce(sum(u.cost_krw),0) from ai_usage u where u.academy_id = a.id and u.byok and u.created_at >= date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'),
    case when b.academy_id is null then 5000 else b.monthly_limit_krw end, b.academy_id is not null,
    coalesce(b.ai_enabled, true), coalesce(b.plan, 'free'),
    exists(select 1 from academy_ai_keys k where k.academy_id = a.id),
    (select count(*) from members m where m.academy_id = a.id)
  from academies a left join academy_billing b on b.academy_id = a.id
  order by 3 desc, a.created_at;
end $$;
grant execute on function admin_ai_list() to authenticated;

drop function if exists admin_set_billing(uuid, int, boolean, text);
create or replace function admin_set_billing(aid uuid, lim int, en boolean, pl text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  insert into academy_billing (academy_id, monthly_limit_krw, ai_enabled, plan, updated_at) values (aid, lim, coalesce(en, true), coalesce(pl, 'free'), now())
  on conflict (academy_id) do update set monthly_limit_krw = excluded.monthly_limit_krw, ai_enabled = excluded.ai_enabled, plan = excluded.plan, updated_at = now();
end $$;
grant execute on function admin_set_billing(uuid, int, boolean, text) to authenticated;

-- 지금 있는 학원(=내 학원)은 무제한으로 시작. 이후 새로 생기는 학원은 기본 월 5,000원.
insert into academy_billing (academy_id, monthly_limit_krw, plan)
select id, null, 'owner' from academies on conflict (academy_id) do nothing;
