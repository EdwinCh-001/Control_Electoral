begin;

insert into public.provinces (name)
values ('PICHINCHA')
on conflict (name) do nothing;

insert into public.cantons (province_id, name)
select province.id, 'QUITO'
from public.provinces as province
where province.name = 'PICHINCHA'
on conflict (province_id, name) do nothing;

insert into public.precincts (canton_id, parish, name)
select canton.id, seed.parish, seed.name
from (
  values
    ('CARCELEN', 'ISM WEST - EX COLEGIO ALBERTO EINSTEIN'),
    ('GUAMANI', 'E.F.M. NUEVA AURORA'),
    ('GUAMANI', 'U.E. MEJIA D7'),
    ('GUAMANI', 'ESCUELA CARLOS GUERRA BOADA'),
    ('PACTO', 'ESCUELA RIO PACHIJAL'),
    ('TUMBACO', 'U.E. TUMBACO'),
    ('TUMBACO', 'ACADEMIA MILITAR GENERAL MIGUEL ITURRALDE 2'),
    ('JIPIJAPA', 'INSTITUCIÓN EDUCATIVA CENTRAL TECNICO'),
    ('JIPIJAPA', 'I.E. CENTRAL TECNICO BLOQUE OCCIDENTAL.'),
    ('MARISCAL SUCRE', 'U.E. PEDRO PABLO BORJA 2'),
    ('CHILIBULO', 'U.E. REPUBLICA DE IRAK'),
    ('LA ARGELIA', 'COLEGIO GONZALO ESCUDERO'),
    ('LA ARGELIA', 'E.E.B VIRGINIA LARENAS'),
    ('TURUBAMBA', 'U.E. MUNICIPAL BICENTENARIO'),
    ('BELISARIO QUEVEDO', 'U.E.CARDENAL SPELLMAN FEMENINO'),
    ('COCHAPAMBA', 'UNIDAD EDUCATIVA PARTICULAR BILINGUE INTISANA'),
    ('COCHAPAMBA', 'U.E.P. RUDOLF STEINER'),
    ('EL CONDADO', 'U.E. CHARLES DARWIN'),
    ('EL CONDADO', 'U.E. JUAN PABLO SEGUNDO FE Y ALEGRIA'),
    ('EL CONDADO', 'COLEGIO MARIA ANGELICA IDROVO')
) as seed(parish, name)
join public.cantons as canton
  on canton.name = 'QUITO'
join public.provinces as province
  on province.id = canton.province_id
 and province.name = 'PICHINCHA'
on conflict (canton_id, parish, name) do nothing;

