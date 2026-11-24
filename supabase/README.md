# Configuracion de Supabase

La migracion inicial esta en [`migrations/0001_initial_schema.sql`](./migrations/0001_initial_schema.sql). Crea el esquema, indices, triggers de integridad, auditoria y politicas RLS; no inserta provincias, recintos, usuarios ni candidaturas.

## Antes de empezar

- Usa primero un proyecto Supabase de desarrollo, separado de cualquier proyecto real.
- No pegues claves, contrasenas, datos personales ni actas en el repositorio o en mensajes a la IA.
- La migracion es para un proyecto nuevo y se ejecuta una sola vez. No la vuelvas a ejecutar sobre una base donde ya se aplico.
- La clave `service_role` nunca va en la app ni en `.env`.

## Pasos que debes hacer

1. En el Dashboard de Supabase, crea un proyecto nuevo de desarrollo. Guarda la contrasena de la base en un gestor privado; no la agregues a Git.
2. En **Storage**, crea el bucket `acta-photos` y confirma que sea **private**. La migracion crea politicas para ese bucket y su contenido.
3. Abre **SQL Editor**, crea una consulta nueva, copia todo el contenido de `migrations/0001_initial_schema.sql` y ejecutala una sola vez. La transaccion debe terminar sin errores. Si falla, guarda el mensaje exacto y no ejecutes una version parcialmente editada contra una base con objetos existentes.
4. Verifica que aparezcan las tablas `provinces`, `cantons`, `precincts`, `polling_stations`, `profiles`, `precinct_coordinators`, `observer_assignments`, `actas`, `acta_candidate_votes`, `acta_audit_log` y `precinct_location_references`.
5. En **Table Editor**, confirma que las tablas de `public` tengan RLS habilitado. En **Policies**, revisa las politicas de tablas y de `storage.objects`; confirma que el bucket sea privado.
6. En **Authentication**, desactiva el registro publico y activa la confirmacion de correo. Configura el SMTP que el equipo elija. No se fijo un proveedor.
7. Despliega la carpeta `web/` como proyecto Vercel independiente: raiz `web`, comando de build `npm run build` y salida `dist`. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en los entornos de Vercel; no agregues `service_role`.
8. En **Authentication → URL Configuration**, configura el dominio Vercel como **Site URL** y permite la ruta exacta `https://<dominio-vercel>/reset-password`. Sustituye el marcador por el dominio real.
9. Copia `.env.example` a `.env` localmente y completa `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y `EXPO_PUBLIC_PASSWORD_RESET_URL=https://<dominio-vercel>/reset-password`. Para desarrollo local, usa `web/.env.example` en la carpeta `web/`. No copies `service_role`.
10. Instala Supabase CLI si aún no está disponible, autentícate y enlaza el proyecto (`supabase login`, `supabase link --project-ref <project-ref>`). Desde la raíz del proyecto despliega `supabase functions deploy create-account` y `supabase functions deploy complete-password-change`. El runtime de Supabase debe disponer de `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`; esta última permanece solo en servidor.
11. Carga la provincia y los cantones aprobados. Crea la primera cuenta provincial desde **Authentication → Users** (no insertes filas en `auth.users`) y luego vincula ese UUID con un perfil autorizado desde SQL Editor. Cambia los marcadores por datos reales y conserva `must_change_password = true`:

```sql
insert into public.profiles (
  id, role, province_id, national_id, full_name, phone, email,
  must_change_password
)
values (
  '<auth-user-uuid>',
  'provincial_coordinator',
  '<province-uuid>',
  '<national-id>',
  '<full-name>',
  '<phone>',
  '<email>',
  true
);
```

12. Confirma la cuenta provincial desde Auth Dashboard y prueba su cambio obligatorio de contraseña. Para las cuentas siguientes, `create-account` crea el perfil, asigna el recinto cuando corresponde, envía el correo de confirmación y devuelve la contraseña temporal solo al coordinador que inició la operación.
13. No cargues datos territoriales o electorales ficticios como datos de producción. Antes de probar la captura deben existir recintos, mesas, cinco organizaciones y cinco candidaturas por dignidad.
14. Valida RLS con sesiones reales de prueba para cada rol. SQL Editor opera con privilegios administrativos y no sirve para comprobar que RLS limita correctamente a un usuario.
15. Para cambios futuros, crea una nueva migracion numerada (`0002_...sql`) y pruebala en desarrollo. No reescribas una migracion que ya se aplico ni la ejecutes sobre produccion sin respaldo y verificacion.

## Consultas de comprobacion

Se pueden ejecutar en SQL Editor para revisar la estructura (no para probar RLS):

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select id, name, public
from storage.buckets
where id = 'acta-photos';
```

La ultima consulta debe mostrar `public = false`. Para comprobar acceso por rol, usa la aplicacion con usuarios de prueba; no uses la sesion administrativa de SQL Editor.

## Alcance de la migracion

- Las fotos usan el bucket privado `acta-photos` y rutas `<acta-uuid>/evidence.jpg`.
- Los conteos de las cinco candidaturas se guardan por acta. Al marcar el acta como `sent`, la base exige cinco candidaturas para la dignidad y cuadre exacto con sufragantes.
- La app guarda cada revision completa de forma atomica llamando `save_acta_revision`; el cliente no debe insertar ni actualizar directamente `actas` o `acta_candidate_votes`. El envio final se confirma con `submit_acta`, que exige estado `sending` y valida nuevamente el cuadre.
- Los estados persistidos son `draft`, `pending`, `processing_ocr`, `ready`, `sending`, `sent` y `failed`; `failure_stage` conserva si se fallo en OCR o en el envio.
- Last-Write-Wins compara `device_modified_at`; cada escritura guarda `server_received_at` y agrega historial. Marcas de dispositivo iguales se rechazan para revision, pues no se acordo desempate.
- La referencia GPS por recinto se registra mediante `register_precinct_location_reference` usando la hora de captura del dispositivo. Si dos actas distintas tienen exactamente la misma hora y ambas serian la referencia, la funcion informa conflicto en vez de escoger una silenciosamente.
- La migracion crea `profiles.must_change_password`; las Edge Functions `create-account` y `complete-password-change` administran cuentas sin exponer claves privilegiadas al cliente.
- Esta migracion no crea usuarios Auth, configura SMTP, despliega Edge Functions ni carga datos territoriales o candidaturas.
