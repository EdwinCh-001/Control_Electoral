# Configuracion de Supabase

La base se crea aplicando, en orden, [`0001_initial_schema.sql`](./migrations/0001_initial_schema.sql) a [`0006_station_sex_and_list_numbers.sql`](./migrations/0006_station_sex_and_list_numbers.sql). Las migraciones definen el esquema y sus restricciones, asignaciones territoriales, cambio obligatorio de contrasena, referencia GPS, permisos de lectura por columna e inclusion de actas/resultados en Realtime. No cargan datos electorales reales ni crean usuarios Auth.

## Modelo de datos

- `provinces -> cantons -> precincts -> polling_stations` define la jerarquia territorial. Los nombres se restringen como unicos dentro de su nivel padre. Las mesas pueden distinguirse por sexo y numero.
- `political_organizations.list_number` conserva el numero de lista cuando se conoce.
- `political_organizations -> candidates` define las organizaciones y candidaturas. Cada organizacion puede tener una candidatura por dignidad; antes de enviar un acta deben existir cinco candidaturas de cinco organizaciones para esa dignidad.
- `auth.users -> profiles` guarda el rol y datos del perfil. `precinct_coordinators` asigna como maximo un coordinador a cada recinto y cada coordinador a un recinto. `observer_assignments` conserva las asignaciones/revocaciones; solo hay un veedor activo por mesa y un veedor puede cubrir varias mesas.
- `actas` tiene como maximo un acta por mesa y dignidad. `acta_candidate_votes` conserva sus votos; el servidor exige cinco candidaturas, valores completos y cuadre exacto al pasar a `sent`.
- `acta_audit_log` guarda el actor, la hora del dispositivo y la recepcion del servidor para cambios de actas/votos. `precinct_location_references` conserva la captura de dispositivo mas temprana usada como referencia para las alertas de ubicacion.
- Las fotografias no se guardan como bytes en PostgreSQL: van al bucket privado `acta-photos`; la ruta se guarda en `actas.photo_path`. SQLite y el sistema de archivos del dispositivo conservan los borradores/fotos offline hasta sincronizarlos.

## Antes de empezar

- Usa primero un proyecto Supabase de desarrollo, separado de cualquier proyecto real.
- No pegues claves, contrasenas, datos personales ni actas en el repositorio o en mensajes a la IA.
- La migracion es para un proyecto nuevo y se ejecuta una sola vez. No la vuelvas a ejecutar sobre una base donde ya se aplico.
- La clave `service_role` nunca va en la app ni en `.env`.

## Pasos que debes hacer

1. En el Dashboard de Supabase, crea un proyecto nuevo de desarrollo. Guarda la contrasena de la base en un gestor privado; no la agregues a Git.
2. En **Storage**, crea el bucket `acta-photos` y confirma que sea **private**. La migracion crea politicas para ese bucket y su contenido.
3. En **SQL Editor**, crea una consulta y ejecuta el contenido de cada migracion, una por una y en orden: `0001`, `0002`, `0003`, `0004`, `0005` y `0006`. Confirma que cada transaccion termine sin errores. Si falla, conserva el error y detente; no vuelvas a ejecutar una migracion que ya se aplico. Para un proyecto existente, aplica solo las migraciones aun pendientes.
4. Verifica que existan `provinces`, `cantons`, `precincts`, `polling_stations`, `political_organizations`, `candidates`, `profiles`, `precinct_coordinators`, `observer_assignments`, `actas`, `acta_candidate_votes`, `acta_audit_log` y `precinct_location_references`.
5. En **Table Editor**, confirma que las tablas de `public` tengan RLS habilitado. En **Policies**, revisa las politicas de tablas y de `storage.objects`; confirma que el bucket sea privado y que las tablas `actas` y `acta_candidate_votes` aparezcan habilitadas para Realtime.
6. En **Authentication**, desactiva el registro publico y activa la confirmacion de correo. Configura el SMTP que el equipo elija. No se fijo un proveedor.
7. Despliega la carpeta `web/` como proyecto Vercel independiente: raiz `web`, comando de build `npm run build` y salida `dist`. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en los entornos de Vercel; no agregues `service_role`.
8. En **Authentication → URL Configuration**, configura como **Site URL** `https://<dominio-vercel>/email-verified` para que la confirmación de cuenta vuelva a su pantalla. Agrega estas URL exactas a **Redirect URLs**:
   - `https://<dominio-vercel>/email-verified`
   - `https://<dominio-vercel>/reset-password`
   - Para desarrollo local, también `http://localhost:4173/email-verified` y `http://localhost:4173/reset-password`.
   Sustituye `<dominio-vercel>` por el dominio real desplegado, sin barras angulares adicionales. La pantalla de confirmación es `/email-verified`; la pantalla para crear la clave nueva es `/reset-password`.
