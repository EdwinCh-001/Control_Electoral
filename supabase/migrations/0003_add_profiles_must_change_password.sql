-- Reparacion de esquema para un proyecto de DESARROLLO que aplico una version
-- anterior del esquema y no tiene profiles.must_change_password.
-- 0001_initial_schema.sql ya define esta columna; la app y las Edge Functions
-- create-account / complete-password-change la requieren.
-- No ejecutar en produccion sin respaldo y verificacion previa.

begin;

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

commit;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position;
