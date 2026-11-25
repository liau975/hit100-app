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
