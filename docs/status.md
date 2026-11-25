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
- FEAT-05 quedó **Implementada** en tablero, detalle y configuración de APK; Crashlytics sigue **Pendiente** y no se marca **Verificada**.
- ADR-07 quedó implementado con `src/global.css`, `metro.config.js` con `withUniwindConfig`, `@gorhom/bottom-sheet`, `lottie-react-native`, Reanimated, Lucide y la paleta ADN-7. `GestureHandlerRootView` ya estaba presente para Bottom Sheet.
- Las dependencias nativas y la validación con APK de EAS siguen en FEAT-05. No se marcan flujos como verificados por este cambio de infraestructura.
- El coordinador de recinto se asigna únicamente al crear su cuenta; el coordinador provincial solo consulta esa asignación. El coordinador de recinto crea sus mesas y administra la asignación/reemplazo de veedores después del registro.

## Auditoría del 2026-11-25

- FEAT-05 quedó **Implementada**: tablero provincial con agregación pura, detalle de acta con fotografía, coordenadas y mapa Leaflet/OpenStreetMap en WebView, suscripción Realtime y configuración `eas.json` para APK. Crashlytics quedó fuera del runtime según la decisión posterior del equipo.
- Solo se usó lo decidido en los ADR: Supabase, SQLite/NetInfo, Redux/arquitectura limpia, cámara/imagen/Gemini vía Edge Function, `expo-location` + WebView y React Navigation + Bottom Sheet + Reanimated + Lottie + Uniwind. EAS es el medio de entrega ya citado en ADR-06/RNF-04.
- No se agregó Sentry, NativeWind, proveedor de mapas adicional a OpenStreetMap, proveedor SMTP ni modelo de Gemini.
- **Pendiente de verificación manual:** comprobar el aislamiento RF-12 con varios roles, generar/instalar el APK de EAS y ejecutar el recorrido completo en Android. Firebase Crashlytics no se reactivará hasta que el usuario complete su verificación; por eso FEAT-05 no se marca como **Verificada**.
- El mapa del detalle usa Leaflet y mosaicos de OpenStreetMap en WebView; marca las coordenadas propias, sin geocodificar direcciones ni usar API key. La advertencia GPS de S-02 se muestra pero no bloquea la revisión.
- No se incluye `google-services.json`: Crashlytics está en pausa y no se inventó configuración secreta. El comando previsto para el APK sigue siendo `npx eas-cli build --platform android --profile preview`; el archivo Firebase se pedirá solo cuando se reactive la observabilidad.
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

## Alta de mesas, Lottie, Uniwind y flow-lines del 2026-11-25

- El coordinador de recinto crea las mesas de su recinto desde la pestaña **Nueva mesa**; el coordinador provincial solo crea recintos y coordinadores. Se registró el supuesto S-07 y se amplió FEAT-02 con este criterio.
- `create_polling_station` valida en Supabase rol, asignación al recinto, número positivo, sexo y unicidad. La migración `0007` retira el insert directo de `polling_stations` a `authenticated` y otorga ejecución solo de la función; no se aplicó sobre producción.
- `TerritoryRepository.createStation` y su implementación Supabase exponen el alta al dominio sin acoplarlo a Supabase. La UI solo ofrece el alta al rol `precinct_coordinator`.
- Se integraron animaciones Lottie ADN-7 locales en el estado de carga global, las fases de arranque y los avisos de éxito, advertencia y error sin modificar los textos ni la jerarquía visual.
- La migración a Uniwind quedó completa: no existe `StyleSheet.create` en `src/`; los estilos estáticos son `className` y los valores dinámicos siguen en `style` inline. Los tokens de ADN-7, tipografías y radios viven en `src/global.css`.
- El fondo global de flow-lines se monta en la raíz y en `Screen` con líneas suaves en morado/amarillo, `pointerEvents="none"` y sin opacar tarjetas ni texto.
- Pasan `npx tsc --noEmit`, `npx expo lint` y `npx expo export --platform android`. Sigue pendiente el recorrido manual en Expo Go, además de aplicar la migración `0007` en desarrollo con respaldo previo. Crashlytics continúa en pausa a la espera de la verificación del usuario.

## Estados

- **Pendiente:** no se ha iniciado.
- **En curso:** se implementa el flujo completo.
- **Implementada:** los criterios y pruebas automatizadas disponibles pasan.
- **Verificada:** ademas se completo la prueba manual en Expo Go o APK, segun corresponda.
