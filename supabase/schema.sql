-- hit100 · Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요. (처음 한 번)

create extension if not exists pgcrypto;

create table if not exists academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  settings jsonb not null default '{}',
  created_at timestamptz default now()
);

-- 한 계정이 여러 학원에 소속될 수 있음. role: owner(관리자) / teacher, title: 원장·부원장·실장·선생님 등 직책
create table if not exists members (
  user_id uuid not null references auth.users on delete cascade,
  academy_id uuid not null references academies on delete cascade,
  name text not null,
  title text default '선생님',
  email text,
  role text not null default 'teacher' check (role in ('owner','teacher','student')),
  student_id uuid,
  created_at timestamptz default now(),
  primary key (user_id, academy_id)
);

create table if not exists admins (
  user_id uuid primary key references auth.users on delete cascade
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies on delete cascade,
  name text not null,
  school text default '',
  grade int default 2,
  subject text default 'hj',
  tracks jsonb default '{}',
  teacher_ids jsonb default '[]',
  created_by uuid,
  link_code text unique,
  memo text default '',
  created_at timestamptz default now()
);

-- academy_id 가 null 이면 모든 학원이 쓰는 "공용 시험"
create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references academies on delete cascade,
  title text not null,
  year int, grade int, month int, kind text,
  key jsonb default '{}',
  cuts jsonb default '{}',
  areas jsonb default '{}',
  ext_rates jsonb default '{}',
  source text default '',
  spec jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies on delete cascade,
  student_id uuid not null references students on delete cascade,
  exam_id uuid not null references exams on delete cascade,
  status text not null default 'planned' check (status in ('planned','done')),
  planned_date date,
  taken_date date,
  subject text,
  mode text default 'answers',
  answers jsonb default '[]',
  wrong jsonb default '[]',
  attitude text default '',
  picks jsonb default '[]',
  notes jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- 문제은행: 단일 문제 또는 지문 세트 (이미지는 압축된 data URL로 저장)
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies on delete cascade,
  subject text not null default 'kor',
  subname text default '',
  type text default '',
  level text default '',
  source text default '',
  kind text default 'single' check (kind in ('single','set')),
  passage_img text default '',
  passage_text text default '',
  questions jsonb default '[]',
  created_at timestamptz default now()
);

-- 시험지
create table if not exists worksheets (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies on delete cascade,
  title text not null,
  date date,
  student_ids jsonb default '[]',
  items jsonb default '[]',
  cols int default 2,
  with_answers boolean default true,
  memo text default '',
  created_at timestamptz default now()
);
-- 학생 공부 기록 (타이머 · 직접 입력)
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies on delete cascade,
  student_id uuid not null references students on delete cascade,
  date date not null,
  subject text default 'etc',
  seconds int not null default 0,
  started_at timestamptz,
  ended_at timestamptz
);
-- 할 일 (학생 본인 또는 선생님이 내준 과제)
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies on delete cascade,
  student_id uuid not null references students on delete cascade,
  date date not null,
  subject text default 'etc',
  text text not null,
  done boolean default false,
  by_teacher boolean default false,
  created_at timestamptz default now()
);
create index if not exists logs_student on logs(student_id, date);
create index if not exists todos_student on todos(student_id, date);
create index if not exists items_academy on items(academy_id);
create index if not exists worksheets_academy on worksheets(academy_id);

create index if not exists members_academy on members(academy_id);
create index if not exists students_academy on students(academy_id);
create index if not exists attempts_academy on attempts(academy_id);
create index if not exists attempts_student on attempts(student_id);
create index if not exists exams_academy on exams(academy_id);

-- 도우미 함수
create or replace function is_member(aid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from members where user_id = auth.uid() and academy_id = aid) $$;

create or replace function is_owner(aid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from members where user_id = auth.uid() and academy_id = aid and role = 'owner') $$;

create or replace function is_staff(aid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from members where user_id = auth.uid() and academy_id = aid and role in ('owner','teacher')) $$;

