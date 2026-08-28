import { useEffect, useRef } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "../src/providers/AuthProvider";
import { ThemeProvider, useTheme } from "../src/providers/ThemeProvider";
import { supabase } from "../src/lib/supabase";
import {
  registerNotificationCategories,
  scheduleFollowUpNudge,
} from "../src/lib/blockNotifications";

function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const action = response.actionIdentifier;
  const data = response.notification.request.content.data;

  if (data?.type === "block_cutoff" && data?.instanceId) {
    const chose =
      action === "wrapping_up"
        ? "wrapping_up"
        : action === "more_time"
        ? "more_time"
        : "opened";

    (supabase as typeof supabase & {
      from: (table: "nudge_events") => ReturnType<typeof supabase.from>;
    })
      .from("nudge_events")
      .update({ response: chose, tapped_at: new Date().toISOString() })
      .eq("instance_id", data.instanceId)
      .eq("kind", "cutoff")
      .then(
        () => {},
        () => {}
      );

    if (chose === "more_time") {
      scheduleFollowUpNudge(
        data.instanceId as string,
        (response.notification.request.content.title as string) ?? "Still going"
      ).catch(() => {});
    }

    if (chose === "opened") router.replace("/today");
    return;
  }

  if (data?.type === "nightly_fill") {
    router.replace("/plan-tomorrow");
  } else if (
    data?.type === "block_complete" ||
    data?.type === "block_preempt" ||
    data?.screen === "today"
  ) {
    router.replace("/today");
  }
}

function ThemedStack() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    (async () => {
      await registerNotificationCategories();

      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) {
        setTimeout(() => handleNotificationResponse(response), 0);
      }
    })();

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleNotificationResponse(response);
      }
    );

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <ThemedStack />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
