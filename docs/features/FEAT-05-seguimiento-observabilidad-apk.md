# FEAT-05: Seguimiento, observabilidad y APK

**Estado:** Pendiente  
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
