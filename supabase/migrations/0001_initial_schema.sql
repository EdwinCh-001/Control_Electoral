-- Initial schema for the electoral reporting app.
-- Run once in a new Supabase project after creating the private acta-photos bucket.
begin;

create type public.app_role as enum (
  'provincial_coordinator',
  'precinct_coordinator',
  'observer'
);

create type public.electoral_office as enum ('mayor', 'prefect');

create type public.acta_status as enum (
  'draft',
  'pending',
  'processing_ocr',
  'ready',
  'sending',
  'sent',
  'failed'
);

create table public.provinces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.cantons (
  id uuid primary key default gen_random_uuid(),
  province_id uuid not null references public.provinces(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (province_id, name)
);

create table public.precincts (
  id uuid primary key default gen_random_uuid(),
  canton_id uuid not null references public.cantons(id) on delete restrict,
  parish text not null check (length(trim(parish)) > 0),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (canton_id, parish, name)
);

create table public.polling_stations (
  id uuid primary key default gen_random_uuid(),
  precinct_id uuid not null references public.precincts(id) on delete restrict,
  station_number integer not null check (station_number > 0),
  created_at timestamptz not null default now(),
  unique (precinct_id, station_number)
);

create table public.political_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.political_organizations(id) on delete restrict,
  office public.electoral_office not null,
  full_name text not null check (length(trim(full_name)) > 0),
  created_at timestamptz not null default now(),
  unique (organization_id, office)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  province_id uuid not null references public.provinces(id) on delete restrict,
  national_id text not null unique,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text not null,
  email text not null,
  created_by uuid references public.profiles(id) on delete set null,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  check (length(trim(national_id)) > 0),
  check (length(trim(phone)) > 0),
  check (length(trim(email)) > 0)
);

create unique index profiles_email_lower_unique
  on public.profiles (lower(email));

create table public.precinct_coordinators (
  precinct_id uuid primary key references public.precincts(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now()
);

create table public.observer_assignments (
  id uuid primary key default gen_random_uuid(),
  polling_station_id uuid not null references public.polling_stations(id) on delete restrict,
  observer_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= assigned_at)
);

create unique index one_active_observer_per_station
  on public.observer_assignments (polling_station_id)
  where revoked_at is null;

create index observer_assignments_observer_active_idx
  on public.observer_assignments (observer_id, polling_station_id)
  where revoked_at is null;

