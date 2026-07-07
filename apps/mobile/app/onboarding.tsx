import OnboardingScreen from "../src/screens/OnboardingScreen";
import { RequireAuth } from "../src/components/RequireAuth";

export default function OnboardingRoute() {
  return (
    <RequireAuth requireOnboarding={false}>
      <OnboardingScreen />
    </RequireAuth>
  );
}
