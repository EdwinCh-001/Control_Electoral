# ADR-06: Observabilidad y reporte de fallos

**Estado:** Aceptado

## Requerimientos relacionados

RNF-03.

## Contexto

Se necesita detectar cierres inesperados y errores no fatales con contexto suficiente para investigar fallos en distintos dispositivos Android.

## Stack y decision

- Firebase Crashlytics.

## Ventajas y desventajas

- Permite detectar y priorizar fallos de la aplicacion.
- Depende del ecosistema Google y de una integracion nativa.

## Consecuencias

- Algunos errores se reportan como no fatales; deben conservar contexto util para localizar su origen.
- La integracion requiere validacion mediante un APK de EAS.