create or replace function my_student(aid uuid) returns uuid
language sql stable security definer set search_path = public as
$$ select student_id from members where user_id = auth.uid() and academy_id = aid and role = 'student' limit 1 $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from admins where user_id = auth.uid()) $$;

create or replace function touch_updated() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists attempts_touch on attempts;
create trigger attempts_touch before update on attempts for each row execute function touch_updated();

-- 학원 만들기 / 참여
create or replace function create_academy(p_name text, p_member text, p_title text default '선생님') returns academies
language plpgsql security definer set search_path = public as $$
declare a academies;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  insert into academies(name, invite_code) values (p_name, upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))) returning * into a;
  insert into members(user_id, academy_id, name, title, email, role)
    values (auth.uid(), a.id, p_member, coalesce(p_title, '선생님'), (select email from auth.users where id = auth.uid()), 'owner');
  return a;
end $$;

create or replace function join_academy(p_code text, p_member text, p_title text default '선생님') returns academies
language plpgsql security definer set search_path = public as $$
declare a academies;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  select * into a from academies where invite_code = upper(trim(p_code));
  if a.id is null then raise exception '초대 코드를 찾을 수 없어요'; end if;
  if exists(select 1 from members where user_id = auth.uid() and academy_id = a.id) then raise exception '이미 이 학원에 소속돼 있어요'; end if;
  insert into members(user_id, academy_id, name, title, email, role)
    values (auth.uid(), a.id, p_member, coalesce(p_title, '선생님'), (select email from auth.users where id = auth.uid()), 'teacher');
  return a;
end $$;

-- 학생 계정 연결: 선생님이 만든 학생 코드로 참여
create or replace function join_as_student(p_code text, p_member text) returns academies
language plpgsql security definer set search_path = public as $$
declare st students; a academies;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  select * into st from students where link_code = upper(trim(p_code));
  if st.id is null then raise exception '학생 코드를 찾을 수 없어요'; end if;
  if exists(select 1 from members where user_id = auth.uid() and academy_id = st.academy_id) then raise exception '이미 이 학원에 소속돼 있어요'; end if;
  insert into members(user_id, academy_id, name, title, email, role, student_id)
    values (auth.uid(), st.academy_id, p_member, '학생', (select email from auth.users where id = auth.uid()), 'student', st.id);
  select * into a from academies where id = st.academy_id;
  return a;
end $$;

-- 내 이름 바꾸기
create or replace function update_my_name(p_academy uuid, p_name text) returns members
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  update members set name = p_name where user_id = auth.uid() and academy_id = p_academy returning * into m;
  return m;
end $$;

-- 관리자: 직책·권한 바꾸기 (관리자가 최소 한 명은 남아야 함)
create or replace function set_member(p_academy uuid, p_user uuid, p_role text default null, p_title text default null) returns members
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  if not is_owner(p_academy) then raise exception '관리자만 바꿀 수 있어요'; end if;
  if p_role = 'teacher' and (select role from members where user_id = p_user and academy_id = p_academy) = 'owner'
     and (select count(*) from members where academy_id = p_academy and role = 'owner') <= 1 then
    raise exception '관리자가 최소 한 명은 있어야 해요. 다른 분을 먼저 관리자로 지정하세요';
  end if;
  update members set role = coalesce(p_role, role), title = coalesce(p_title, title)
    where user_id = p_user and academy_id = p_academy returning * into m;
  return m;
end $$;

