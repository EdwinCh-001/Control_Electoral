# Estado FDD

Cada feature es un flujo vertical completo, no una microtarea. Ejecutalas en orden; abre solo la ficha de la feature que la IA va a implementar. Para iniciar una, envia: **“Implementa completa FEAT-XX segun `docs/features/FEAT-XX-....md`.”**

La IA debe leer `AGENTS.md`, esa ficha y solo los requerimientos, supuestos y ADR citados. Debe revisar el codigo existente, implementar y probar el flujo completo, no agregar herramientas no aprobadas, informar bloqueos sin inventar datos/secretos, ejecutar `npx expo lint` y `npx tsc --noEmit`, e informar resultados. No agregar framework de pruebas sin autorizacion.

| Orden | Feature | Requerimientos | Depende de | Estado |
|---:|---|---|---|---|
| 1 | [FEAT-01: Acceso, perfiles y recuperacion](./features/FEAT-01-acceso-perfiles-recuperacion.md) | RF-01 a RF-03, RF-12, RNF-02 | Base limpia | Implementada |
| 2 | [FEAT-02: Territorio, asignaciones y reemplazos](./features/FEAT-02-territorio-asignaciones-reemplazos.md) | RF-04 a RF-06, RF-12 | FEAT-01 | Implementada |
| 3 | [FEAT-03: Captura, validacion y revision de actas](./features/FEAT-03-captura-revision-actas.md) | RF-07 a RF-10, RNF-01 | FEAT-01, FEAT-02 | Implementada |
| 4 | [FEAT-04: Sincronizacion, correcciones y auditoria](./features/FEAT-04-sincronizacion-correcciones-auditoria.md) | RF-10 a RF-12, RNF-01 a RNF-03 | FEAT-03 | Implementada |
| 5 | [FEAT-05: Seguimiento, observabilidad y APK](./features/FEAT-05-seguimiento-observabilidad-apk.md) | RF-12, RF-13, RNF-02 a RNF-04 | FEAT-01 a FEAT-04 | Pendiente |

## Auditoría del 2026-11-24

- FEAT-01 a FEAT-04 siguen en **Implementada**: pasan `npx expo lint` y `npx tsc --noEmit`, pero todavía no se completaron los recorridos manuales en Expo Go/APK. No se marcan como **Verificada** hasta que el equipo execute las pruebas de cada ficha.
- FEAT-05 permanece **Pendiente**. No se implementó ni se verificó Crashlytics, el tablero provincial ni el APK de EAS.
- ADR-07 aún tiene brechas reportadas (`@gorhom/bottom-sheet`, `lottie-react-native`, `uniwind` y dependencias nativas/EAS de FEAT-05). No se agregaron herramientas nuevas sin una decisión.
- El coordinador de recinto se asigna únicamente al crear su cuenta; la pantalla de territorio solo lo consulta. La asignación/reemplazo de veedores en mesas sí se administra después del registro.

## Estados

- **Pendiente:** no se ha iniciado.
- **En curso:** se implementa el flujo completo.
- **Implementada:** los criterios y pruebas automatizadas disponibles pasan.
- **Verificada:** ademas se completo la prueba manual en Expo Go o APK, segun corresponda.
