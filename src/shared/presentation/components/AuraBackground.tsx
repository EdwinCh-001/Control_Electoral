import { View, useWindowDimensions } from "react-native";
import {
  Defs,
  Ellipse,
  RadialGradient,
  Stop,
  Svg,
} from "react-native-svg";

import { colors } from "../theme";

export function AuraBackground() {
  const { width, height } = useWindowDimensions();
  const viewBox = `0 0 ${width} ${height}`;

  return (
    <View pointerEvents="none" className="absolute inset-0">
      <Svg
        height="100%"
        width="100%"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <RadialGradient id="purpleAura" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={colors.primarySoft} stopOpacity={0.34} />
            <Stop offset="65%" stopColor={colors.primarySoft} stopOpacity={0.075} />
            <Stop offset="100%" stopColor={colors.primarySoft} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="yellowAura" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.12} />
            <Stop offset="65%" stopColor={colors.accent} stopOpacity={0.035} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={width * 0.24}
          cy={height * 0.3}
          fill="url(#purpleAura)"
          rx={width * 0.78}
          ry={height * 0.44}
        />
        <Ellipse
          cx={width * 0.88}
          cy={height * 0.72}
          fill="url(#yellowAura)"
          rx={width * 0.8}
          ry={height * 0.42}
        />
      </Svg>
    </View>
  );
}
