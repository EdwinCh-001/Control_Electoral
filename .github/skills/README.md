# Skills de diseño

Estas guías son documentación de apoyo para el agente. No son dependencias de la aplicación, no se importan desde el código y no modifican las decisiones de ADR-01 a ADR-07.

## Skills instaladas

### Diseño visual, interfaz y sistemas

- `frontend-design`: dirección visual intencional y ruptura de diseños genéricos.
- `ui-design`: diseño mobile-first y fundamentos de interfaz.
- `jakubkrehel/*`: colección completa de 16 skills de Jakub Krehel, con sus archivos de referencia:
  - `better-accessibility`, `better-colors`, `better-interface`, `better-layout`
  - `better-motion`, `better-typography`, `better-ui`, `better-writing`
  - `build-design`, `interface-review`, `explain-interface`, `state-machine`
  - `afk`, `break`, `upskill`, `variant`

### Accesibilidad y contraste

- `accessibility-compliance`: WCAG 2.2, contraste, lectores de pantalla y patrones ARIA.
- `semoss-accessibility`: revisión de accesibilidad para interfaz. Sus enlaces internos apuntan al repositorio original de SEMOSS porque su código y contratos de diseño no aplican a esta app.
- `jakubkrehel/better-accessibility`: foco, áreas táctiles y movimiento reducido.

### Móvil y Android

- `react-native-design`: patrones de navegación, estilos y Reanimated para React Native.
- `android-ui-foundations`: fundamentos de interfaz Android.
- `android-ui-layout-content`: composición y contenido adaptable.
- `android-ui-patterns`: navegación, historial y gestos de Android.

## Fuentes

- Anthropic Frontend Design: https://github.com/anthropics/skills/tree/main/skills/frontend-design
- Jakub Krehel Skills: https://github.com/jakubkrehel/skills
- Accessibility Compliance (wshobson): https://github.com/wshobson/agents/blob/main/plugins/ui-design/skills/accessibility-compliance/SKILL.md
- Accessibility Skill (SEMOSS): https://github.com/SEMOSS/semoss-ui/blob/dev/skills/accessibility.skill.md
- React Native Design (wshobson): https://github.com/wshobson/agents/blob/main/plugins/ui-design/skills/react-native-design/SKILL.md
- Android UI Foundations (Sergio-CVM00): https://github.com/Sergio-CVM00/android-design-skills/blob/main/skills/android-ui-foundations/SKILL.md
- UI Design Mobile-First (Mindrally): https://github.com/mindrally/skills/blob/main/ui-design/SKILL.md

## Paleta ADN-7 / Control Electoral

Proporción sugerida: 30% blanco, 50% morado, 20% amarillo.

| Grupo | Token | Valor | Uso |
|---|---|---|---|
| Blanco | Fondo principal | `#FFFFFF` | Fondo general, legibilidad con sol y ahorro de batería |
| Blanco | Superficie clara | `#F7F5FA` | Tarjetas y superficies secundarias |
| Blanco | Borde sutil | `#E2DCEB` | Divisores y bordes sobre fondo claro |
| Morado | Primario / ADN | `#5B2384` | Botones principales, iconos activos, acento de marca |
| Morado | Texto fuerte | `#431763` | Títulos, textos clave y alto contraste |
| Morado | Morado suave | `#7A3FB0` | Badges, estados secundarios y hover |
| Amarillo | Acento principal | `#E6E73A` | Indicadores de paso, badges y acentos puntuales |
| Amarillo | Destacado | `#F2F02E` | Acentos breves y muy localizados |
| Amarillo | Ámbar de apoyo | `#9E8B00` | Texto y bordes legibles sobre blanco; campos en revisión o pendientes |

Reglas:

- Usar `#FFFFFF` como fondo general y reservar el amarillo para cerca del 20% del peso visual.
- Usar `#5B2384` y `#431763` para títulos, botones primarios, iconos activos y texto de alto contraste.
- Usar `#9E8B00` para marcar `null`, revisión o pendiente sobre fondo claro, sin confundirlo con un `0` confirmado.
- Distinguir visualmente `null` (revisión en ámbar) de `0` (valor confirmado en morado fuerte).
- Evitar degradados, sombras difusas y tarjetas decorativas sin función.
- Usar iconos de Lucide para reforzar la acción de cada control y reducir texto.