create table public.actas (
  id uuid primary key default gen_random_uuid(),
  polling_station_id uuid not null references public.polling_stations(id) on delete restrict,
  office public.electoral_office not null,
  author_id uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  photo_path text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  captured_at_device timestamptz not null,
  device_modified_at timestamptz not null,
  server_received_at timestamptz not null default clock_timestamp(),
  status public.acta_status not null default 'pending',
  failure_stage text check (failure_stage in ('ocr', 'submission')),
  total_voters integer check (total_voters is null or total_voters >= 0),
  blank_votes integer check (blank_votes is null or blank_votes >= 0),
  null_votes integer check (null_votes is null or null_votes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (split_part(photo_path, '/', 1) = id::text),
  check ((status = 'failed') = (failure_stage is not null)),
  unique (polling_station_id, office)
);

create index actas_station_status_idx
  on public.actas (polling_station_id, status);

create table public.acta_candidate_votes (
  acta_id uuid not null references public.actas(id) on delete restrict,
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  votes integer check (votes is null or votes >= 0),
  primary key (acta_id, candidate_id)
);

create table public.acta_audit_log (
  id bigint generated always as identity primary key,
  acta_id uuid not null references public.actas(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_name text not null check (entity_name in ('actas', 'acta_candidate_votes')),
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  device_modified_at timestamptz,
  server_received_at timestamptz not null default clock_timestamp(),
  old_record jsonb,
  new_record jsonb
);

create index acta_audit_log_acta_received_idx
  on public.acta_audit_log (acta_id, server_received_at desc);

create table public.precinct_location_references (
  precinct_id uuid primary key references public.precincts(id) on delete restrict,
  source_acta_id uuid not null unique references public.actas(id) on delete restrict,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  captured_at_device timestamptz not null,
  registered_at_server timestamptz not null default clock_timestamp()
);

create or replace function public.is_profile_role(
  p_user_id uuid,
  p_role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = p_role
  );
$$;

create or replace function public.is_profile_in_province(
  p_user_id uuid,
  p_province_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.province_id = p_province_id
  );
$$;

create or replace function public.is_active_observer_assigned(
  p_user_id uuid,
  p_station_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.observer_assignments a
    where a.observer_id = p_user_id
      and a.polling_station_id = p_station_id
      and a.revoked_at is null
  );
$$;

create or replace function public.can_access_province(p_province_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role = 'provincial_coordinator'
        and me.province_id = p_province_id
    )
    or exists (
      select 1
      from public.precinct_coordinators pc
      join public.precincts pr on pr.id = pc.precinct_id
      join public.cantons c on c.id = pr.canton_id
      where pc.user_id = auth.uid()
        and c.province_id = p_province_id
    )
    or exists (
      select 1
      from public.observer_assignments a
      join public.polling_stations s on s.id = a.polling_station_id
      join public.precincts pr on pr.id = s.precinct_id
      join public.cantons c on c.id = pr.canton_id
      where a.observer_id = auth.uid()
        and a.revoked_at is null
        and c.province_id = p_province_id
    );
$$;

create or replace function public.can_access_canton(p_canton_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cantons c
    join public.profiles me on me.id = auth.uid()
    where c.id = p_canton_id
      and me.role = 'provincial_coordinator'
      and me.province_id = c.province_id
  )
  or exists (
    select 1
    from public.precinct_coordinators pc
    join public.precincts pr on pr.id = pc.precinct_id
    where pc.user_id = auth.uid()
      and pr.canton_id = p_canton_id
  )
  or exists (
    select 1
    from public.observer_assignments a
    join public.polling_stations s on s.id = a.polling_station_id
    join public.precincts pr on pr.id = s.precinct_id
    where a.observer_id = auth.uid()
      and a.revoked_at is null
      and pr.canton_id = p_canton_id
  );
$$;

create or replace function public.can_access_precinct(p_precinct_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.precincts pr
    join public.cantons c on c.id = pr.canton_id
    join public.profiles me on me.id = auth.uid()
    where pr.id = p_precinct_id
      and me.role = 'provincial_coordinator'
      and me.province_id = c.province_id
  )
  or exists (
    select 1
    from public.precinct_coordinators pc
    where pc.precinct_id = p_precinct_id
      and pc.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.observer_assignments a
    join public.polling_stations s on s.id = a.polling_station_id
    where s.precinct_id = p_precinct_id
      and a.observer_id = auth.uid()
      and a.revoked_at is null
  );
$$;

create or replace function public.can_access_station(p_station_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.polling_stations s
    join public.precincts pr on pr.id = s.precinct_id
    join public.cantons c on c.id = pr.canton_id
    join public.profiles me on me.id = auth.uid()
    where s.id = p_station_id
      and me.role = 'provincial_coordinator'
      and me.province_id = c.province_id
  )
  or exists (
    select 1
    from public.polling_stations s
    join public.precinct_coordinators pc on pc.precinct_id = s.precinct_id
    where s.id = p_station_id
      and pc.user_id = auth.uid()
  )
  or public.is_active_observer_assigned(auth.uid(), p_station_id);
$$;

create or replace function public.can_manage_canton(p_canton_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cantons c
    join public.profiles me on me.id = auth.uid()
    where c.id = p_canton_id
      and me.role = 'provincial_coordinator'
      and me.province_id = c.province_id
  );
$$;

create or replace function public.can_manage_station(p_station_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.polling_stations s
    join public.precinct_coordinators pc on pc.precinct_id = s.precinct_id
    where s.id = p_station_id
      and pc.user_id = auth.uid()
  );
$$;

create or replace function public.can_assign_observer(
  p_station_id uuid,
  p_observer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.polling_stations s
    join public.precincts pr on pr.id = s.precinct_id
    join public.cantons c on c.id = pr.canton_id
    where s.id = p_station_id
      and public.can_manage_station(s.id)
      and public.is_profile_role(p_observer_id, 'observer')
      and public.is_profile_in_province(p_observer_id, c.province_id)
      and (
        exists (
          select 1
          from public.profiles target
          where target.id = p_observer_id
            and target.created_by = auth.uid()
        )
        or exists (
          select 1
          from public.observer_assignments a
          join public.polling_stations assigned_station
            on assigned_station.id = a.polling_station_id
          where a.observer_id = p_observer_id
            and assigned_station.precinct_id = pr.id
            and a.revoked_at is null
        )
      )
  );
$$;

create or replace function public.can_access_acta(p_acta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.actas a
    where a.id = p_acta_id
      and public.can_access_station(a.polling_station_id)
  );
$$;

create or replace function public.can_edit_acta(p_acta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.actas a
    where a.id = p_acta_id
      and (
        public.can_manage_station(a.polling_station_id)
        or public.is_active_observer_assigned(auth.uid(), a.polling_station_id)
      )
  );
$$;

create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_profile_id = auth.uid()
    or exists (
      select 1
      from public.profiles me
      join public.profiles target on target.id = p_profile_id
      where me.id = auth.uid()
        and me.role = 'provincial_coordinator'
        and me.province_id = target.province_id
    )
    or exists (
      select 1
      from public.precinct_coordinators pc
      join public.precincts pr on pr.id = pc.precinct_id
      join public.cantons c on c.id = pr.canton_id
      join public.profiles target on target.id = p_profile_id
      where pc.user_id = auth.uid()
        and target.province_id = c.province_id
        and (
          target.created_by = auth.uid()
          or
          exists (
            select 1
            from public.precinct_coordinators target_pc
            where target_pc.precinct_id = pc.precinct_id
              and target_pc.user_id = target.id
          )
          or exists (
            select 1
            from public.observer_assignments a
            join public.polling_stations s on s.id = a.polling_station_id
            where s.precinct_id = pc.precinct_id
              and a.observer_id = target.id
              and a.revoked_at is null
          )
        )
    );
$$;

create or replace function public.can_access_acta_photo_path(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_folder text;
begin
  v_folder := (storage.foldername(p_path))[1];
  if v_folder is null or v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.can_access_acta(v_folder::uuid);
end;
$$;

create or replace function public.can_edit_acta_photo_path(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_folder text;
  v_acta_id uuid;
begin
  v_folder := (storage.foldername(p_path))[1];
  if v_folder is null or v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_acta_id := v_folder::uuid;
  return exists (
    select 1
    from public.actas a
    where a.id = v_acta_id
      and a.photo_path = p_path
      and a.status <> 'sent'
      and public.can_edit_acta(a.id)
  );
end;
$$;

create or replace function public.set_acta_server_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.polling_station_id <> old.polling_station_id
      or new.office <> old.office
      or new.author_id <> old.author_id then
      raise exception 'Acta identity and original author are immutable';
    end if;

    if coalesce(auth.role(), '') <> 'service_role'
      and new.device_modified_at <= old.device_modified_at then
      raise exception 'Device modification time must be newer than the stored version';
    end if;

    new.updated_by := coalesce(auth.uid(), new.updated_by);
  else
    new.author_id := coalesce(new.author_id, auth.uid());
    new.updated_by := coalesce(new.updated_by, auth.uid());
  end if;

  if coalesce(auth.role(), '') <> 'service_role' then
    new.updated_by := auth.uid();
  end if;

  new.server_received_at := clock_timestamp();
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function public.guard_observer_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(auth.role(), '') <> 'service_role' then
      new.assigned_by := auth.uid();
    end if;
    return new;
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
    and (
      new.polling_station_id <> old.polling_station_id
      or new.observer_id <> old.observer_id
      or new.assigned_by <> old.assigned_by
      or new.assigned_at <> old.assigned_at
    ) then
    raise exception 'Observer assignment identity is immutable; revoke and create a new assignment';
  end if;
  return new;
end;
$$;

create or replace function public.validate_acta_before_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_count integer;
  v_organization_count integer;
  v_vote_row_count integer;
  v_non_null_vote_count integer;
  v_candidate_votes bigint;
begin
  if new.status = 'sent' then
    select count(*), count(distinct c.organization_id)
      into v_candidate_count, v_organization_count
      from public.candidates c
     where c.office = new.office;

    select count(*), count(v.votes), coalesce(sum(v.votes), 0)
      into v_vote_row_count, v_non_null_vote_count, v_candidate_votes
      from public.acta_candidate_votes v
     where v.acta_id = new.id;

    if v_candidate_count <> 5
      or v_organization_count <> 5
      or v_vote_row_count <> 5
      or v_non_null_vote_count <> 5 then
      raise exception 'An acta must contain votes for exactly five candidates of its office';
    end if;

    if new.total_voters is null
      or new.blank_votes is null
      or new.null_votes is null then
      raise exception 'All acta vote totals must be completed before sending';
    end if;

    if v_candidate_votes + new.blank_votes + new.null_votes <> new.total_voters then
      raise exception 'Acta vote totals must equal the total number of voters';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_candidate_vote_office()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acta_office public.electoral_office;
  v_candidate_office public.electoral_office;
  v_acta_status public.acta_status;
begin
  if tg_op = 'DELETE' then
    select a.status
      into v_acta_status
      from public.actas a
     where a.id = old.acta_id
     for update;

    if v_acta_status = 'sent' then
      raise exception 'Set the acta to a pending state before deleting submitted vote rows';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
    and (new.acta_id <> old.acta_id or new.candidate_id <> old.candidate_id) then
    raise exception 'Vote identity is immutable; update its value instead';
  end if;

  select a.office, a.status
    into v_acta_office, v_acta_status
    from public.actas a
   where a.id = new.acta_id
   for update;

  select c.office
    into v_candidate_office
    from public.candidates c
   where c.id = new.candidate_id;

  if v_acta_office is null or v_candidate_office is null
    or v_acta_office <> v_candidate_office then
    raise exception 'Candidate office must match the acta office';
  end if;

  if v_acta_status = 'sent' and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Set the acta to a pending state before editing submitted vote rows';
  end if;
  return new;
end;
$$;

create or replace function public.capture_acta_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_acta_id uuid;
  v_device_modified_at timestamptz;
begin
  if tg_op <> 'INSERT' then
    v_old := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    v_new := to_jsonb(new);
  end if;

  if tg_table_name = 'actas' then
    v_acta_id := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;
    v_device_modified_at := coalesce(
      (v_new ->> 'device_modified_at')::timestamptz,
      (v_old ->> 'device_modified_at')::timestamptz
    );
  else
    v_acta_id := coalesce(v_new ->> 'acta_id', v_old ->> 'acta_id')::uuid;
    select a.device_modified_at
      into v_device_modified_at
      from public.actas a
     where a.id = v_acta_id;
  end if;

  insert into public.acta_audit_log (
    acta_id,
    actor_id,
    entity_name,
    operation,
    device_modified_at,
    old_record,
    new_record
  )
  values (
    v_acta_id,
    auth.uid(),
    tg_table_name,
    tg_op,
    v_device_modified_at,
    v_old,
    v_new
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.register_precinct_location_reference(p_acta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precinct_id uuid;
  v_source_acta_id uuid;
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
    precinct_id, source_acta_id, latitude, longitude, captured_at_device
  )
  values (
    v_precinct_id, p_acta_id, v_latitude, v_longitude, v_captured_at_device
  )
  on conflict (precinct_id) do nothing;

  select r.*
    into v_reference
    from public.precinct_location_references r
   where r.precinct_id = v_precinct_id
   for update;

  if v_reference.source_acta_id = p_acta_id
    or v_captured_at_device < v_reference.captured_at_device then
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

create or replace function public.save_acta_revision(
  p_acta_id uuid,
  p_polling_station_id uuid,
  p_office public.electoral_office,
  p_photo_path text,
  p_latitude double precision,
  p_longitude double precision,
  p_captured_at_device timestamptz,
  p_device_modified_at timestamptz,
  p_status public.acta_status,
  p_failure_stage text,
  p_total_voters integer,
  p_blank_votes integer,
  p_null_votes integer,
  p_candidate_votes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.actas%rowtype;
  v_vote_count integer;
  v_distinct_candidate_count integer;
  v_invalid_vote_count integer;
  v_valid_candidate_count integer;
begin
  if auth.uid() is null or coalesce(auth.role(), '') <> 'authenticated' then
    raise exception 'An authenticated user is required';
  end if;

  if p_status = 'sent' then
    raise exception 'Use submit_acta to submit a reviewed acta';
  end if;

  if (p_status = 'failed') is distinct from (p_failure_stage is not null) then
    raise exception 'Failed actas require a failure stage, and other states must clear it';
  end if;

  if p_candidate_votes is null or jsonb_typeof(p_candidate_votes) <> 'array' then
    raise exception 'Candidate votes must be provided as a JSON array';
  end if;

  select count(*),
         count(distinct vote.candidate_id),
         count(*) filter (
           where vote.candidate_id is null or vote.votes < 0
         )
    into v_vote_count, v_distinct_candidate_count, v_invalid_vote_count
    from jsonb_to_recordset(p_candidate_votes)
      as vote(candidate_id uuid, votes integer);

  if v_vote_count <> 5
    or v_distinct_candidate_count <> 5
    or v_invalid_vote_count <> 0 then
    raise exception 'Exactly five distinct candidates with nonnegative or unreadable vote values are required';
  end if;

  select count(*)
    into v_valid_candidate_count
    from jsonb_to_recordset(p_candidate_votes)
      as vote(candidate_id uuid, votes integer)
    join public.candidates c
      on c.id = vote.candidate_id
     and c.office = p_office;

  if v_valid_candidate_count <> 5 then
    raise exception 'All vote candidates must belong to the acta office';
  end if;

  select a.*
    into v_existing
    from public.actas a
   where a.id = p_acta_id
   for update;

  if found then
    if not public.can_edit_acta(p_acta_id) then
      raise exception 'Acta is unavailable for this user';
    end if;

    if v_existing.polling_station_id <> p_polling_station_id
      or v_existing.office <> p_office then
      raise exception 'Acta station and office are immutable';
    end if;

    if p_device_modified_at <= v_existing.device_modified_at then
      raise exception 'Device modification time must be newer than the stored version';
    end if;

    update public.actas
       set photo_path = p_photo_path,
           latitude = p_latitude,
           longitude = p_longitude,
           captured_at_device = p_captured_at_device,
           device_modified_at = p_device_modified_at,
           status = p_status,
           failure_stage = p_failure_stage,
           total_voters = p_total_voters,
           blank_votes = p_blank_votes,
           null_votes = p_null_votes
     where id = p_acta_id;
  else
    if not public.is_profile_role(auth.uid(), 'observer')
      or not public.is_active_observer_assigned(auth.uid(), p_polling_station_id) then
      raise exception 'Only an observer assigned to this station can create an acta';
    end if;

    insert into public.actas (
      id,
      polling_station_id,
      office,
      author_id,
      updated_by,
      photo_path,
      latitude,
      longitude,
      captured_at_device,
      device_modified_at,
      status,
      failure_stage,
      total_voters,
      blank_votes,
      null_votes
    )
    values (
      p_acta_id,
      p_polling_station_id,
      p_office,
      auth.uid(),
      auth.uid(),
      p_photo_path,
      p_latitude,
      p_longitude,
      p_captured_at_device,
      p_device_modified_at,
      p_status,
      p_failure_stage,
      p_total_voters,
      p_blank_votes,
      p_null_votes
    );
  end if;

  insert into public.acta_candidate_votes as stored_vote (acta_id, candidate_id, votes)
  select p_acta_id, vote.candidate_id, vote.votes
    from jsonb_to_recordset(p_candidate_votes)
      as vote(candidate_id uuid, votes integer)
  on conflict (acta_id, candidate_id)
  do update set votes = excluded.votes
    where stored_vote.votes is distinct from excluded.votes;

  delete from public.acta_candidate_votes existing_vote
   where existing_vote.acta_id = p_acta_id
     and not exists (
       select 1
         from jsonb_to_recordset(p_candidate_votes)
           as vote(candidate_id uuid, votes integer)
        where vote.candidate_id = existing_vote.candidate_id
     );
end;
$$;

create or replace function public.submit_acta(
  p_acta_id uuid,
  p_device_modified_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.acta_status;
  v_stored_device_modified_at timestamptz;
begin
  if auth.uid() is null or coalesce(auth.role(), '') <> 'authenticated' then
    raise exception 'An authenticated user is required';
  end if;

  select a.status, a.device_modified_at
    into v_status, v_stored_device_modified_at
    from public.actas a
   where a.id = p_acta_id
   for update;

  if not found or not public.can_edit_acta(p_acta_id) then
    raise exception 'Acta is unavailable for this user';
  end if;

  if v_status <> 'sending' then
    raise exception 'Only an acta in the sending state can be submitted';
  end if;

  if p_device_modified_at <= v_stored_device_modified_at then
    raise exception 'Device modification time must be newer than the stored version';
  end if;

  update public.actas
     set status = 'sent',
         failure_stage = null,
         device_modified_at = p_device_modified_at
   where id = p_acta_id;
end;
$$;

create trigger actas_set_server_metadata
before insert or update on public.actas
for each row execute function public.set_acta_server_metadata();

create trigger observer_assignments_guard
before insert or update on public.observer_assignments
for each row execute function public.guard_observer_assignment();

create trigger actas_validate_before_sent
before insert or update on public.actas
for each row execute function public.validate_acta_before_sent();

create trigger acta_candidate_votes_validate
before insert or update or delete on public.acta_candidate_votes
for each row execute function public.validate_candidate_vote_office();

create trigger actas_audit
after insert or update or delete on public.actas
for each row execute function public.capture_acta_audit();

create trigger acta_candidate_votes_audit
after insert or update or delete on public.acta_candidate_votes
for each row execute function public.capture_acta_audit();

alter table public.provinces enable row level security;
alter table public.cantons enable row level security;
alter table public.precincts enable row level security;
alter table public.polling_stations enable row level security;
alter table public.political_organizations enable row level security;
alter table public.candidates enable row level security;
alter table public.profiles enable row level security;
alter table public.precinct_coordinators enable row level security;
alter table public.observer_assignments enable row level security;
alter table public.actas enable row level security;
alter table public.acta_candidate_votes enable row level security;
alter table public.acta_audit_log enable row level security;
alter table public.precinct_location_references enable row level security;

create policy provinces_read_in_scope
  on public.provinces for select to authenticated
  using (public.can_access_province(id));

create policy cantons_read_in_scope
  on public.cantons for select to authenticated
  using (public.can_access_canton(id));

create policy precincts_read_in_scope
  on public.precincts for select to authenticated
  using (public.can_access_precinct(id));

create policy precincts_insert_in_scope
  on public.precincts for insert to authenticated
  with check (public.can_manage_canton(canton_id));

create policy polling_stations_read_in_scope
  on public.polling_stations for select to authenticated
  using (public.can_access_station(id));

create policy polling_stations_insert_in_scope
  on public.polling_stations for insert to authenticated
  with check (
    public.can_manage_canton((
      select pr.canton_id
      from public.precincts pr
      where pr.id = polling_stations.precinct_id
    ))
  );

create policy political_organizations_read
  on public.political_organizations for select to authenticated
  using (true);

create policy candidates_read
  on public.candidates for select to authenticated
  using (true);

create policy profiles_read_in_scope
  on public.profiles for select to authenticated
  using (public.can_view_profile(id));

create policy precinct_coordinators_read_in_scope
  on public.precinct_coordinators for select to authenticated
  using (public.can_access_precinct(precinct_id));

create policy precinct_coordinators_insert_in_scope
  on public.precinct_coordinators for insert to authenticated
  with check (
    assigned_by = auth.uid()
    and
    public.can_manage_canton((
      select pr.canton_id
      from public.precincts pr
      where pr.id = precinct_coordinators.precinct_id
    ))
    and public.is_profile_role(user_id, 'precinct_coordinator')
    and public.is_profile_in_province(
      user_id,
      (
        select c.province_id
        from public.precincts pr
        join public.cantons c on c.id = pr.canton_id
        where pr.id = precinct_coordinators.precinct_id
      )
    )
  );

create policy precinct_coordinators_update_in_scope
  on public.precinct_coordinators for update to authenticated
  using (
    public.can_manage_canton((
      select pr.canton_id
      from public.precincts pr
      where pr.id = precinct_coordinators.precinct_id
    ))
  )
  with check (
    assigned_by = auth.uid()
    and
    public.can_manage_canton((
      select pr.canton_id
      from public.precincts pr
      where pr.id = precinct_coordinators.precinct_id
    ))
    and public.is_profile_role(user_id, 'precinct_coordinator')
    and public.is_profile_in_province(
      user_id,
      (
        select c.province_id
        from public.precincts pr
        join public.cantons c on c.id = pr.canton_id
        where pr.id = precinct_coordinators.precinct_id
      )
    )
  );

create policy precinct_coordinators_delete_in_scope
  on public.precinct_coordinators for delete to authenticated
  using (
    public.can_manage_canton((
      select pr.canton_id
      from public.precincts pr
      where pr.id = precinct_coordinators.precinct_id
    ))
  );

create policy observer_assignments_read_in_scope
  on public.observer_assignments for select to authenticated
  using (public.can_access_station(polling_station_id));

create policy observer_assignments_insert_in_scope
  on public.observer_assignments for insert to authenticated
  with check (
    assigned_by = auth.uid()
    and public.can_assign_observer(polling_station_id, observer_id)
  );

create policy observer_assignments_update_in_scope
  on public.observer_assignments for update to authenticated
  using (public.can_manage_station(polling_station_id))
  with check (public.can_assign_observer(polling_station_id, observer_id));

create policy actas_read_in_scope
  on public.actas for select to authenticated
  using (public.can_access_station(polling_station_id));

create policy acta_candidate_votes_read_in_scope
  on public.acta_candidate_votes for select to authenticated
  using (public.can_access_acta(acta_id));

create policy acta_audit_log_read_in_scope
  on public.acta_audit_log for select to authenticated
  using (public.can_access_acta(acta_id));

create policy precinct_location_references_read_in_scope
  on public.precinct_location_references for select to authenticated
  using (public.can_access_precinct(precinct_id));

create policy acta_photos_read_in_scope
  on storage.objects for select to authenticated
  using (
    bucket_id = 'acta-photos'
    and public.can_access_acta_photo_path(name)
  );

create policy acta_photos_insert_authorized
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'acta-photos'
    and public.can_edit_acta_photo_path(name)
  );

create policy acta_photos_update_authorized
  on storage.objects for update to authenticated
  using (
    bucket_id = 'acta-photos'
    and public.can_edit_acta_photo_path(name)
  )
  with check (
    bucket_id = 'acta-photos'
    and public.can_edit_acta_photo_path(name)
  );

create policy acta_photos_delete_authorized
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'acta-photos'
    and public.can_edit_acta_photo_path(name)
  );

grant usage on schema public to authenticated;
grant usage on type public.app_role, public.electoral_office, public.acta_status to authenticated;
grant usage on type public.app_role, public.electoral_office, public.acta_status to service_role;

grant select on
  public.provinces,
  public.cantons,
  public.precincts,
  public.polling_stations,
  public.political_organizations,
  public.candidates,
  public.profiles,
  public.precinct_coordinators,
  public.observer_assignments,
  public.actas,
  public.acta_candidate_votes,
  public.acta_audit_log,
  public.precinct_location_references
to authenticated;

grant insert on public.precincts to authenticated;
grant insert on public.polling_stations to authenticated;
grant insert, update, delete on public.precinct_coordinators to authenticated;
grant insert, update on public.observer_assignments to authenticated;

grant all on
  public.provinces,
  public.cantons,
  public.precincts,
  public.polling_stations,
  public.political_organizations,
  public.candidates,
  public.profiles,
  public.precinct_coordinators,
  public.observer_assignments,
  public.actas,
  public.acta_candidate_votes,
  public.acta_audit_log,
  public.precinct_location_references
to service_role;

revoke all on function public.is_profile_role(uuid, public.app_role) from public;
revoke all on function public.is_profile_in_province(uuid, uuid) from public;
revoke all on function public.is_active_observer_assigned(uuid, uuid) from public;
revoke all on function public.can_access_province(uuid) from public;
revoke all on function public.can_access_canton(uuid) from public;
revoke all on function public.can_access_precinct(uuid) from public;
revoke all on function public.can_access_station(uuid) from public;
revoke all on function public.can_manage_canton(uuid) from public;
revoke all on function public.can_manage_station(uuid) from public;
revoke all on function public.can_assign_observer(uuid, uuid) from public;
revoke all on function public.can_access_acta(uuid) from public;
revoke all on function public.can_edit_acta(uuid) from public;
revoke all on function public.can_view_profile(uuid) from public;
revoke all on function public.can_access_acta_photo_path(text) from public;
revoke all on function public.can_edit_acta_photo_path(text) from public;
revoke all on function public.set_acta_server_metadata() from public;
revoke all on function public.guard_observer_assignment() from public;
revoke all on function public.validate_acta_before_sent() from public;
revoke all on function public.validate_candidate_vote_office() from public;
revoke all on function public.capture_acta_audit() from public;
revoke all on function public.register_precinct_location_reference(uuid) from public;
revoke all on function public.save_acta_revision(
  uuid,
  uuid,
  public.electoral_office,
  text,
  double precision,
  double precision,
  timestamptz,
  timestamptz,
  public.acta_status,
  text,
  integer,
  integer,
  integer,
  jsonb
) from public;
revoke all on function public.submit_acta(uuid, timestamptz) from public;

grant execute on function public.can_access_province(uuid) to authenticated;
grant execute on function public.can_access_canton(uuid) to authenticated;
grant execute on function public.can_access_precinct(uuid) to authenticated;
grant execute on function public.can_access_station(uuid) to authenticated;
grant execute on function public.can_manage_canton(uuid) to authenticated;
grant execute on function public.can_manage_station(uuid) to authenticated;
grant execute on function public.can_assign_observer(uuid, uuid) to authenticated;
grant execute on function public.can_access_acta(uuid) to authenticated;
grant execute on function public.can_edit_acta(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.can_access_acta_photo_path(text) to authenticated;
grant execute on function public.can_edit_acta_photo_path(text) to authenticated;
grant execute on function public.register_precinct_location_reference(uuid) to authenticated;
grant execute on function public.save_acta_revision(
  uuid,
  uuid,
  public.electoral_office,
  text,
  double precision,
  double precision,
  timestamptz,
  timestamptz,
  public.acta_status,
  text,
  integer,
  integer,
  integer,
  jsonb
) to authenticated;
grant execute on function public.submit_acta(uuid, timestamptz) to authenticated;

commit;
