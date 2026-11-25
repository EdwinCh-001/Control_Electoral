import LottieView, { type AnimationObject } from "lottie-react-native";
import type { StyleProp, ViewStyle } from "react-native";

import alertAnimation from "../assets/animations/alert.json";
import processingCircleAnimation from "../../../../assets/animations/processing-circle.json";
import successAnimation from "../assets/animations/success.json";

export type LottieIconName = "loading" | "success" | "alert";

const animations: Record<LottieIconName, AnimationObject> = {
  loading: processingCircleAnimation as AnimationObject,
  success: successAnimation as AnimationObject,
  alert: alertAnimation as AnimationObject,
};

export function LottieIcon({
  name,
  size = 28,
  loop,
  style,
}: {
  name: LottieIconName;
  size?: number;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LottieView
      autoPlay
      loop={loop ?? name === "loading"}
      resizeMode="contain"
      source={animations[name]}
      style={[{ height: size, width: size }, style]}
    />
  );
}
