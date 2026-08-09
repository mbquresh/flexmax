import React from "react";
import Svg, { Rect, Path } from "react-native-svg";
import { useTheme } from "../providers/ThemeProvider";

export const MARK_W = 442;
export const MARK_H = 545;

export function BrandMark({ size = 64 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={(size * MARK_W) / MARK_H} height={size} viewBox={`0 0 ${MARK_W} ${MARK_H}`}>
      {/* stem */}
      <Rect x={0} y={0} width={128} height={545} rx={64} fill={colors.menuBarBlue} />
      {/* top arm */}
      <Rect x={0} y={0} width={442} height={128} rx={64} fill={colors.menuBarBlue} />
      {/* middle bar, coral full width */}
      <Rect x={0} y={209} width={340} height={128} rx={64} fill={colors.menuBarCoral} />
      {/* ink segment: rounded left cap, flat right edge where it meets coral */}
      <Path
        d="M127,209 H64 A64,64 0 0,0 64,337 H127 Z"
        fill={colors.menuBarInk}
      />
    </Svg>
  );
}
