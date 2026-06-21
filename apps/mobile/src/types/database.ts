export type BlockCategory =
  | "deep_work"
  | "health"
  | "admin"
  | "learning"
  | "social"
  | "rest"
  | "morning_routine"
  | "wind_down"
  | "other";

export type BlockStatus =
  | "pending"
  | "active"
  | "completed"
  | "missed"
  | "skipped"
  | "rescheduled";

export type CompletionRating = "crushed" | "partial" | "pulled_away";

export interface Profile {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
}

export interface PsychologyProfile {
  id: string;
  user_id: string;
  onboarding_messages: Array<{ role: "user" | "assistant"; content: string }>;
  peak_energy_times: string[] | null;
  avoidance_patterns: string[] | null;
  motivation_style: string | null;
  sabotage_triggers: string[] | null;
  goals: string[] | null;
  accountability_tone: string | null;
  raw_ai_summary: string | null;
  completed_at: string | null;
}

export interface ScheduleTemplate {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  ai_reviewed: boolean;
  ai_feedback: string | null;
}

export interface ScheduleBlock {
  id: string;
  template_id: string;
  user_id: string;
  name: string;
  category: BlockCategory;
  color: string;
  start_minutes: number;
  end_minutes: number;
  days_of_week: number[];
  sort_order: number;
}

export interface DailyInstance {
  id: string;
  user_id: string;
  block_id: string;
  date: string;
  start_minutes: number;
  end_minutes: number;
  task_detail: string | null;
  status: BlockStatus;
  completion_rating: CompletionRating | null;
  reflection_why: string | null;
  reflection_improve: string | null;
  rescheduled_to_id: string | null;
  // Joined from schedule_blocks
  block?: ScheduleBlock;
}

// Supabase Database type (for the typed client)
type EmptyRelationships = [];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
        Relationships: EmptyRelationships;
      };
      psychology_profiles: {
        Row: PsychologyProfile;
        Insert: Partial<PsychologyProfile>;
        Update: Partial<PsychologyProfile>;
        Relationships: EmptyRelationships;
      };
      schedule_templates: {
        Row: ScheduleTemplate;
        Insert: Partial<ScheduleTemplate>;
        Update: Partial<ScheduleTemplate>;
        Relationships: EmptyRelationships;
      };
      schedule_blocks: {
        Row: ScheduleBlock;
        Insert: Partial<ScheduleBlock>;
        Update: Partial<ScheduleBlock>;
        Relationships: EmptyRelationships;
      };
      daily_schedule_instances: {
        Row: DailyInstance;
        Insert: Partial<DailyInstance>;
        Update: Partial<DailyInstance>;
        Relationships: EmptyRelationships;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_daily_instances: {
        Args: { target_date: string };
        Returns: Record<string, never>;
      };
    };
  };
}
