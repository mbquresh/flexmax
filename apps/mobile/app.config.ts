import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig & { eas?: { projectId: string } } => ({
  ...config,
  name: "FlexMax",
  slug: "flexmax",
  scheme: "flexmax",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#DCDCDC",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.flexmax.app",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#DCDCDC",
    },
    package: "com.flexmax.app",
  },
  plugins: [
    "expo-router",
    "@react-native-community/datetimepicker",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#3B6EA5",
        sounds: [],
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    eas: {
      projectId: "f54521dc-1870-41ba-be7d-bd53a49ddd55",
    },
  },
  eas: {
    projectId: "f54521dc-1870-41ba-be7d-bd53a49ddd55",
  },
});
