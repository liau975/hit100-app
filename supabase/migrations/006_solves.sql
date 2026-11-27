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
