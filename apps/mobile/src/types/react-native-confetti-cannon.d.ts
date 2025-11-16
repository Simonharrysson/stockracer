declare module "react-native-confetti-cannon" {
  import type { ComponentType } from "react";
  import type { ViewProps } from "react-native";

  type ConfettiCannonProps = ViewProps & {
    autoStart?: boolean;
    count?: number;
    fadeOut?: boolean;
    origin?: { x: number; y: number };
    explosionSpeed?: number;
    fallSpeed?: number;
    onAnimationEnd?: () => void;
  };

  const ConfettiCannon: ComponentType<ConfettiCannonProps>;
  export default ConfettiCannon;
}
