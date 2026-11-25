-- hit100 추가 기능: 공부 랭킹 + 학원 게시판
-- 기존 데이터는 건드리지 않아요. 여러 번 실행해도 괜찮아요.

-- 학원 설정(권한표·랭킹·게시판 on/off)을 담는 칸
alter table academies add column if not exists settings jsonb not null default '{}';

-- ============ 공부 랭킹 ============
-- 학원 설정 settings.rank: 'mask'(기본, 이름 가운데 가림) / 'full'(실명) / 'off'(학생에게 숨김)
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
create or replace view posts_v as
select p.id, p.academy_id, p.category, p.title, p.body, p.created_at, p.anon,
  case when p.anon and not is_staff(p.academy_id) and p.author_id <> auth.uid() then null else p.author_name end as author_name,
  (p.author_id = auth.uid()) as mine,
  (select count(*) from post_likes x where x.post_id = p.id)::int as likes,
  exists (select 1 from post_likes x where x.post_id = p.id and x.user_id = auth.uid()) as liked,
  (select count(*) from comments c where c.post_id = p.id)::int as ncomments
from posts p
where is_member(p.academy_id);

create or replace view comments_v as
select c.id, c.post_id, c.academy_id, c.body, c.created_at, c.anon,
  case when c.anon and not is_staff(c.academy_id) and c.author_id <> auth.uid() then null else c.author_name end as author_name,
  (c.author_id = auth.uid()) as mine,
  (c.author_id = p.author_id) as is_op
from comments c join posts p on p.id = c.post_id
where is_member(c.academy_id);

grant select, insert, update, delete on posts, comments, post_likes to authenticated;
grant select on posts_v, comments_v to authenticated;
