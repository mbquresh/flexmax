import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { CheckEngineIcon } from "./CheckEngineIcon";
import { insightTone } from "../lib/insightTone";
import { TheorySectionKind } from "../lib/theory";
import { Colors } from "../theme";

/** Same marks as the Today report strip. Vector, not emoji — Apple Color Emoji clips in a sized box. */
export function TheoryKindMark({
  kind,
  colors,
  size = 20,
}: {
  kind: TheorySectionKind;
  colors: Colors;
  size?: number;
}) {
  const tone = insightTone(kind, colors);
  if (kind === "structural") {
    return <CheckEngineIcon size={size} color={tone.ink} />;
  }
  if (kind === "causal") {
    return (
      <View
        style={[
          styles.slip,
          {
            width: Math.round(size * 0.45),
            height: Math.round(size * 0.45),
            backgroundColor: tone.stripe,
          },
        ]}
        accessibilityElementsHidden
      />
    );
  }
  return (
    <View accessibilityElementsHidden>
      <Feather
        name={kind === "strength" ? "check-circle" : "alert-triangle"}
        size={size}
        color={tone.ink}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slip: {
    borderRadius: 2,
  },
});