9. Copia `.env.example` a `.env` localmente y completa `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y `EXPO_PUBLIC_PASSWORD_RESET_URL=https://<dominio-vercel>/reset-password`. Para desarrollo local, configura `EXPO_PUBLIC_PASSWORD_RESET_URL=http://localhost:4173/reset-password` y usa `web/.env.example` en la carpeta `web/`. No copies `service_role`.
10. Instala Supabase CLI si aún no está disponible, autentícate y enlaza el proyecto (`supabase login`, `supabase link --project-ref <project-ref>`). Desde la raíz del proyecto despliega `supabase functions deploy create-account`, `supabase functions deploy complete-password-change` y `supabase functions deploy process-acta-ocr`. En **Project Settings → Edge Functions → Secrets**, configura `GEMINI_API_KEY` y `GEMINI_MODEL` con las credenciales privadas y el identificador de modelo aprobado por el equipo. Las funciones de cuentas requieren `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`; esta última permanece solo en servidor. No copies secretos en la app, en `.env` ni en Git. La aplicación y la función OCR no incluyen un modelo por defecto.
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

Para crear el coordinador provincial de prueba, crea y confirma primero `ipdemon001@gmail.com` en **Authentication → Users** y luego ejecuta [`seed_test_provincial_coordinator.sql`](./seed_test_provincial_coordinator.sql) desde SQL Editor. El script solo crea el perfil asociado a Pichincha; usa identificador y teléfono ficticios y no inserta usuarios en `auth.users`.

12. Confirma la cuenta provincial desde Auth Dashboard y prueba su cambio obligatorio de contraseña. Para las cuentas siguientes, `create-account` crea el perfil, asigna el recinto cuando corresponde, envía el correo de confirmación y devuelve la contraseña temporal solo al coordinador que inició la operación.
13. No cargues datos territoriales o electorales ficticios como datos de producción. Carga los catalogos en este orden por sus claves foraneas: provincia, cantones, recintos, mesas, organizaciones politicas y candidaturas. En una base de pruebas, luego de aplicar `0006`, puedes ejecutar [`seed_test_quito.sql`](./seed_test_quito.sql) para poblar Pichincha, Quito, 20 recintos, las mesas separadas por sexo, cinco organizaciones con sus numeros de lista y cinco candidaturas por dignidad. No ejecutes el seed de prueba en producción. Antes de probar la captura, verifica que haya exactamente cinco candidaturas de cinco organizaciones para cada dignidad:

```sql
select c.office, count(*) as candidates,
       count(distinct c.organization_id) as organizations
from public.candidates c
group by c.office
order by c.office;
```

El resultado esperado es una fila por dignidad con `candidates = 5` y `organizations = 5`. La informacion real no esta en el repositorio y no se debe reemplazar con datos inventados.
14. Valida RLS con sesiones reales de prueba para cada rol. SQL Editor opera con privilegios administrativos y no sirve para comprobar que RLS limita correctamente a un usuario.
15. Antes de aceptar fotos, calibra `EXPO_PUBLIC_IMAGE_SHARPNESS_THRESHOLD` con fotografias de prueba reales tomadas con los dispositivos y condiciones de uso. La app bloquea la aceptacion mientras la variable falte o no sea valida; no uses un umbral supuesto.
16. Si un proyecto de desarrollo aplico una version anterior, ejecuta unicamente las migraciones que falten, en orden. Para cambios futuros, crea una nueva migracion numerada (`0006_...sql` o superior) y pruebala en desarrollo. No reescribas una migracion que ya se aplico ni la ejecutes sobre produccion sin respaldo y verificacion.

## Vigencia de enlaces y sesiones

En **Authentication → Sign In / Providers → Email**, configura **Email OTP expiration** en `43200` segundos (12 horas). Este valor también controla la vigencia de los enlaces de recuperación, confirmación y otros enlaces enviados por correo. Los enlaces son de un solo uso; los ya enviados conservan la vigencia anterior, así que solicita uno nuevo después del cambio.

