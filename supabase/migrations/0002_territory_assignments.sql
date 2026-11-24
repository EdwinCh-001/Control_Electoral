begin;

create unique index precinct_coordinators_one_precinct_per_user
  on public.precinct_coordinators (user_id);

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
        )
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
          or exists (
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
          )
        )
    );
$$;

create or replace function public.assign_precinct_coordinator(
  p_precinct_id uuid,
  p_coordinator_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_province_id uuid;
begin
  select c.province_id
    into v_province_id
    from public.precincts pr
    join public.cantons c on c.id = pr.canton_id
   where pr.id = p_precinct_id;

  if v_province_id is null then
    raise exception 'El recinto seleccionado no existe.';
  end if;

  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.role = 'provincial_coordinator'
      and me.province_id = v_province_id
  ) then
    raise exception 'No tienes permisos para administrar este recinto.';
  end if;

  if not exists (
    select 1 from public.profiles target
    where target.id = p_coordinator_id
      and target.role = 'precinct_coordinator'
      and target.province_id = v_province_id
  ) then
    raise exception 'El coordinador no pertenece a esta provincia.';
  end if;

  if exists (
    select 1 from public.precinct_coordinators pc
    where pc.user_id = p_coordinator_id
      and pc.precinct_id <> p_precinct_id
  ) then
    raise exception 'El coordinador ya está asignado a otro recinto.';
  end if;

  insert into public.precinct_coordinators (
    precinct_id, user_id, assigned_by
  )
  values (p_precinct_id, p_coordinator_id, auth.uid())
  on conflict (precinct_id) do update
    set user_id = excluded.user_id,
        assigned_by = excluded.assigned_by,
        assigned_at = clock_timestamp();
end;
$$;

create or replace function public.assign_observer_to_station(
  p_polling_station_id uuid,
  p_observer_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precinct_id uuid;
  v_province_id uuid;
begin
  select s.precinct_id, c.province_id
    into v_precinct_id, v_province_id
    from public.polling_stations s
    join public.precincts pr on pr.id = s.precinct_id
    join public.cantons c on c.id = pr.canton_id
   where s.id = p_polling_station_id
   for update of s;

  if v_precinct_id is null then
    raise exception 'La mesa seleccionada no existe.';
  end if;

  if not exists (
    select 1 from public.precinct_coordinators pc
    where pc.precinct_id = v_precinct_id
      and pc.user_id = auth.uid()
  ) then
    raise exception 'No tienes permisos para administrar esta mesa.';
  end if;

  if p_observer_id is not null and not exists (
    select 1 from public.profiles target
    where target.id = p_observer_id
      and target.role = 'observer'
      and target.province_id = v_province_id
      and (
        target.created_by = auth.uid()
        or exists (
          select 1
          from public.observer_assignments a
          join public.polling_stations assigned_station
            on assigned_station.id = a.polling_station_id
          where a.observer_id = target.id
            and assigned_station.precinct_id = v_precinct_id
        )
      )
  ) then
    raise exception 'El veedor no pertenece al equipo autorizado de este recinto.';
  end if;

  update public.observer_assignments
     set revoked_at = clock_timestamp()
   where polling_station_id = p_polling_station_id
     and revoked_at is null;

  if p_observer_id is not null then
    insert into public.observer_assignments (
      polling_station_id, observer_id, assigned_by
    )
    values (p_polling_station_id, p_observer_id, auth.uid());
  end if;
end;
$$;

drop policy observer_assignments_insert_in_scope
  on public.observer_assignments;
drop policy observer_assignments_update_in_scope
  on public.observer_assignments;
revoke insert, update on public.observer_assignments from authenticated;

drop policy precinct_coordinators_insert_in_scope
  on public.precinct_coordinators;
drop policy precinct_coordinators_update_in_scope
  on public.precinct_coordinators;
drop policy precinct_coordinators_delete_in_scope
  on public.precinct_coordinators;
revoke insert, update, delete on public.precinct_coordinators from authenticated;

revoke all on function public.assign_precinct_coordinator(uuid, uuid) from public;
revoke all on function public.assign_observer_to_station(uuid, uuid) from public;
grant execute on function public.assign_precinct_coordinator(uuid, uuid)
  to authenticated;
grant execute on function public.assign_observer_to_station(uuid, uuid)
  to authenticated;

commit;
