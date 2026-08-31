import React, { useEffect, useMemo } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useAuth } from "../providers/AuthProvider";
import { useTheme } from "../providers/ThemeProvider";
import { BrandLoader } from "./BrandLoader";
import { LoadError } from "./LoadError";
import { Colors } from "../theme";

interface RequireAuthProps {
  children: React.ReactNode;
  /** When false, only session is required (e.g. /onboarding route). Default true. */
  requireOnboarding?: boolean;
}

export function RequireAuth({
  children,
  requireOnboarding = true,
}: RequireAuthProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    session,
    profile,
    psychologyProfile,
    loading,
    profileLoaded,
    profileError,
    profileOffline,
    refreshProfile,
  } = useAuth();

  const authReady = !loading && (!session || profileLoaded);

  useEffect(() => {
    if (!authReady) return;
    if (profileError) return;

    if (!session) {
      router.replace("/sign-in");
      return;
    }

    if (!profile) return;

    if (requireOnboarding && !psychologyProfile?.completed_at) {
      router.replace("/onboarding");
    }
  }, [session, profile, psychologyProfile, authReady, requireOnboarding, profileError]);

  if (!authReady) {
    return (
      <View style={styles.centered}>
        <BrandLoader size={56} />
      </View>
    );
  }

  if (!session) {
    return null;
  }

  if (profileError || !profile) {
    return (
      <View style={styles.centered}>
        <LoadError offline={profileOffline} onRetry={refreshProfile} />
      </View>
    );
  }

  if (requireOnboarding && !psychologyProfile?.completed_at) {
    return null;
  }

  return <>{children}</>;
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    centered: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: "center",
      justifyContent: "center",
    },
  });
