import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";
import { normalizePermissionStatus, track } from "./analytics";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushToken(userId: string): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  track("notification_permission", {
    status: normalizePermissionStatus(finalStatus),
  });

  if (finalStatus !== "granted") {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  });

  const token = tokenData.data;
  const platform = Platform.OS === "ios" ? "ios" : "android";

  const { error } = await supabase
    .from("push_tokens")
    .upsert({ user_id: userId, token, platform }, { onConflict: "token" });

  if (error) {
    console.error("Failed to save push token:", error);
    return null;
  }

  return token;
}

export async function unregisterPushToken(userId: string): Promise<void> {
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  }).catch(() => null);

  if (!tokenData) return;

  await supabase
    .from("push_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("token", tokenData.data);
}
