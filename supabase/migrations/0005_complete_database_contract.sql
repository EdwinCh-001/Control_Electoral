begin;

-- Keep profile access limited to fields used by the mobile application.
revoke select on public.profiles from authenticated;
revoke select (national_id, phone, created_by, created_at)
  on public.profiles from authenticated;
grant select (
  id,
  role,
  province_id,
  full_name,
  email,
  must_change_password
) on public.profiles to authenticated;

create index if not exists profiles_province_role_idx
  on public.profiles (province_id, role, full_name);

create index if not exists acta_candidate_votes_candidate_acta_idx
  on public.acta_candidate_votes (candidate_id, acta_id);

-- The reference is the earliest device capture, not the first acta uploaded.
create or replace function public.register_precinct_location_reference(
  p_acta_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precinct_id uuid;
  v_latitude double precision;
  v_longitude double precision;
  v_captured_at_device timestamptz;
  v_reference public.precinct_location_references%rowtype;
begin
  select s.precinct_id, a.latitude, a.longitude, a.captured_at_device
    into v_precinct_id, v_latitude, v_longitude, v_captured_at_device
    from public.actas a
    join public.polling_stations s on s.id = a.polling_station_id
   where a.id = p_acta_id;

  if not found or not public.can_edit_acta(p_acta_id) then
    raise exception 'Acta is unavailable for this user';
  end if;

  insert into public.precinct_location_references (
    precinct_id,
    source_acta_id,
    latitude,
    longitude,
    captured_at_device
  )
  values (
    v_precinct_id,
    p_acta_id,
    v_latitude,
    v_longitude,
    v_captured_at_device
  )
  on conflict (precinct_id) do nothing;

  select reference.*
    into v_reference
    from public.precinct_location_references reference
   where reference.precinct_id = v_precinct_id
   for update;

  if not found then
    raise exception 'Could not load the precinct location reference';
  end if;

  if v_reference.source_acta_id = p_acta_id then
    return;
  end if;

  if v_captured_at_device < v_reference.captured_at_device then
    update public.precinct_location_references
       set source_acta_id = p_acta_id,
           latitude = v_latitude,
           longitude = v_longitude,
           captured_at_device = v_captured_at_device,
           registered_at_server = clock_timestamp()
     where precinct_id = v_precinct_id;
  elsif v_captured_at_device = v_reference.captured_at_device then
    raise exception 'Two actas have the same device capture time; GPS reference needs review';
  end if;
end;
$$;

-- Enable the rows needed by the live tally. Realtime still applies table RLS.
do $$
begin
  if not exists (
    select 1
      from pg_publication
     where pubname = 'supabase_realtime'
  ) then
    raise exception 'Supabase Realtime publication is missing';
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'actas'
  ) then
    execute 'alter publication supabase_realtime add table public.actas';
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'acta_candidate_votes'
  ) then
    execute 'alter publication supabase_realtime add table public.acta_candidate_votes';
  end if;
end;
$$;

commit;
