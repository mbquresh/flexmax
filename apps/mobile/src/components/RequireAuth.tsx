import React, { useEffect } from "react";
import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../providers/AuthProvider";
import { colors } from "../theme";

interface RequireAuthProps {
  children: React.ReactNode;
  /** When false, only session is required (e.g. /onboarding route). Default true. */
  requireOnboarding?: boolean;
}

export function RequireAuth({
  children,
  requireOnboarding = true,
}: RequireAuthProps) {
  const { session, psychologyProfile, loading, profileLoaded } = useAuth();

  const authReady = !loading && (!session || profileLoaded);

  useEffect(() => {
    if (!authReady) return;

    if (!session) {
      router.replace("/sign-in");
      return;
    }

    if (requireOnboarding && !psychologyProfile?.completed_at) {
      router.replace("/onboarding");
    }
  }, [session, psychologyProfile, authReady, requireOnboarding]);

  if (!authReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return null;
  }

  if (requireOnboarding && !psychologyProfile?.completed_at) {
    return null;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
