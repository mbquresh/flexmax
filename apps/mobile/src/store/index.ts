import { create } from "zustand";
import { Profile, PsychologyProfile, ScheduleBlock, DailyInstance, BehavioralInsight } from "../types/database";
import { PreemptCandidate } from "../lib/preempt";

interface FlexMaxStore {
  // Auth
  userId: string | null;
  profile: Profile | null;

  // Onboarding
  psychologyProfile: PsychologyProfile | null;
  onboardingComplete: boolean;

  // Schedule
  blocks: ScheduleBlock[];
  todayInstances: DailyInstance[];
  todayPreempt: PreemptCandidate | null;
  setTodayPreempt: (p: PreemptCandidate | null) => void;
  todayInsights: BehavioralInsight[];
  setTodayInsights: (i: BehavioralInsight[]) => void;

  // Actions
  setUser: (userId: string, profile: Profile) => void;
  setPsychologyProfile: (p: PsychologyProfile) => void;
  setBlocks: (blocks: ScheduleBlock[]) => void;
  setTodayInstances: (instances: DailyInstance[]) => void;
  updateInstance: (id: string, updates: Partial<DailyInstance>) => void;
  reset: () => void;
}

export const useStore = create<FlexMaxStore>((set) => ({
  userId: null,
  profile: null,
  psychologyProfile: null,
  onboardingComplete: false,
  blocks: [],
  todayInstances: [],
  todayPreempt: null,
  todayInsights: [],

  setUser: (userId, profile) => set({ userId, profile }),

  setPsychologyProfile: (p) =>
    set({ psychologyProfile: p, onboardingComplete: !!p.completed_at }),

  setBlocks: (blocks) => set({ blocks }),

  setTodayInstances: (instances) => set({ todayInstances: instances }),

  setTodayPreempt: (p) => set({ todayPreempt: p }),

  setTodayInsights: (i) => set({ todayInsights: i }),

  updateInstance: (id, updates) =>
    set((state) => ({
      todayInstances: state.todayInstances.map((inst) =>
        inst.id === id ? { ...inst, ...updates } : inst
      ),
    })),

  reset: () =>
    set({
      userId: null,
      profile: null,
      psychologyProfile: null,
      onboardingComplete: false,
      blocks: [],
      todayInstances: [],
      todayPreempt: null,
      todayInsights: [],
    }),
}));
