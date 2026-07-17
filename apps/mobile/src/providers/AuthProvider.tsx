import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { registerPushToken, unregisterPushToken } from "../lib/notifications";
import { handleError } from "../lib/errors";
import { useStore } from "../store";
import { Profile, PsychologyProfile } from "../types/database";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  psychologyProfile: PsychologyProfile | null;
  loading: boolean;
  profileLoaded: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

    const { error } = await supabase
      .from("profiles")
      .update({ timezone: deviceTz })
      .eq("id", userId);

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
  const { setUser, setPsychologyProfile: setStorePsych, reset } = useStore();

  const loadUserData = async (userId: string) => {
    let profileResult = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    // Profile missing (migrations not run, or signed up before trigger existed)
    if (profileResult.error?.code === "PGRST116") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const name =
        user?.user_metadata?.name ??
        user?.email?.split("@")[0] ??
        "User";

      profileResult = await supabase
        .from("profiles")
        .insert({ id: userId, name })
        .select()
        .single();
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

    const psychResult = await supabase
      .from("psychology_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    setProfile(profileData);
    setPsychologyProfile(psychResult.data);
    setUser(userId, profileData);
    if (psychResult.data) setStorePsych(psychResult.data);
    setProfileLoaded(true);

    registerPushToken(userId).catch(console.error);
  };

  const refreshProfile = async () => {
    if (!session?.user.id) return;
    await loadUserData(session.user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      if (current?.user.id) {
        loadUserData(current.user.id)
          .catch(console.error)
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
        setProfileLoaded(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.id) {
        setLoading(true);
        loadUserData(nextSession.user.id)
          .catch(console.error)
          .finally(() => setLoading(false));
      } else {
        setProfile(null);
        setPsychologyProfile(null);
        setProfileLoaded(false);
        reset();
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
