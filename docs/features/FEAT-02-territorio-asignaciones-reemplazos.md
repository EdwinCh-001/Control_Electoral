# FEAT-02: Territorio, asignaciones y reemplazos

**Estado:** Pendiente  
**Depende de:** FEAT-01  
**Requerimientos:** RF-04, RF-05, RF-06, RF-12  
**ADR:** ADR-01, ADR-03  
**Supuestos:** S-04, S-05

## Encargo para la IA

Implementa el flujo completo de administracion territorial y asignacion de personas. El coordinador provincial gestiona los recintos de su jurisdiccion y su coordinador; el coordinador de recinto asigna y reemplaza veedores en mesas. Mantén la autoria original de las actas cuando cambie la asignacion.

## Criterios de aceptacion

- Un coordinador de recinto administra veedores de su recinto; un veedor puede cubrir varias mesas.
- El reemplazo conserva el autor original de las actas y obtiene acceso solo a las mesas que se le asignen.
- Una persona externa sigue el flujo de creacion y activacion online de S-05; no se crea una cuenta offline ni se guarda una clave en texto plano.
- Los datos reales de provincia, canton, recintos y candidaturas no se inventan. Se permiten fixtures aislados para pruebas.
- Se prueban intentos de operar fuera del rol, recinto o jurisdiccion permitidos.

## Verificacion

Completar un recorrido con un coordinador provincial, uno de recinto y dos veedores; reasignar una mesa y verificar que la autoria previa y los permisos sigan correctos.