-- 내보내기 / 학원에서 나가기
create or replace function remove_member(p_academy uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user <> auth.uid() and not is_owner(p_academy) then raise exception '관리자만 내보낼 수 있어요'; end if;
  if (select role from members where user_id = p_user and academy_id = p_academy) = 'owner'
     and (select count(*) from members where academy_id = p_academy) > 1
     and (select count(*) from members where academy_id = p_academy and role = 'owner') <= 1 then
    raise exception '마지막 관리자는 나갈 수 없어요. 다른 분을 먼저 관리자로 지정하세요';
  end if;
  delete from members where user_id = p_user and academy_id = p_academy;
end $$;

-- 아이디 찾기: 초대 코드 + 이름이 맞으면 가린 이메일을 돌려줌 (로그인 전에도 호출 가능)
create or replace function find_email(p_code text, p_name text) returns setof text
language sql stable security definer set search_path = public as $$
  select case when length(split_part(m.email, '@', 1)) <= 2 then left(m.email, 1) || '*'
              else left(m.email, 2) || repeat('*', least(6, length(split_part(m.email, '@', 1)) - 2)) end
         || '@' || split_part(m.email, '@', 2)
  from members m join academies a on a.id = m.academy_id
  where a.invite_code = upper(trim(p_code)) and m.name = trim(p_name) and m.email is not null
$$;
grant execute on function find_email(text, text) to anon, authenticated;

grant execute on function create_academy(text, text, text), join_academy(text, text, text), update_my_name(uuid, text),
  set_member(uuid, uuid, text, text), remove_member(uuid, uuid), is_member(uuid), is_owner(uuid), is_admin(), is_staff(uuid), my_student(uuid), join_as_student(text, text) to authenticated;

-- 보안 규칙 (내가 소속된 학원 데이터만 보이게)
alter table academies enable row level security;
alter table members enable row level security;
alter table admins enable row level security;
alter table students enable row level security;
alter table exams enable row level security;
alter table attempts enable row level security;
alter table items enable row level security;
alter table worksheets enable row level security;
alter table logs enable row level security;
alter table todos enable row level security;

drop policy if exists academies_sel on academies;
create policy academies_sel on academies for select using (is_member(id));
drop policy if exists academies_upd on academies;
create policy academies_upd on academies for update using (is_owner(id)) with check (is_owner(id));

drop policy if exists members_sel on members;
create policy members_sel on members for select using (is_staff(academy_id) or user_id = auth.uid() or (is_member(academy_id) and role <> 'student'));

drop policy if exists admins_sel on admins;
create policy admins_sel on admins for select using (user_id = auth.uid());

-- 학생 계정은 자기 정보만, 선생님·직원은 학원 전체
drop policy if exists students_all on students;
drop policy if exists students_sel on students;
create policy students_sel on students for select using (is_staff(academy_id) or id = my_student(academy_id));
drop policy if exists students_mod on students;
create policy students_mod on students for all using (is_staff(academy_id)) with check (is_staff(academy_id));

drop policy if exists attempts_all on attempts;
drop policy if exists attempts_sel on attempts;
create policy attempts_sel on attempts for select using (is_staff(academy_id) or student_id = my_student(academy_id));
drop policy if exists attempts_mod on attempts;
create policy attempts_mod on attempts for all using (is_staff(academy_id)) with check (is_staff(academy_id));

drop policy if exists logs_all on logs;
create policy logs_all on logs for all using (is_staff(academy_id) or student_id = my_student(academy_id)) with check (is_staff(academy_id) or student_id = my_student(academy_id));
drop policy if exists todos_all on todos;
create policy todos_all on todos for all using (is_staff(academy_id) or student_id = my_student(academy_id)) with check (is_staff(academy_id) or student_id = my_student(academy_id));

drop policy if exists items_all on items;
create policy items_all on items for all using (is_staff(academy_id)) with check (is_staff(academy_id));
drop policy if exists items_sel on items;
create policy items_sel on items for select using (is_member(academy_id));

drop policy if exists worksheets_all on worksheets;
create policy worksheets_all on worksheets for all using (is_staff(academy_id)) with check (is_staff(academy_id));
drop policy if exists worksheets_sel on worksheets;
create policy worksheets_sel on worksheets for select using (student_ids ? (my_student(academy_id)::text));

drop policy if exists exams_sel on exams;
create policy exams_sel on exams for select using (academy_id is null or is_member(academy_id));
drop policy if exists exams_ins on exams;
create policy exams_ins on exams for insert with check (is_staff(academy_id) or (academy_id is null and is_admin()));
drop policy if exists exams_upd on exams;
create policy exams_upd on exams for update using (is_staff(academy_id) or (academy_id is null and is_admin())) with check (is_staff(academy_id) or (academy_id is null and is_admin()));
drop policy if exists exams_del on exams;
create policy exams_del on exams for delete using (is_staff(academy_id) or (academy_id is null and is_admin()));

-- 서비스 관리자 지정 (공용 시험 등록 권한). 내 이메일로 바꿔서 한 번 실행:
-- insert into admins select id from auth.users where email = '내이메일@example.com';

-- 앱(로그인한 사용자)이 테이블에 접근할 수 있게 권한 부여 (보안 규칙 RLS가 실제 범위를 제한함)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;


-- ===== 002: 공부 랭킹 · 게시판 (migrations/002_rank_board.sql 과 같음) =====
-- hit100 추가 기능: 공부 랭킹 + 학원 게시판
-- 기존 데이터는 건드리지 않아요. 여러 번 실행해도 괜찮아요.

-- 학원 설정(권한표·랭킹·게시판 on/off)을 담는 칸
alter table academies add column if not exists settings jsonb not null default '{}';

-- ============ 공부 랭킹 ============
-- 학원 설정 settings.rank: 'mask'(기본, 이름 가운데 가림) / 'full'(실명) / 'off'(학생에게 숨김)
drop function if exists study_ranking(uuid, date, date);
create or replace function study_ranking(p_academy uuid, p_from date, p_to date)
returns table(student_id uuid, name text, seconds bigint, is_me boolean)
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
      coalesce(s.id = me, false)
    from logs l join students s on s.id = l.student_id
    where l.academy_id = p_academy and l.date between p_from and p_to
    group by s.id, s.name
    order by 3 desc
    limit 100;
end $$;
grant execute on function study_ranking(uuid, date, date) to authenticated;

-- ============ 게시판 ============
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies on delete cascade,
  author_id uuid not null default auth.uid() references auth.users on delete cascade,
  author_name text not null default '',
  anon boolean not null default true,
  category text not null default '자유',
  title text not null check (char_length(title) between 1 and 100),
  body text not null default '' check (char_length(body) <= 5000),
  created_at timestamptz default now()
);
create index if not exists posts_acad_idx on posts (academy_id, created_at desc);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts on delete cascade,
  academy_id uuid not null references academies on delete cascade,
  author_id uuid not null default auth.uid() references auth.users on delete cascade,
  author_name text not null default '',
  anon boolean not null default true,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz default now()
);
create index if not exists comments_post_idx on comments (post_id, created_at);

