# ADR-01: Plataforma Backend, Autenticación y Seguridad de Datos

## Requerimientos relacionados

RF-01, RF-02, RF-03, RF-04, RF-09, RF-10, RNF-02, S-05

## Contexto

La organización necesita gestión estricta de usuarios sin auto registro, verificación de correo electrónico, cambio obligatorio de clave inicial, recuperación autónoma de contraseña y aislamiento estricto de datos por rol, almacenamiento de fotografías de actas y actualización en tiempo real de Exit Poll.

## Alternativas consideradas

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
|---|---|---|---|
| Supabase (PostgreSQL, Auth, Storage, RealTime)Expo-secure-storage | Bryan Rodrigo Salvador Martínez | Bases de datos relacionales real para jerarquías, políticas de seguridad nativas para aislar datos por rol, verificación de correo y recuperación de clave integradas, realTime para datos de Exit Poll. Expo-secure-storage para la persistencia del JWT. | Requiere un diseño cuidadoso para políticas RLS y funciones para la creación de usuarios sin cerrar la sesión del coordinador. |
| Appwrite | Edwin Chusin | De código abierto con autenticación, base de datos, almacenamiento y es auto hospedable, todo lo mencionado en un solo producto, además acelera el desarrollo de aplicaciones web y móviles | Los permisos se asignan documento por documento al momento de crearlo de modo que la jerarquía depende del código y no de la base. Se debe de pagar para funcionalidades de PostgreSQL. Menor ecosistema, documentación y comunidad |
| Supabase | Emily Pazmiño | Acceso a una base de datos relacional, permite la verificación por correo, tiene Auth integrado | Requiere configurar manualmente las políticas RLS |

## Decisión

SUPABASE CON FUNCIONALIDADES NATIVAS DE LA MISMA

## Consecuencias

Ganamos el tiempo de desarrollo debido a un correcto manejo de este sistema y facilidad de integrar el SMTP de correo, junto con las funcionalidades de almacenamiento y API Rest.

Si no se utiliza un SMTP Propio no se puede enviar demasiados correos, impidiendo el correcto funcionamiento de la aplicación.

Configurar las Políticas RLS para las tablas, storage y demás funciones.
