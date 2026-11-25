# Control Electoral

Aplicacion movil Expo/React Native para registrar y consultar actas electorales. La documentacion del proyecto esta en espanol; el codigo, nombres de archivos y simbolos tecnicos van en ingles.

## Fuentes de verdad

- `docs/requirements/`: requerimientos funcionales, no funcionales y supuestos.
- `docs/adr/`: las siete decisiones tecnicas acordadas. No introducir herramientas o decisiones nuevas fuera de ellas.
- `docs/features/`: alcance, criterios y encargo ejecutable de cada feature FDD completa.
- `docs/status.md`: indice ordenado y estado de las features.
- `supabase/migrations/`: esquema y politicas SQL; aplica las instrucciones de `supabase/README.md`.

Si una regla funcional no esta definida en esos documentos, no la inventes; deja constancia y consulta antes de implementarla.

## Arquitectura

- Organiza el codigo por funcionalidades completas en `src/features/<feature>/`, cada una con `domain/`, `data/`, `infrastructure/` y `presentation/` cuando aplique.
- `domain/` contiene entidades, reglas y casos de uso; no depende de React Native, Supabase, SQLite ni servicios del dispositivo.
- `data/` implementa repositorios y mapeos; `infrastructure/` adapta los servicios externos y del dispositivo; `presentation/` contiene pantallas, formularios y estado de interfaz.
- `src/app/` contiene la configuracion y los navegadores de React Navigation, no reglas de negocio.
- `src/shared/` es solo para codigo genuinamente compartido. No conviertas cada componente o tarea pequena en una feature.
- Usa Redux Toolkit para el estado global acordado; conserva el estado local de interfaz en la pantalla cuando sea suficiente. Formularios: React Hook Form y Zod.
- Las dependencias apuntan hacia `domain/`; las implementaciones externas no se importan desde el dominio.

## Forma de trabajo

- Implementa un flujo vertical completo leyendo su ficha en `docs/features/`, incluyendo interfaz, dominio, persistencia/integraciones y pruebas pertinentes. No dividas el trabajo en fichas Markdown por microtareas.
- Mantén cada ADR en su alcance: contexto tecnico, stack/decision, ventajas o limitaciones y consecuencias. La logica funcional pertenece a requerimientos y supuestos.
- No inventes provincia, canton, candidatos, colores, proveedor de mapas, proveedor SMTP ni modelo/version de Gemini.
- No incluyas claves privadas, `service_role`, tokens ni datos personales en la app o en logs.
- Nunca ejecutes una migracion sobre produccion sin haberla probado en desarrollo y respaldado la base.
- Expo Go se usa para recorridos habituales. Valida Crashlytics y el comportamiento nativo de segundo plano con un APK de EAS; Android puede posponer tareas de fondo.
- No edites `android/` o `ios/` manualmente. Antes de usar una API nativa, consulta la documentacion compatible con la version instalada de Expo.

## Guias de diseño

- Las guias de diseño y accesibilidad estan en `.github/skills/`. Son documentacion de apoyo: no son dependencias de la app ni cambian los ADR.
- Consulta `.github/skills/README.md` antes de cambiar interfaz. La paleta oficial ADN-7 esta definida alli y en `src/global.css`.

## Verificacion

```bash
npx expo lint
npx tsc --noEmit
```

Prueba los recorridos de aceptacion de la feature y actualiza `docs/status.md`. No marques un flujo como verificado sin completar las pruebas definidas.
