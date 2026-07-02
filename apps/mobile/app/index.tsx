import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../src/providers/AuthProvider";
import { colors } from "../src/theme";

export default function Index() {
  const { session, psychologyProfile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;
  if (!psychologyProfile?.completed_at) return <Redirect href="/onboarding" />;

  return <Redirect href="/today" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
