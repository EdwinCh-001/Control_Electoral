# ADR-07: Diseño visual navegación por rol y retroalimentación de usuario

## Requerimientos relacionados

RF-01, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11, RF-12, RF-13, RNF-04, RNF-05

## Contexto

Muchos veedores son adultos mayores y con poca experiencia tecnológica debe haber una interfaz como un feedback visual claro para acciones en proceso exitosas fallidas y validaciones usando lottie y reanimated evitando modales genéricos y que sea intuitiva para el usuario

## Alternativas consideradas

| Alternativa | Propuesta por | Ventajas | Desventajas o limitaciones |
|---|---|---|---|
| React Navigation, @gorhom/bottom-sheet, lottie-react-native, react-native-reanimated, Sistema de Diseño propio | Bryan Rodrigo Salvador Martinez | Reemplazo total de alertas nativas mediante hojas interactivas de gorhom para confirmar actas, mostrar errores de cuadre matemático y visualizar el progreso de subida, animaciones vectoriales y gestos fluidos. | @gorhom/bottom-sheet depende de react-native-gesture-handler y react-native-reanimated, por lo que requiere envolver la app en <GestureHandlerRootView> correctamente. |
| Uniwind + Tailwind CSS v4 | Edwin Chusin | Diseñado para Tailwind v4, configuración moderna mediante Metro, mejor integración con Expo y experiencia de desarrollo alineada al ecosistema actual | Como librería independiente, no cubre por completo navegación por rol, hojas interactivas, ni animaciones, necesitaría complementarse con más herramientas. |
| Uniwind + lottie | Emily Pazmiño | Se enfoca en multiplataformas para su uso, permite tener escalabilidad. | Al combinarlos puede darse fricciones de rendimiento, mantenimiento de estilos |
| `lucide-react-native` para el sistema de iconos | Equipo de producto | Iconos vectoriales consistentes, ligeros y personalizables con los tokens de color ADN-7. | Añade `react-native-svg` como dependencia par; no sustituye a las animaciones de Reanimated. |

## Decision

REACT NAVIGATION, @GORHOM/BOTTOM-SHEET, LOTTIE-REACT-NATIVE, REACT-NATIVE-REANIMATED, UNIWIND, LUCIDE-REACT-NATIVE. La interfaz usa la paleta ADN-7 (blanco, morado y amarillo) definida en `.github/skills/README.md` y `src/global.css`.

## Consecuencias

Es tener una mayor gama de estilos, con interfaz más intuitiva para el usuario. La paleta ADN-7 y los iconos Lucide permiten menos texto en pantalla, conservando alto contraste y una identidad propia.
