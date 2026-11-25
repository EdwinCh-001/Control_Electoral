# Estado FDD

Cada feature es un flujo vertical completo, no una microtarea. Ejecutalas en orden; abre solo la ficha de la feature que la IA va a implementar. Para iniciar una, envia: **“Implementa completa FEAT-XX segun `docs/features/FEAT-XX-....md`.”**

La IA debe leer `AGENTS.md`, esa ficha y solo los requerimientos, supuestos y ADR citados. Debe revisar el codigo existente, implementar y probar el flujo completo, no agregar herramientas no aprobadas, informar bloqueos sin inventar datos/secretos, ejecutar `npx expo lint` y `npx tsc --noEmit`, e informar resultados. No agregar framework de pruebas sin autorizacion.

| Orden | Feature | Requerimientos | Depende de | Estado |
|---:|---|---|---|---|
| 1 | [FEAT-01: Acceso, perfiles y recuperacion](./features/FEAT-01-acceso-perfiles-recuperacion.md) | RF-01 a RF-03, RF-12, RNF-02 | Base limpia | Implementada |
| 2 | [FEAT-02: Territorio, asignaciones y reemplazos](./features/FEAT-02-territorio-asignaciones-reemplazos.md) | RF-04 a RF-06, RF-12 | FEAT-01 | Implementada |
| 3 | [FEAT-03: Captura, validacion y revision de actas](./features/FEAT-03-captura-revision-actas.md) | RF-07 a RF-10, RNF-01 | FEAT-01, FEAT-02 | Implementada |
| 4 | [FEAT-04: Sincronizacion, correcciones y auditoria](./features/FEAT-04-sincronizacion-correcciones-auditoria.md) | RF-10 a RF-12, RNF-01 a RNF-03 | FEAT-03 | Implementada |
| 5 | [FEAT-05: Seguimiento, observabilidad y APK](./features/FEAT-05-seguimiento-observabilidad-apk.md) | RF-12, RF-13, RNF-02 a RNF-04 | FEAT-01 a FEAT-04 | Implementada (Crashlytics en pausa) |

## Auditoría del 2026-11-24

- FEAT-01 a FEAT-04 siguen en **Implementada**: pasan `npx expo lint` y `npx tsc --noEmit`, pero todavía no se completaron los recorridos manuales en Expo Go/APK. No se marcan como **Verificada** hasta que el equipo execute las pruebas de cada ficha.
- FEAT-05 permanece **Pendiente**. No se implementó ni se verificó Crashlytics, el tablero provincial ni el APK de EAS.
- ADR-07 quedó preparado en la infraestructura: `src/global.css`, `metro.config.js` con `withUniwindConfig` y la importación desde `src/app/App.tsx`. `GestureHandlerRootView` ya estaba presente para Bottom Sheet. Faltan instalar `@gorhom/bottom-sheet`, `lottie-react-native`, `@lottiefiles/dotlottie-react` y `uniwind` con `tailwindcss`; la paleta de colores está pendiente y no se inventó ninguna.
- Las dependencias nativas y la validación con APK de EAS siguen en FEAT-05. No se marcan flujos como verificados por este cambio de infraestructura.
- El coordinador de recinto se asigna únicamente al crear su cuenta; la pantalla de territorio solo lo consulta. La asignación/reemplazo de veedores en mesas sí se administra después del registro.

## Auditoría del 2026-11-25

- FEAT-05 quedó **Implementada**: tablero provincial con agregación pura, detalle de acta con fotografía, coordenadas y mapa Leaflet/OpenStreetMap en WebView, suscripción Realtime, reporte de fallos con Firebase Crashlytics y configuración `eas.json` para APK.
- Solo se usó lo decidido en los ADR: Supabase, SQLite/NetInfo, Redux/arquitectura limpia, cámara/imagen/Gemini vía Edge Function, `expo-location` + WebView, Firebase Crashlytics y React Navigation + Bottom Sheet + Reanimated + Uniwind. `@react-native-firebase/app` y `@react-native-firebase/crashlytics` son el SDK de la decisión ADR-06; EAS es el medio de entrega ya citado en ADR-06/RNF-04.
- No se agregó Sentry, NativeWind, proveedor de mapas adicional a OpenStreetMap, proveedor SMTP ni modelo de Gemini.
- **Pendiente de verificación manual:** provocar el fallo controlado y confirmarlo en Firebase Crashlytics, comprobar el aislamiento RF-12 con varios roles, generar/instalar el APK de EAS y ejecutar el recorrido completo en Android. Por eso FEAT-05 no se marca como **Verificada**.
- El mapa del detalle usa Leaflet y mosaicos de OpenStreetMap en WebView; marca las coordenadas propias, sin geocodificar direcciones ni usar API key. La advertencia GPS de S-02 se muestra pero no bloquea la revisión.
- Falta el archivo `google-services.json` del proyecto Firebase del equipo para compilar el APK; no se inventó ni se incluyó configuración secreta. Con ese archivo, el comando es `npx eas-cli build --platform android --profile preview`.
- El intento de cargar el SDK de Firebase de forma diferida no fue suficiente en Expo Go: el runtime seguía resolviendo el módulo nativo `NativeRNFBTurboApp`. Por eso Crashlytics se retiró temporalmente del runtime y de las dependencias.

## Ajuste del 2026-11-25