create table if not exists post_likes (
  post_id uuid not null references posts on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (post_id, user_id)
);

-- 작성자 이름은 서버가 채운다 (다른 사람 이름으로 쓰기 방지)
create or replace function board_fill_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_id := auth.uid();
  new.author_name := coalesce((select name from members where user_id = auth.uid() and academy_id = new.academy_id limit 1), '');
  if tg_table_name = 'comments' then
    new.academy_id := (select academy_id from posts where id = new.post_id);
  end if;
  return new;
end $$;
drop trigger if exists posts_fill on posts;
create trigger posts_fill before insert on posts for each row execute function board_fill_author();
drop trigger if exists comments_fill on comments;
create trigger comments_fill before insert on comments for each row execute function board_fill_author();

create or replace function post_academy(pid uuid) returns uuid
language sql stable security definer set search_path = public as
$$ select academy_id from posts where id = pid $$;

alter table posts enable row level security;
alter table comments enable row level security;
alter table post_likes enable row level security;

-- 원본 테이블은 선생님·본인만 직접 읽음 (학생은 아래 view로 익명 처리된 내용을 읽음)
drop policy if exists posts_sel on posts;
create policy posts_sel on posts for select using (is_staff(academy_id) or author_id = auth.uid());
drop policy if exists posts_ins on posts;
create policy posts_ins on posts for insert with check (is_member(academy_id) and coalesce((select settings->>'board' from academies where id = academy_id), 'on') <> 'off');
drop policy if exists posts_upd on posts;
create policy posts_upd on posts for update using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists posts_del on posts;
create policy posts_del on posts for delete using (author_id = auth.uid() or is_staff(academy_id));