with station_ranges (
  parish,
  precinct_name,
  female_start,
  female_end,
  male_start,
  male_end
) as (
  values
    ('CARCELEN', 'ISM WEST - EX COLEGIO ALBERTO EINSTEIN', 1, 5, 1, 4),
    ('GUAMANI', 'E.F.M. NUEVA AURORA', 1, 8, 1, 8),
    ('GUAMANI', 'U.E. MEJIA D7', 9, 16, 9, 13),
    ('GUAMANI', 'ESCUELA CARLOS GUERRA BOADA', 1, 7, 1, 5),
    ('PACTO', 'ESCUELA RIO PACHIJAL', 1, 1, 1, 1),
    ('TUMBACO', 'U.E. TUMBACO', 1, 4, 1, 3),
    ('TUMBACO', 'ACADEMIA MILITAR GENERAL MIGUEL ITURRALDE 2', 1, 3, 1, 3),
    ('JIPIJAPA', 'INSTITUCIÓN EDUCATIVA CENTRAL TECNICO', 1, 18, 1, 18),
    ('JIPIJAPA', 'I.E. CENTRAL TECNICO BLOQUE OCCIDENTAL.', 19, 24, 19, 24),
    ('MARISCAL SUCRE', 'U.E. PEDRO PABLO BORJA 2', 1, 7, 1, 6),
    ('CHILIBULO', 'U.E. REPUBLICA DE IRAK', 1, 7, 1, 7),
    ('LA ARGELIA', 'COLEGIO GONZALO ESCUDERO', 1, 8, 1, 8),
    ('LA ARGELIA', 'E.E.B VIRGINIA LARENAS', 9, 17, 9, 16),
    ('TURUBAMBA', 'U.E. MUNICIPAL BICENTENARIO', 1, 14, 1, 13),
    ('BELISARIO QUEVEDO', 'U.E.CARDENAL SPELLMAN FEMENINO', 1, 11, 1, 10),
    ('COCHAPAMBA', 'UNIDAD EDUCATIVA PARTICULAR BILINGUE INTISANA', 1, 6, 1, 6),
    ('COCHAPAMBA', 'U.E.P. RUDOLF STEINER', 7, 13, 7, 12),
    ('EL CONDADO', 'U.E. CHARLES DARWIN', 1, 6, 1, 6),
    ('EL CONDADO', 'U.E. JUAN PABLO SEGUNDO FE Y ALEGRIA', 7, 12, 7, 12),
    ('EL CONDADO', 'COLEGIO MARIA ANGELICA IDROVO', 13, 33, 13, 30)
),
station_rows as (
  select
    precinct.id as precinct_id,
    'female'::public.polling_station_sex as sex,
    station.station_number
  from station_ranges as ranges
  join public.precincts as precinct
    on precinct.parish = ranges.parish
   and precinct.name = ranges.precinct_name
  join public.cantons as canton
    on canton.id = precinct.canton_id
   and canton.name = 'QUITO'
  join public.provinces as province
    on province.id = canton.province_id
   and province.name = 'PICHINCHA'
  cross join lateral generate_series(
    ranges.female_start,
    ranges.female_end
  ) as station(station_number)

  union all

  select
    precinct.id as precinct_id,
    'male'::public.polling_station_sex as sex,
    station.station_number
  from station_ranges as ranges
  join public.precincts as precinct
    on precinct.parish = ranges.parish
   and precinct.name = ranges.precinct_name
  join public.cantons as canton
    on canton.id = precinct.canton_id
   and canton.name = 'QUITO'
  join public.provinces as province
    on province.id = canton.province_id
   and province.name = 'PICHINCHA'
  cross join lateral generate_series(
    ranges.male_start,
    ranges.male_end
  ) as station(station_number)
)
insert into public.polling_stations (precinct_id, sex, station_number)
select precinct_id, sex, station_number
from station_rows
on conflict (precinct_id, sex, station_number) do nothing;

insert into public.political_organizations (name, list_number)
values
  ('Revolución Ciudadana (RC)', 5),
  ('Acción Democrática Nacional (ADN)', 7),
  ('Partido Social Cristiano (PSC)', 6),
  ('Izquierda Democrática (ID)', 12),
  ('Sociedad Unida Más Acción (SUMA)', 23)
on conflict (name) do update
set list_number = excluded.list_number;

insert into public.candidates (organization_id, office, full_name)
select organization.id, seed.office::public.electoral_office, seed.full_name
from (
  values
    ('Revolución Ciudadana (RC)', 'mayor', 'Pabel Muñoz'),
    ('Acción Democrática Nacional (ADN)', 'mayor', 'María Fernanda Andrade'),
    ('Partido Social Cristiano (PSC)', 'mayor', 'Carlos Gómez Almeida'),
    ('Izquierda Democrática (ID)', 'mayor', 'Patricia López Vela'),
    ('Sociedad Unida Más Acción (SUMA)', 'mayor', 'Javier Esteban Torres'),
    ('Revolución Ciudadana (RC)', 'prefect', 'Paola Pabón'),
    ('Acción Democrática Nacional (ADN)', 'prefect', 'Andrea Beltrán Salazar'),
    ('Partido Social Cristiano (PSC)', 'prefect', 'Fernando Herrera Ruiz'),
    ('Izquierda Democrática (ID)', 'prefect', 'Mónica Cárdenas Flores'),
    ('Sociedad Unida Más Acción (SUMA)', 'prefect', 'Ricardo Villacrés Molina')
) as seed(organization_name, office, full_name)
join public.political_organizations as organization
  on organization.name = seed.organization_name
on conflict (organization_id, office) do update
set full_name = excluded.full_name;

commit;
