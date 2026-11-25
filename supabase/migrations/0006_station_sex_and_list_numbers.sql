begin;

create type public.polling_station_sex as enum ('female', 'male');

alter table public.polling_stations
  add column sex public.polling_station_sex;

alter table public.polling_stations
  drop constraint if exists polling_stations_precinct_id_station_number_key;

alter table public.polling_stations
  add constraint polling_stations_precinct_sex_station_number_key
  unique (precinct_id, sex, station_number);

alter table public.political_organizations
  add column list_number integer
  check (list_number is null or list_number > 0);

commit;
