import { useState } from "react";
import HapticSplash from "@/components/HapticSplash";
import Onboarding from "@/components/Onboarding";
import SafeHavenChat from "@/components/SafeHavenChat";

const Index = () => {
  // Three-stage arrival: Haptic Splash → Onboarding (Trust & Calibration) → Chat.
  const [stage, setStage] = useState<"splash" | "onboarding" | "chat">("splash");

  return (
    <div className="min-h-screen safe-haven-shell">
      {stage === "splash" && <HapticSplash onComplete={() => setStage("onboarding")} />}
      {stage === "onboarding" && <Onboarding onComplete={() => setStage("chat")} />}
      {stage === "chat" && <SafeHavenChat />}
    </div>
  );
};

export default Index;
