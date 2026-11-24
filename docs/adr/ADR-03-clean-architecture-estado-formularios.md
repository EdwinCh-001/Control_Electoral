# ADR-03: Clean Architecture, estado y formularios

**Estado:** Aceptado

## Requerimientos relacionados

RF-01, RF-02, RF-03, RF-07, RF-09, RF-10, RF-11, RF-12, RNF-04.

## Contexto

La aplicacion requiere capas separadas, manejo de estado global y formularios con validaciones coherentes, sin acoplar las reglas de dominio a la interfaz o a los servicios externos.

## Stack y decision

- Clean Architecture: Domain, Data, Infrastructure y Presentation.
- Redux Toolkit para estado global.
- React Hook Form y Zod para formularios y validacion de entradas.

## Ventajas y desventajas

- Mantiene las reglas de dominio desacopladas y facilita probar cada responsabilidad.
- Redux Toolkit aporta una gestion de estado global estandarizada y modular.
- Su uso puede resultar estricto o excesivo para estados intermedios; debe limitarse al estado global necesario.
- React Hook Form evita renderizados innecesarios en formularios y Zod centraliza esquemas de validacion.

## Consecuencias

- Redux Toolkit, React Hook Form y Zod se aplican de forma coherente con las capas acordadas.
- Las reglas y los modelos del dominio no dependen de la interfaz ni de proveedores externos.
