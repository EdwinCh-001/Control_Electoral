# ADR-02: Estrategia Online-First, Cola Diferida e Historial y Estados

## Requerimientos relacionados

RF-05, RF-06, RF-07, RF-08, RNF-01, S-03, S-04, S-06

## Contexto

En recintos rurales los veedores no tienen internet al cerrar el escrutinio además en elecciones anteriores la falta de feedback visual provocó envíos duplicados al reintentar la app debe permitir guardar actas con foto nítida y GPS sin señal mostrando su estado en un historial pendiente vs enviado ejecutando automáticamente la extracción OCR cuando vuelva a la red esperando la confirmación humana antes de subir el acta definitiva.

## Alternativas consideradas

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
|---|---|---|---|
| expo-sqlite, expo-file-system, NetInfo, Estados | Bryan Rodrigo Salvador Martinez | Almacenamiento relacional transaccional permitiendo gestionar estados visibles en el historial, guarda las fotos como archivos físicos sin saturar la RAM. | Requiere implementar el worker de sincronización en dos fases primero OCR al reconectar y luego la subida a supabase. |
| SQLite + tanStackQuery | Edwin Chusin | Operación de forma inmediata y confiable sin conexión para consultas, estados y cola diferida, además de coordinar de forma limpia los ciclos de sincronización, reintentos y estados de carga cuando regrese la red. | Mayor gestión a la resolución de conflictos cuando un dato cambia tanto en local como en el servidor, tratando de mantener migraciones de esquema en SQLite sin pérdida de datos además de que la base local con la del servidor no muestren estados distintos. |
| SQLite | Emily Pazmiño | Es ligero y sostenible, permitiendo que sea sencillo de implementar en React Native, y mantener los datos guardados para cuando no se tenga una conexión activa y recuperarlos cuando se recupere la conexión. | Se requiere una sincronización manual. |

## Decisión

USAR SQLite CON ESTADOS LOCALES Y SINCRONIZACIÓN POR MEDIO DE UN WORKER DE 2 FASES (expo-sqlite, expo-file-system, NetInfo, Estados)

## Consecuencias

Que el trabajo del veedor es mayor porque el OCR es automático, pero la validación siempre es manual.

Se tiene que realizar la sincronización en 2 fases de forma obligatoria.
