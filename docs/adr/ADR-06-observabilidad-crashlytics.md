# ADR-06: Observabilidad y detección de fallos y reporte offline

## Requerimientos relacionados

RNF-01 a RF-13

## Contexto

En procesos anteriores la aplicación se cerraba sola sin dejar rastro del dispositivo ni de la pantalla donde ocurría el error, ahora la captura de errores como fallos al subir fotos o errores de extracción en el agente de IA, registran la versión de Android, el dispositivo y envían el reporte cuando haya conexión.

## Alternativas consideradas

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
|---|---|---|---|
| @sentry/react-native | Bryan Rodrigo Salvador Martinez | Captura automática de excepciones JavaScript y nativas, incluye caché offline nativa en disco para enviar reportes automáticamente al reconectarse registrando modelo de celular y versión de Android. | Requiere configurar el plugin de Sentry en app.json y el DSN del proyecto para compilar el APK. |
| Sentry (SDK para React Native) | Edwin Chusin | Capturas caídas de javascript y cierres inesperados que ocurren nativamente en Android.Los errores que no cierran la app (foto que no sube, envío que falla) se reportan manualmente con etiquetas: operación, pantalla, ID del acta. | Si no se depura etiquetas o un contexto adjunto se puede dar visibilidad a datos sensibles, perdiendo confidencialidad. También enviar demasiados errores incluyendo no fatales consumiría rápido la cuota del plan. |
| Firebase Crashlytics | Emily Pazmiño | Nos permite detectar, priorizar y solucionar fallos en la aplicación en tiempo real, para mejorar la experiencia del usuario. | Depende del ecosistema de Google |

## Decisión

FIREBASE CRASHLYTICS

## Consecuencias

Algunos pueden salir como no fatales pero muestran el log de donde se produjo
