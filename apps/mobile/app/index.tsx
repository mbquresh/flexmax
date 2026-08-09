import { useMemo } from "react";
import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useAuth } from "../src/providers/AuthProvider";
import { useTheme } from "../src/providers/ThemeProvider";
import { BrandLoader } from "../src/components/BrandLoader";
import { Colors } from "../src/theme";

export default function Index() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session, psychologyProfile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <BrandLoader size={56} />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;
  if (!psychologyProfile?.completed_at) return <Redirect href="/onboarding" />;

  return <Redirect href="/today" />;
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: "center",
      justifyContent: "center",
    },
  });
