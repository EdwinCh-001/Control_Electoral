# ADR-01: Backend, autenticacion y seguridad de datos

**Estado:** Aceptado

## Requerimientos relacionados

RF-01, RF-02, RF-03, RF-04, RF-09, RF-10, RF-12, RNF-02, S-05.

## Contexto

Se requiere una plataforma backend que integre persistencia relacional, autenticacion, almacenamiento de archivos y actualizaciones en tiempo real.

## Stack y decision

- Supabase: PostgreSQL, Auth, Storage, Realtime y Edge Functions.
- `expo-secure-store` para proteger la sesion local.
- Supabase Auth utiliza el SMTP configurado para confirmacion y recuperacion de correo; no se fija un proveedor SMTP.

## Ventajas y desventajas

- Integra base de datos relacional, autenticacion, Storage y Realtime.
- Supabase ofrece RLS para aislar datos.
- RLS y las funciones de backend requieren configuracion cuidadosa.

## Consecuencias

- Se deben configurar y probar las politicas RLS para tablas y Storage.
- SMTP debe configurarse para evitar las limitaciones de envio del servicio predeterminado.
- Las credenciales privilegiadas permanecen fuera del cliente movil.
