import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { registerPushToken, unregisterPushToken } from "../lib/notifications";
import { handleError, isConnectivityError } from "../lib/errors";
import { getLocalDateString } from "../lib/time";
import { useStore } from "../store";
import { Profile, PsychologyProfile } from "../types/database";

let lastOpenRecordedAt = 0;
const OPEN_DEBOUNCE_MS = 60_000;

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  psychologyProfile: PsychologyProfile | null;
  loading: boolean;
  profileLoaded: boolean;
  profileError: boolean;
  profileOffline: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Nothing in the auth bootstrap may block the app forever. Every await
// here gates setLoading(false), so one hung request is an unrecoverable
// white screen with no error to report.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function syncDeviceTimezone(
  userId: string,
  currentTimezone: string
): Promise<string> {
  try {
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const validTz = deviceTz && deviceTz.includes("/");

    if (!validTz || currentTimezone === deviceTz) {
      return currentTimezone;
    }

    const { error } = await withTimeout(
      supabase.from("profiles").update({ timezone: deviceTz }).eq("id", userId),
      10000,
      "profiles timezone update"
    );

    if (error) throw error;
    return deviceTz;
  } catch (err) {
    handleError(err, "syncDeviceTimezone");
    return currentTimezone;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [psychologyProfile, setPsychologyProfile] =
    useState<PsychologyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [profileOffline, setProfileOffline] = useState(false);
  const { setUser, setPsychologyProfile: setStorePsych, reset } = useStore();

  const loadUserData = async (userId: string) => {
    setProfileError(false);
    setProfileOffline(false);
    let profileResult = await withTimeout(
      supabase.from("profiles").select("*").eq("id", userId).single(),
      10000,
      "profiles select"
    );

    // Profile missing (migrations not run, or signed up before trigger existed)
    if (profileResult.error?.code === "PGRST116") {
      const { data: { user }, error: userError } = await withTimeout(
        supabase.auth.getUser(),
        10000,
        "getUser"
      );

      // Session token is valid but the user is gone (account deleted
      // elsewhere, or deleted directly in the database). Nothing can be
      // written under this id — every table cascades from auth.users.
      if (userError || !user) {
        await supabase.auth.signOut();
        return;
      }

      const name =
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "User";

      profileResult = await supabase
        .from("profiles")
        .insert({ id: userId, name })
        .select()
        .single();
    }

    if (profileResult.error) {
      await new Promise((r) => setTimeout(r, 1200));
      profileResult = await withTimeout(
        supabase.from("profiles").select("*").eq("id", userId).single(),
        10000,
        "profiles retry select"
      );
    }

    if (profileResult.error) throw profileResult.error;

    const timezone = await syncDeviceTimezone(
      userId,
      profileResult.data.timezone
    );
    const profileData =
      timezone === profileResult.data.timezone
        ? profileResult.data
        : { ...profileResult.data, timezone };

    const psychResult = await withTimeout(
      supabase
        .from("psychology_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      10000,
      "psychology_profiles select"
    );

    setProfile(profileData);
    setPsychologyProfile(psychResult.data);
    setUser(userId, profileData);
    if (psychResult.data) setStorePsych(psychResult.data);
    setProfileLoaded(true);

    registerPushToken(userId).catch(console.error);
    recordAppOpen();
  };

  const recordAppOpen = () => {
    const now = Date.now();
    if (now - lastOpenRecordedAt < OPEN_DEBOUNCE_MS) return;
    lastOpenRecordedAt = now;

    supabase
      .rpc("record_app_open", { p_local_date: getLocalDateString() })
      .then(({ error }) => {
        if (error) handleError(error, "recordAppOpen");
      });
  };

  const refreshProfile = async () => {
    if (!session?.user.id) return;
    await loadUserData(session.user.id);
  };

  useEffect(() => {
    withTimeout(supabase.auth.getSession(), 10000, "getSession")
      .then(({ data: { session: current } }) => {
        setSession(current);
        if (current?.user.id) {
          return loadUserData(current.user.id).catch((err) => {
            handleError(err, "loadUserData");
            setProfileError(true);
            setProfileOffline(isConnectivityError(err));
          });
        }
      })
      .catch((err) => {
        // Reached when getSession itself fails or times out. Without this the
        // app has no exit from the loading state.
        handleError(err, "authBootstrap");
        setProfileError(true);
        setProfileOffline(isConnectivityError(err));
      })
      .finally(() => {
        setLoading(false);
        setProfileLoaded(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.id) {
        setLoading(true);
        loadUserData(nextSession.user.id)
          .catch((err) => {
            handleError(err, "loadUserData");
            setProfileError(true);
            setProfileOffline(isConnectivityError(err));
          })
          .finally(() => {
            setLoading(false);
            setProfileLoaded(true);
          });
      } else {
        setProfile(null);
        setPsychologyProfile(null);
        setProfileLoaded(false);
        setProfileError(false);
        setProfileOffline(false);
        reset();
        setLoading(false);
      }
    });

    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") recordAppOpen();
    });

    return () => {
      subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (session?.user.id) {
      await unregisterPushToken(session.user.id).catch(console.error);
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        psychologyProfile,
        loading,
        profileLoaded,
        profileError,
        profileOffline,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
