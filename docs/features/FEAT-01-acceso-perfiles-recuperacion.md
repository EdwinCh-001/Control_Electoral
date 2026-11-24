# FEAT-01: Acceso, perfiles y recuperacion

**Estado:** Implementada
**Depende de:** Base limpia  
**Requerimientos:** RF-01, RF-02, RF-03, RF-12, RNF-02  
**ADR:** ADR-01, ADR-03, ADR-07  
**Supuestos:** S-05

## Encargo para la IA

Implementa el flujo de acceso completo por rol y el ciclo de cuenta. Migra la navegacion inicial de Expo Router a React Navigation. Integra Supabase Auth y la creacion autorizada de cuentas mediante Edge Functions; conserva la sesion con `expo-secure-store`. Crea una aplicacion React/Vite independiente en `web/` para recuperacion, preparada para Vercel.

## Criterios de aceptacion

- No existe registro publico. El coordinador provincial puede crear coordinadores de recinto y estos pueden crear veedores de su recinto.
- Se validan los campos requeridos y se completa confirmacion de correo, clave temporal y cambio obligatorio en el primer acceso.
- El usuario puede recuperar la clave por correo y completar el flujo en la web, regresando a un estado util para la app.
- Se puede iniciar/cerrar sesion, restaurar la sesion segura y llegar a la interfaz correspondiente al rol.
- Credenciales incorrectas, correo sin confirmar y accesos no autorizados muestran errores comprensibles.
- La clave privilegiada de Supabase nunca se incluye en el cliente.

## Verificacion

Pasaron `npx tsc --noEmit`, `npx expo lint`, el bundle Android de produccion y el build de `web/`. Las Edge Functions `create-account` y `complete-password-change` estan desplegadas; se comprobo la creacion de una cuenta de coordinador de recinto y su asignacion desde la app. La clave temporal es un codigo de seis digitos que se debe reemplazar en el primer acceso.

El usuario aprobo marcar FEAT-01 como **Verificada** mientras continua las pruebas del proyecto Supabase. Las verificaciones externas y el despliegue de recuperacion se completan en ese entorno; no se afirma que se hayan ejecutado desde este espacio.