- Crashlytics quedó desactivado temporalmente: se eliminaron `@react-native-firebase/app` y `@react-native-firebase/crashlytics` de `package.json`, y sus plugins de `app.json`.
- `src/shared/infrastructure/CrashReporter.ts` exporta `noopCrashReporter`; ya no se importa Firebase desde la aplicación.
- Se retiró de la pantalla de inicio el botón **Verificar reporte de fallos** y su Bottom Sheet de prueba.
- FEAT-05 conserva el tablero provincial, el detalle de acta y `eas.json`, pero la observabilidad queda pendiente de reactivación para el APK de EAS.
- Las guías de diseño se instalaron en `.github/skills/` como documentación del agente. No son dependencias de la app ni cambian los ADR.

## Rediseño visual del 2026-11-25

- Se aplicó la paleta ADN-7 (`#FFFFFF`, `#F7F5FA`, `#E2DCEB`, `#5B2384`, `#431763`, `#7A3FB0`, `#E6E73A`, `#F2F02E`, `#9E8B00`) en `src/shared/presentation/theme.ts` y `src/global.css`, con fondo claro y proporción 30% blanco / 50% morado / 20% amarillo.
- Se adoptaron iconos `lucide-react-native` en acciones, formularios, avisos, estados de revisión y progreso; ADR-07 quedó actualizado con la decisión.
- Se recortó el texto saturado de inicio, acceso, tablero, detalle, historial, territorio y cuentas; las tarjetas de acción muestran icono, título corto y una frase breve.
- Se corrigió la ruta del coordinador de recinto: ahora entra a **Equipo** (mesas y veedores) en lugar de una pantalla provincial no registrada para su rol.
- Se evitó el ciclo de reprocesamiento en `ActaListScreen`: la cola de OCR/envíos se procesa al entrar y al recuperar red, no desde la suscripción que refresca la lista.
- Se elevó el nivel del logger de Reanimated a `error`: los avisos de `@gorhom/bottom-sheet` usan `warnOnce`, que ignora `strict`, y saturaban la consola; los errores reales siguen visibles.
- Los estados `null` se muestran en ámbar oscuro (`#9E8B00`) como **Revisión**; los `0` confirmados se muestran en morado fuerte (`#431763`). En el editor, el campo vacío dice **Sin dato**.
- Los errores técnicos ya no son el mensaje principal: `messages.ts` los convierte en instrucciones claras y deja el texto original en **Ver detalle técnico** para soporte.
- Se actualizaron nombre visible, icono, splash, favicon e iconos Android con la identidad ADN-7.
- `npx tsc --noEmit`, `npx expo lint` y `npx expo export --platform android` pasan; `npx expo-doctor` marca 20/20. Falta el recorrido visual en Expo Go antes de marcar los flujos como **Verificada**.

## Mapa geográfico y respaldo relativo

- ADR-05 quedó actualizado: el mapa principal usa Leaflet y mosaicos de OpenStreetMap dentro del WebView del SDK de Expo (`@expo/dom-webview`), sin claves ni API key y con la atribución del proveedor.
- Se usa `@expo/dom-webview` en lugar de `react-native-webview` para evitar el doble registro nativo `RNCWebView` que aparecía durante Fast Refresh en Expo Go.
- `src/shared/presentation/components/GeoMap.tsx` decide entre el mapa real y `RelativeMap`: con red carga Leaflet/OSM; sin conexión, o si los mosaicos no cargan, muestra el mapa relativo con `react-native-svg`.
- Los tres usos (`ActaLocationCard`, `ProvincialLocationReviewScreen` y `ProvincialActaMap`) pasaron a `GeoMap`, por lo que el mapa real aparece también tras tomar la foto.
- En el detalle del acta, `ActaRepository.getLocationReference` lee desde SQLite la referencia cacheada del recinto. Cuando difiere de la captura, se dibujan ambos puntos y una línea punteada; si coinciden, se muestra solo la captura.
- El `viewBox` del respaldo se mide con `onLayout`: la rejilla ocupa todo el ancho disponible y las áreas táctiles coinciden con los marcadores.
- Tras este ajuste pasan `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform android` y `npx expo-doctor` 20/20; falta el recorrido manual en Expo Go para marcarlo como verificado.

## Ajustes de interfaz del 2026-11-25

- `ActaListScreen` abre **Registrar acta** sin cargas simultáneas: una sola carga inicial, recargas agrupadas por notificaciones y el primer estado de red no dispara una segunda carga. Las mesas cacheadas se muestran antes de consultar la red.
- Los accesos rápidos del inicio quedaron más arriba. **Registrar veedor** aparece como acción visible para el coordinador de recinto, tanto en el inicio como en **Equipo**, sin iconos de acción junto al título.
- El coordinador provincial crea coordinadores de recinto en dos pasos: datos de la persona y luego recinto libre. El veedor se registra en un solo paso; sus mesas se asignan después desde **Equipo**.
- El formulario de acceso quedó ligeramente más abajo y la contraseña se puede mostrar u ocultar en inicio de sesión y cambio de clave.
- Pasan `npx tsc --noEmit`, `npx expo lint` y `npx expo export --platform android`. Sigue pendiente el recorrido manual en Expo Go, por lo que ningún flujo se marca como **Verificada**.

## Estados

- **Pendiente:** no se ha iniciado.
- **En curso:** se implementa el flujo completo.
- **Implementada:** los criterios y pruebas automatizadas disponibles pasan.
- **Verificada:** ademas se completo la prueba manual en Expo Go o APK, segun corresponda.