drop policy if exists comments_sel on comments;
create policy comments_sel on comments for select using (is_staff(academy_id) or author_id = auth.uid());
drop policy if exists comments_ins on comments;
create policy comments_ins on comments for insert with check (is_member(post_academy(post_id)));
drop policy if exists comments_del on comments;
create policy comments_del on comments for delete using (author_id = auth.uid() or is_staff(academy_id));

drop policy if exists likes_sel on post_likes;
create policy likes_sel on post_likes for select using (user_id = auth.uid());
drop policy if exists likes_ins on post_likes;
create policy likes_ins on post_likes for insert with check (user_id = auth.uid() and is_member(post_academy(post_id)));
drop policy if exists likes_del on post_likes;
create policy likes_del on post_likes for delete using (user_id = auth.uid());

-- 익명 처리된 읽기용 view: 익명 글은 학생끼리 이름이 안 보이고, 선생님은 볼 수 있음
drop view if exists comments_v;
drop view if exists posts_v;
create view posts_v as
select p.id, p.academy_id, p.category, p.title, p.body, p.created_at, p.anon,
  case when p.anon and not is_staff(p.academy_id) and p.author_id <> auth.uid() then null else p.author_name end as author_name,
  (p.author_id = auth.uid()) as mine,
  (select count(*) from post_likes x where x.post_id = p.id)::int as likes,
  exists (select 1 from post_likes x where x.post_id = p.id and x.user_id = auth.uid()) as liked,
  (select count(*) from comments c where c.post_id = p.id)::int as ncomments
from posts p
where is_member(p.academy_id);

create view comments_v as
select c.id, c.post_id, c.academy_id, c.body, c.created_at, c.anon,
  case when c.anon and not is_staff(c.academy_id) and c.author_id <> auth.uid() then null else c.author_name end as author_name,
  (c.author_id = auth.uid()) as mine,
  (c.author_id = p.author_id) as is_op
from comments c join posts p on p.id = c.post_id
where is_member(c.academy_id);

grant select, insert, update, delete on posts, comments, post_likes to authenticated;
grant select on posts_v, comments_v to authenticated;


-- ===== 003: 학교 인증 (migrations/003_school_verify.sql 과 같음) =====
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


-- ===== 004 =====
-- 학교 인증: 선생님도 쓸 수 있게. 자기 자신은 승인할 수 없음 (관리자는 예외)
create or replace function approve_school(p_academy uuid, p_user uuid, p_ok boolean) returns members
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  if not is_staff(p_academy) then raise exception '선생님만 승인할 수 있어요'; end if;
  if p_user = auth.uid() and not is_owner(p_academy) then raise exception '자기 학교 인증은 다른 선생님이나 관리자가 승인해야 해요'; end if;
  update members set school_status = case when p_ok then 'verified' else 'rejected' end,
    school_verified_at = case when p_ok then now() else null end
  where user_id = p_user and academy_id = p_academy and school_name is not null returning * into m;
  return m;
end $$;
-- 학교 메일 주소는 저장하지 않음 (도메인만 school_code에 남김)
update members set school_email = null where school_email is not null;


-- ===== 005 =====
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

-- 사진 문제 풀이 기록 (콴다식). 본인 기록은 본인이, 학원 선생님은 학원 전체를 볼 수 있다.
create table if not exists solves (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references academies on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject text,
  result jsonb not null,
  created_at timestamptz default now()
);
create index if not exists solves_user_idx on solves (user_id, created_at desc);
create index if not exists solves_acad_idx on solves (academy_id, created_at desc);
alter table solves enable row level security;
drop policy if exists sv_sel on solves;
create policy sv_sel on solves for select using (user_id = auth.uid() or is_staff(academy_id));
drop policy if exists sv_ins on solves;
create policy sv_ins on solves for insert with check (user_id = auth.uid() and is_member(academy_id));
drop policy if exists sv_del on solves;
create policy sv_del on solves for delete using (user_id = auth.uid());
grant select, insert, delete on solves to authenticated;