En **Authentication → Sessions**, configura **Inactivity timeout** en 30 días y deja **Time-box user sessions** sin límite. Los límites de sesión requieren un plan Supabase Pro o superior. Mantén **JWT expiry** en el valor recomendado de 3600 segundos: la app conserva la sesión mediante el refresh token y lo renueva automáticamente, no necesita un JWT de larga duración. La app móvil guarda la sesión en SecureStore.

La app inicia sesión normalmente con PKCE. La solicitud de recuperación usa un cliente separado para que el enlace pueda abrirse en el navegador aunque se haya solicitado desde el móvil; la web procesa el token de recuperación recibido y lo elimina de la URL al crear la sesión.

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

select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
order by tablename;

select
  has_column_privilege('authenticated', 'public.profiles', 'email', 'select')
    as can_read_email,
  has_column_privilege('authenticated', 'public.profiles', 'national_id', 'select')
    as can_read_national_id,
  has_column_privilege('authenticated', 'public.profiles', 'phone', 'select')
    as can_read_phone;
```

El bucket debe mostrar `public = false`; Realtime debe listar `actas` y `acta_candidate_votes`; los permisos deben devolver `true`, `false` y `false`, respectivamente. Para comprobar acceso por rol, usa la aplicacion con usuarios de prueba; no uses la sesion administrativa de SQL Editor.

## Alcance de la migracion

- Las fotos usan el bucket privado `acta-photos` y rutas `<acta-uuid>/evidence.jpg`.
- Los conteos de las cinco candidaturas se guardan por acta. Al marcar el acta como `sent`, la base exige cinco candidaturas para la dignidad y cuadre exacto con sufragantes.
- La app guarda cada revision completa de forma atomica llamando `save_acta_revision`; el cliente no debe insertar ni actualizar directamente `actas` o `acta_candidate_votes`. El envio final se confirma con `submit_acta`, que exige estado `sending` y valida nuevamente el cuadre.
- Los estados persistidos son `draft`, `pending`, `processing_ocr`, `ready`, `sending`, `sent` y `failed`; `failure_stage` conserva si se fallo en OCR o en el envio.
- Last-Write-Wins compara `device_modified_at`; cada escritura guarda `server_received_at` y agrega historial. Marcas de dispositivo iguales se rechazan para revision, pues no se acordo desempate.
- La referencia GPS por recinto es la captura con el `captured_at_device` mas temprano, aunque esa acta se sincronice despues. Si dos actas tienen exactamente la misma hora, el servidor rechaza la actualizacion y requiere revision; no elige silenciosamente. La app avisa si la distancia supera 300 m, sin bloquear el envio.
- `0005_complete_database_contract.sql` habilita `actas` y `acta_candidate_votes` en la publicacion `supabase_realtime`. Realtime respeta RLS; la feature del tablero aun debe suscribirse a esos cambios en el cliente.
- El cliente movil puede leer solo las columnas de perfil que necesita. `national_id` y `phone` no se conceden a sesiones autenticadas; las Edge Functions administrativas usan `service_role` solo en servidor.
- La migracion crea `profiles.must_change_password`; las Edge Functions `create-account` y `complete-password-change` administran cuentas sin exponer claves privilegiadas al cliente.
- `process-acta-ocr` valida la sesion, el rol y la asignacion antes de enviar la imagen a Gemini. La clave y el nombre del modelo se configuran solo en el servidor; el resultado es una propuesta para revision humana y nunca envia el acta.
- `0002_territory_assignments.sql` reemplaza las escrituras directas de asignacion por funciones transaccionales con validacion de rol y jurisdiccion. El reemplazo revoca la asignacion anterior y crea la nueva en una sola transaccion; la autoria original de las actas no cambia.
- `0005_complete_database_contract.sql` corrige la referencia GPS para que no dependa del orden de sincronizacion, limita lectura de datos personales, agrega indices de consultas usadas y habilita Realtime para el tablero.
- `0006_station_sex_and_list_numbers.sql` incorpora sexo a las mesas y numero de lista a las organizaciones. Las mesas preexistentes quedan con sexo `NULL` hasta clasificarlas.
- Las migraciones no crean usuarios Auth, configuran SMTP, despliegan Edge Functions, configuran secretos de Gemini ni cargan datos territoriales o candidaturas.
