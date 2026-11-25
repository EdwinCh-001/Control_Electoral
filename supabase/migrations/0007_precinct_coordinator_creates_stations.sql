begin;

create or replace function public.can_create_polling_station(p_precinct_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.precinct_coordinators pc
    join public.profiles me on me.id = pc.user_id
    where pc.precinct_id = p_precinct_id
      and pc.user_id = auth.uid()
      and me.role = 'precinct_coordinator'
  );
$$;

create or replace function public.create_polling_station(
  p_precinct_id uuid,
  p_station_number integer,
  p_sex public.polling_station_sex
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_station_id uuid;
begin
  if p_station_number is null or p_station_number <= 0 then
    raise exception 'El número de mesa debe ser mayor a cero.';
  end if;

  if p_sex is null then
    raise exception 'Selecciona si la mesa es de mujeres o de hombres.';
  end if;

  if not public.can_create_polling_station(p_precinct_id) then
    raise exception 'Solo el coordinador del recinto puede crear mesas.';
  end if;

  if exists (
    select 1
    from public.polling_stations
    where precinct_id = p_precinct_id
      and sex = p_sex
      and station_number = p_station_number
  ) then
    raise exception 'Ya existe una mesa con ese número y sexo en el recinto.';
  end if;

  insert into public.polling_stations (precinct_id, station_number, sex)
  values (p_precinct_id, p_station_number, p_sex)
  returning id into v_station_id;

  return v_station_id;
end;
$$;

drop policy if exists polling_stations_insert_in_scope on public.polling_stations;

create policy polling_stations_insert_in_scope
  on public.polling_stations for insert to authenticated
  with check (public.can_create_polling_station(precinct_id));

revoke insert on public.polling_stations from authenticated;

revoke all on function public.can_create_polling_station(uuid) from public;
revoke all on function public.create_polling_station(
  uuid,
  integer,
  public.polling_station_sex
) from public;

grant execute on function public.can_create_polling_station(uuid) to authenticated;
grant execute on function public.create_polling_station(
  uuid,
  integer,
  public.polling_station_sex
) to authenticated;

commit;
