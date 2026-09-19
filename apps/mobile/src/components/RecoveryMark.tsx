import React from "react";
import { Image } from "react-native";

const SOURCE = require("../../assets/swoosh.png");
/** Asset is 737×261 — wide mark, not square. */
const ASPECT = 737 / 261;

/** Forward-motion mark for the miss → recover transition. Tint to theme. */
export function RecoveryMark({
  size = 28,
  color,
}: {
  /** Width in px; height follows the asset aspect. */
  size?: number;
  color: string;
}) {
  return (
    <Image
      source={SOURCE}
      accessibilityLabel="Recover"
      resizeMode="contain"
      style={{
        width: size,
        height: size / ASPECT,
        tintColor: color,
      }}
    />
  );
}
