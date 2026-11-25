-- hit100 · Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요. (처음 한 번)

create extension if not exists pgcrypto;

create table if not exists academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
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
