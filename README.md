# Control Electoral

Aplicacion movil React Native para apoyar el registro y seguimiento de actas electorales. La arquitectura objetivo es Clean Architecture, organizada por flujos funcionales completos.

## Documentacion

- [AGENTS.md](./AGENTS.md): reglas breves de arquitectura y trabajo.
- [Requerimientos](./docs/requirements/): requerimientos funcionales, no funcionales y supuestos.
- [ADR](./docs/adr/): siete decisiones tecnicas acordadas.
- [Features FDD](./docs/features/): encargos completos y criterios de aceptacion.
- [Estado FDD](./docs/status.md): orden y estado de las features.
- [Configuracion de Supabase](./supabase/README.md): migracion inicial y pasos manuales.

## Desarrollo y entrega

Expo Go se usara para probar los recorridos habituales durante el desarrollo. La entrega Android sera un APK generado con EAS. Crashlytics y el comportamiento nativo en segundo plano deben validarse con ese APK, ya que Expo Go no permite comprobarlos completamente.

La aplicacion movil usa React Navigation y Supabase Auth. La recuperacion de contrasena se sirve desde la app web independiente en `web/`; sus variables y dominio de Vercel se configuran por separado.

Comandos de validacion previstos:

```bash
npx expo lint
npx tsc --noEmit
npm --prefix web run build
```
