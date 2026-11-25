begin;

do $$
declare
  v_user_id uuid;
  v_email text;
  v_province_id uuid;
begin
  select id, email
    into v_user_id, v_email
    from auth.users
   where lower(email) = lower('ipdemon001@gmail.com');

  if not found then
    raise exception 'Create and confirm ipdemon001@gmail.com in Supabase Auth first';
  end if;

  select id
    into v_province_id
    from public.provinces
   where name = 'PICHINCHA';

  if not found then
    raise exception 'PICHINCHA is missing; run the territorial test seed first';
  end if;

  if exists (
    select 1
      from public.profiles
     where id = v_user_id
  ) then
    raise exception 'This Auth user already has a profile';
  end if;

  insert into public.profiles (
    id,
    role,
    province_id,
    national_id,
    full_name,
    phone,
    email,
    must_change_password
  )
  values (
    v_user_id,
    'provincial_coordinator',
    v_province_id,
    'TEST-COORD-PROV-001',
    'Coordinador Provincial de Prueba',
    '0000000000',
    v_email,
    true
  );
end;
$$;

commit;
