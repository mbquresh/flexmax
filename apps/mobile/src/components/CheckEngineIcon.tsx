import React from "react";
import { Image } from "react-native";

const SOURCE = require("../../assets/check-engine.png");
const ASPECT = 238 / 154;

/** The dashboard MIL glyph. Color is the signal — never redraw it. */
export function CheckEngineIcon({
  size = 20,
  color,
}: {
  size?: number;
  color: string;
}) {
  return (
    <Image
      source={SOURCE}
      accessibilityLabel="Check engine"
      resizeMode="contain"
      style={{
        width: size,
        height: size / ASPECT,
        tintColor: color,
      }}
    />
  );
}
