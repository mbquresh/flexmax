import { useFonts } from "expo-font";
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from "@expo-google-fonts/instrument-sans";
import { Text, TextInput } from "react-native";
import { fonts } from "../theme";

export const instrumentSansMap = {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
};

/** Load Instrument Sans. Call once from the root layout. */
export function useInstrumentSans() {
  return useFonts(instrumentSansMap);
}

/**
 * Default every Text / TextInput to Instrument Sans Regular so screens that
 * never touch a typography token still match the showcase. Weight-specific
 * styles must set fontFamily themselves (see `fonts` in theme.ts) — pairing
 * fontWeight with a custom family is unreliable on Android.
 */
export function applyInstrumentSansDefaults() {
  const text = Text as typeof Text & {
    defaultProps?: { style?: object };
  };
  const input = TextInput as typeof TextInput & {
    defaultProps?: { style?: object };
  };

  text.defaultProps = {
    ...text.defaultProps,
    style: [{ fontFamily: fonts.regular }, text.defaultProps?.style],
  };
  input.defaultProps = {
    ...input.defaultProps,
    style: [{ fontFamily: fonts.regular }, input.defaultProps?.style],
  };
}
