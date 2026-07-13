import { useEffect, useRef } from "react";
import { Stack, router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "../src/providers/AuthProvider";
import { colors } from "../src/theme";

function routeFromNotificationData(data: any) {
  if (data?.type === "nightly_fill") {
    router.replace("/plan-tomorrow");
  } else if (data?.screen === "today") {
    router.replace("/today");
  }
}

export default function RootLayout() {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        setTimeout(() => {
          routeFromNotificationData(response.notification.request.content.data);
        }, 0);
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        routeFromNotificationData(response.notification.request.content.data);
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
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
