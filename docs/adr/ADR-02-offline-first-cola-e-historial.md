# ADR-02: Offline-first, cola diferida e historial

**Estado:** Aceptado

## Requerimientos relacionados

RF-07, RF-08, RF-09, RF-10, RF-11, RNF-01, S-03, S-04, S-06.

## Contexto

La conectividad puede faltar durante la jornada. La estrategia acordada es offline-first y requiere persistencia local, estados visibles y procesamiento diferido.

## Stack y decision

- SQLite mediante `expo-sqlite` para datos locales.
- `expo-file-system` para fotografias y archivos.
- NetInfo para conocer conectividad.
- Cola persistente y worker de dos fases: OCR y sincronizacion.

## Ventajas y desventajas

- SQLite permite persistencia relacional transaccional y estados consultables.
- El sistema de archivos conserva fotos sin mantenerlas en memoria.
- Se debe implementar y coordinar un worker de dos fases; Android puede aplazar su ejecucion en segundo plano.

## Consecuencias

- La sincronizacion debe respetar las dos fases acordadas.
- Los estados locales, reintentos y conflictos deben mantenerse consistentes.
- Expo Go sirve para recorridos habituales; el comportamiento nativo se valida con APK de EAS.
