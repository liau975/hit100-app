-- hit100 추가 기능: 학교 인증
-- 고등학교·중학교: 학생이 학교를 고르면 선생님이 승인
-- 대학교: 학교 메일(@ac.kr 등)로 인증번호를 받아 확인 (school 함수가 처리)
-- 기존 데이터는 건드리지 않아요. 여러 번 실행해도 괜찮아요.

alter table members add column if not exists school_kind text;          -- 'high' | 'middle' | 'univ'
alter table members add column if not exists school_name text;
alter table members add column if not exists school_code text;          -- 나이스 학교 코드 또는 대학 메일 도메인
alter table members add column if not exists school_status text;        -- null | 'pending' | 'verified' | 'rejected'
alter table members add column if not exists school_email text;         -- 대학 인증에 쓴 메일 (선생님·본인만 보임)
alter table members add column if not exists school_verified_at timestamptz;

-- 학생(또는 선생님)이 자기 학교를 고른다 → 승인 대기
create or replace function set_my_school(p_academy uuid, p_kind text, p_name text, p_code text) returns members
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  if p_kind not in ('high', 'middle', 'univ') then raise exception '학교 종류가 올바르지 않아요'; end if;
  if char_length(coalesce(p_name, '')) < 2 then raise exception '학교 이름을 입력하세요'; end if;
  update members set school_kind = p_kind, school_name = left(p_name, 60), school_code = left(coalesce(p_code, ''), 60),
    school_status = 'pending', school_email = null, school_verified_at = null
  where user_id = auth.uid() and academy_id = p_academy returning * into m;
  if m.user_id is null then raise exception '학원 멤버가 아니에요'; end if;
  return m;
end $$;

-- 학교 정보 지우기
create or replace function clear_my_school(p_academy uuid) returns void
language sql security definer set search_path = public as $$
  update members set school_kind = null, school_name = null, school_code = null, school_status = null, school_email = null, school_verified_at = null
  where user_id = auth.uid() and academy_id = p_academy;
$$;

-- 선생님이 승인/거절
create or replace function approve_school(p_academy uuid, p_user uuid, p_ok boolean) returns members
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  if not is_staff(p_academy) then raise exception '선생님만 승인할 수 있어요'; end if;
  update members set school_status = case when p_ok then 'verified' else 'rejected' end,
    school_verified_at = case when p_ok then now() else null end
  where user_id = p_user and academy_id = p_academy and school_name is not null returning * into m;
  return m;
end $$;

-- 대학 메일 인증번호 (school 함수만 서버 키로 읽고 씀. 앱에서는 접근 불가)
create table if not exists email_otps (
  user_id uuid not null references auth.users on delete cascade,
  academy_id uuid not null references academies on delete cascade,
  email text not null,
  code_hash text not null,
  school_name text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  primary key (user_id, academy_id)
);
alter table email_otps enable row level security;
revoke all on email_otps from anon, authenticated;

-- 랭킹에 인증된 학교 이름도 같이 준다 (기존 함수 교체)
drop function if exists study_ranking(uuid, date, date);
create or replace function study_ranking(p_academy uuid, p_from date, p_to date)
returns table(student_id uuid, name text, seconds bigint, is_me boolean, school text)
language plpgsql stable security definer set search_path = public as $$
declare mode text; me uuid; staff boolean;
begin
  if not is_member(p_academy) then raise exception '학원 멤버만 볼 수 있어요'; end if;
  select coalesce(settings->>'rank', 'mask') into mode from academies where id = p_academy;
  me := my_student(p_academy);
  staff := is_staff(p_academy);
  if mode = 'off' and not staff then return; end if;
  return query
    select s.id,
      case when staff or mode = 'full' or s.id = me then s.name
           when char_length(s.name) <= 1 then s.name
           when char_length(s.name) = 2 then left(s.name, 1) || '*'
           else left(s.name, 1) || repeat('*', char_length(s.name) - 2) || right(s.name, 1) end,
      sum(l.seconds)::bigint,
      coalesce(s.id = me, false),
      (select m.school_name from members m where m.academy_id = p_academy and m.student_id = s.id and m.school_status = 'verified' limit 1)
    from logs l join students s on s.id = l.student_id
    where l.academy_id = p_academy and l.date between p_from and p_to
    group by s.id, s.name
    order by 3 desc
    limit 100;
end $$;

grant execute on function set_my_school(uuid, text, text, text), clear_my_school(uuid), approve_school(uuid, uuid, boolean), study_ranking(uuid, date, date) to authenticated;

-- 게시판: 이름이 보이는 글에는 인증된 학교도 같이 보여준다 (익명 글은 숨김)
drop view if exists comments_v;
drop view if exists posts_v;
create view posts_v as
select p.id, p.academy_id, p.category, p.title, p.body, p.created_at, p.anon,
  case when p.anon and not is_staff(p.academy_id) and p.author_id <> auth.uid() then null else p.author_name end as author_name,
  (p.author_id = auth.uid()) as mine,
  (select count(*) from post_likes x where x.post_id = p.id)::int as likes,
  exists (select 1 from post_likes x where x.post_id = p.id and x.user_id = auth.uid()) as liked,
  (select count(*) from comments c where c.post_id = p.id)::int as ncomments,
  case when p.anon and not is_staff(p.academy_id) and p.author_id <> auth.uid() then null
       else (select m.school_name from members m where m.user_id = p.author_id and m.academy_id = p.academy_id and m.school_status = 'verified' limit 1) end as author_school
from posts p
where is_member(p.academy_id);

create view comments_v as
select c.id, c.post_id, c.academy_id, c.body, c.created_at, c.anon,
  case when c.anon and not is_staff(c.academy_id) and c.author_id <> auth.uid() then null else c.author_name end as author_name,
  (c.author_id = auth.uid()) as mine,
  (c.author_id = p.author_id) as is_op,
  case when c.anon and not is_staff(c.academy_id) and c.author_id <> auth.uid() then null
       else (select m.school_name from members m where m.user_id = c.author_id and m.academy_id = c.academy_id and m.school_status = 'verified' limit 1) end as author_school
from comments c join posts p on p.id = c.post_id
where is_member(c.academy_id);
grant select on posts_v, comments_v to authenticated;
