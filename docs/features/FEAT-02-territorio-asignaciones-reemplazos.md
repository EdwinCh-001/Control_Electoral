# FEAT-02: Territorio, asignaciones y reemplazos

- **Estado:** Implementada
- **Depende de:** FEAT-01
- **Requerimientos:** RF-04, RF-05, RF-06, RF-12
- **ADR:** ADR-01, ADR-03
- **Supuestos:** S-04, S-05

## Encargo para la IA

Implementa el flujo completo de administracion territorial y asignacion de personas. El coordinador provincial gestiona los recintos de su jurisdiccion y crea la cuenta de su coordinador asignandole un recinto libre en el mismo registro; desde la pantalla de territorio solo consulta la asignacion. El coordinador de recinto asigna y reemplaza veedores en mesas. Mantén la autoria original de las actas cuando cambie la asignacion.

## Criterios de aceptacion

- Un coordinador de recinto administra veedores de su recinto; un veedor puede cubrir varias mesas.
- El coordinador provincial consulta y agrega recintos dentro de los cantones de su provincia. El coordinador de cada recinto se asigna al crear su cuenta; un recinto con coordinador no puede tomar otro y la interfaz no ofrece reasignarlo.
- Las asignaciones de coordinadores y veedores se validan en el servidor por rol y jurisdiccion; crear la cuenta de coordinador falla con un mensaje claro si el recinto ya esta ocupado. Reemplazar un veedor revoca su mesa anterior y asigna al nuevo en una sola operacion.
- El reemplazo conserva el autor original de las actas y obtiene acceso solo a las mesas que se le asignen.
- Una persona externa sigue el flujo de creacion y activacion online de S-05; no se crea una cuenta offline ni se guarda una clave en texto plano.
- Los datos reales de provincia, canton, recintos y candidaturas no se inventan. Se permiten fixtures aislados para pruebas.
- Se prueban intentos de operar fuera del rol, recinto o jurisdiccion permitidos.

## Verificacion

Pasaron `npx tsc --noEmit`, `npx expo lint` y el bundle Android de produccion.

Para marcarla **Verificada**, falta aplicar `0002_territory_assignments.sql` en Supabase y completar el recorrido con un coordinador provincial, uno de recinto y dos veedores; reasignar una mesa y verificar que la autoria previa y los permisos sigan correctos. Tambien hay que comprobar que un recinto con coordinador no aparece para crear otra cuenta de coordinador y que la funcion devuelve el mensaje 409 claro si se envia ese recinto. Las pruebas reales de RLS requieren el proyecto y las cuentas de prueba del equipo.
