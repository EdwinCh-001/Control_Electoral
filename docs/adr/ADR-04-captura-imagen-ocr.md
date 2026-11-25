# ADR-04: Captura Fotográfica, Detección local de Nitidez y Extracción OCR con IA

## Requerimientos relacionados

RF-07, RF-08, RF-09, RF-10, RF-11, RNF-01, RNF-04, S-06

## Contexto

En elecciones pasadas había actas que resultaron borrosas o ilegibles y muchos veedores son adultos mayores con poca experiencia digital, la app debe validar localmente que la foto sea nítida y luego extraer los campos numéricos del acta mediante IA en formato JSON estructurado, permitiendo null en campos poco claros para autocompletar el formulario y facilitar la revisión humana.

## Alternativas consideradas

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
|---|---|---|---|
| Expo-camera, expo-image-manipulator, jpeg-js | Bryan Rodrigo Salvador Martinez | Invalida si la nitidez no es suficiente de forma 100% offline antes de guardarla, envía la imagen optimizada en base 64 a Gemini, que responde con un JSON tipado con nullable: true. | Requiere conexión a internet para ejecutar la extracción de Gemini |
| Expo-image-picker + expo-image-manipulator | Edwin Chusin | Integración con rápida configuración, además de permitir recortar, rotar, redimensionar y ajustar la imagen para únicamente el documento para el procesamiento OCR. | Se orienta tanto seleccionar imágenes desde la galería, lo cual no menciona el enunciado 3.3 e invocar la cámara nativa, además de que este solo permite ajustar o redimensionar, pero no devolver nitidez real a caracteres legibles. |
| Google ML Kit OCR + validación de calidad | Emily Pazmiño | Permite extraer números y texto de la fotografia | Gran complejidad para implementarla |

## Decisión

EXPO-CAMERA, EXPO-IMAGE-MANIPULATOR, JPEG-JS

## Consecuencias

Se ahorra tiempo al usar el OCR y una correcta verificación al implementar la validación de nitidez.
