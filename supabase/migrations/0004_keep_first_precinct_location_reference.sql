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
end;
$$;
