# ADR-07: Navegacion y retroalimentacion visual

**Estado:** Aceptado

## Requerimientos relacionados

RF-01 a RF-13, RNF-04.

## Contexto

Se acordo un stack de navegacion y presentacion que permita una interfaz clara y retroalimentacion visual consistente.

## Stack y decision

- React Navigation.
- `@gorhom/bottom-sheet`.
- `lottie-react-native`.
- `react-native-reanimated`.
- Uniwind.

## Ventajas y desventajas

- Permite combinar navegacion movil, hojas interactivas y animaciones con estilos compartidos.
- Bottom Sheet depende de la configuracion correcta de Gesture Handler y Reanimated.
- Las animaciones y estilos deben usarse con moderacion para preservar rendimiento y legibilidad.

## Consecuencias

- La plantilla Expo Router se sustituye por React Navigation.
- La combinacion de Bottom Sheet y animaciones requiere configuracion nativa compatible y puede afectar rendimiento si se usa en exceso.
