# ADR-03: Arquitectura de Software, Gestión de Estado Global y Validación de Formularios

## Requerimientos relacionados

F-02, RF-07, RF-09, RF-10, RF-11, RF-12, RNF-04, RNF-05

## Contexto

El proyecto exige organizar el código bajo clean architecture manteniendo coherencia sobre la separación de responsabilidades y asegurar fluidez en dispositivos Android. Así como mantener un control dentro de los formularios para las validaciones tanto en la creación de los usuarios como las reglas aritméticas de las actas.

## Alternativas consideradas

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
|---|---|---|---|
| Clean Architecture (Domain – Data – Infraestructure – Presentation), Zustand, React Hook Form, Zod | Bryan Rodrigo Salvador Martinez | Desacoplar reglas electorales en esquemas Zod reutilizables, entre dominio y presentación. React Hook Form evita re-renders por cada pulsación de tecla en formularios largos y zustant gestiona el estado global para las pantallas. | Requiere configurar resolvers y tipar estrictamente los formularios con datos nulleable para aceptar los datos provenientes de la inteligencia artificial. |
| Clean Architecture (Domain – Data – Infraestructure – Presentation), Redux Toolkit, React Hook Form, Zod | Edwin Chusin | Alto nivel de estandarización y herramientas maduras.Para el worker de 2 fases se permite reflejar y sincronizar ese estado operativo global en cualquier pantalla donde se encuentre el usuario sin la dependencia de estados locales. | Pide que la implementación sea más estricta para estados intermedios que puede llegar a ser innecesaria. Además de riesgo de sobre ingeniería que podría dificultar mantener y depurar el proyecto. |
| Clean Architecture | Emily Pazmiño | Permite tener desacoplamiento de la lógica de negocio y dar mentenimiento sencillo a largo plazo | Se necesita mayor tiempo inicial de desarrollo |

## Decisión

CLEAN ARCHITECTURE, CON REDUX TOOLKIT, REACT HOOK FORM Y ZOD, PARA EL MANEJO DE ESTADOS Y FORMULARIOS

## Consecuencias

Se gana que se tienen reglas estrictas del estado de globalización, pero es obligatorio regirnos a su implementación estricta.
