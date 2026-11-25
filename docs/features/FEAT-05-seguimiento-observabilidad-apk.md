# FEAT-05: Seguimiento, observabilidad y APK

**Estado:** Implementada (observabilidad desactivada temporalmente)
**Depende de:** FEAT-01 a FEAT-04  
**Requerimientos:** RF-12, RF-13, RNF-02, RNF-03, RNF-04  
**ADR:** ADR-01, ADR-05, ADR-06, ADR-07  
**Supuestos:** S-02

## Encargo para la IA

Implementa el flujo del coordinador provincial para seguir el escrutinio y auditar ubicaciones; completa la observabilidad acordada y prepara la entrega Android por EAS.

## Criterios de aceptacion

- El tablero muestra mesas reportadas/faltantes por recinto y acumulados por candidatura y dignidad, por recinto y canton.
- El detalle permite revisar acta, fotografia y ubicacion; las advertencias respetan S-02 y no bloquean el envio.
- Se verifica el aislamiento de datos de RF-12 con usuarios de diferentes roles y jurisdicciones.
- Se provoca un fallo controlado no fatal y se verifica su reporte en Firebase Crashlytics, sin secretos ni datos personales.
- Se genera e instala un APK EAS y se comprueba un recorrido funcional completo en Android.

## Verificacion

Comparar los datos del tablero con actas de prueba conocidas, verificar los permisos de acceso, observar el reporte del fallo de prueba y probar el APK en un dispositivo.

## Notas de implementacion

- El tablero agrega solo actas enviadas. Una mesa se cuenta como reportada cuando tiene sus dos actas (alcaldía y prefectura).
- El mapa provincial y el detalle usan Leaflet dentro de WebView, con mosaicos de OpenStreetMap y marcadores calculados a partir de las coordenadas registradas. No se realiza geocodificación ni se requiere API key.
- Crashlytics se retiró temporalmente del runtime y de `package.json` para que Expo Go arranque sin módulos nativos de Firebase. El contrato `CrashReporter` se conserva y `src/shared/infrastructure/CrashReporter.ts` exporta `noopCrashReporter`.
- Se retiró el botón **Verificar reporte de fallos** y su Bottom Sheet de prueba de la pantalla de inicio.
- Para reactivar la observabilidad se deben reinstalar `@react-native-firebase/app` y `@react-native-firebase/crashlytics`, agregar sus plugins en `app.json`, colocar `google-services.json` del proyecto Firebase del equipo y ejecutar `npx eas-cli build --platform android --profile preview`. No se generó ni se inventó ese archivo.
- La verificación de Crashlytics y del APK queda pendiente hasta completar esa reactivación.
- No se marca como **Verificada** hasta completar los cuatro puntos de verificación manual anteriores.
