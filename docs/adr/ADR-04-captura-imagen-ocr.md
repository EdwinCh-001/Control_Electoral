# ADR-04: Captura de imagen, nitidez y OCR

**Estado:** Aceptado

## Requerimientos relacionados

RF-07, RF-08, RF-09, RF-10, RF-11, RNF-01, RNF-04, S-06.

## Contexto

Se acordaron herramientas de captura y procesamiento local de imagen, junto con OCR asistido por Gemini.

## Stack y decision

- `expo-camera` para captura.
- `expo-image-manipulator` para procesamiento de imagen.
- `jpeg-js` para procesamiento local asociado a la nitidez.
- Gemini para OCR, invocado mediante Supabase Edge Functions.

## Ventajas y desventajas

- La captura y la evaluacion de nitidez se realizan localmente.
- Gemini permite extraer datos estructurados de la imagen.
- El OCR de Gemini requiere conectividad; el umbral de nitidez debe calibrarse con imagenes reales.

## Consecuencias

- La fotografia debe procesarse sin exponer la clave de Gemini en la app.
- El procesamiento OCR depende de la conectividad y de la funcion backend.
