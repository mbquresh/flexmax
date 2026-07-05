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
  | "rescheduled"
  | "removed";

export type CompletionRating = "crushed" | "partial" | "pulled_away";

export type AdhocTaskStatus = "pending" | "completed" | "removed";

export interface AdhocTask {
  id: string;
  user_id: string;
  date: string;
  name: string;
  start_minutes: number | null;
  end_minutes: number | null;
  status: AdhocTaskStatus;
  completion_rating: string | null;
  created_at: string;
}

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
  schedule_tips: string[] | null;
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
  is_fixed: boolean;
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
  is_fixed: boolean;
  removed_reason: string | null;
  // Joined from schedule_blocks
  block?: ScheduleBlock;
}

// Supabase Database type (for the typed client)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile & Record<string, unknown>;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      psychology_profiles: {
        Row: PsychologyProfile & Record<string, unknown>;
        Insert: Partial<PsychologyProfile> & { user_id: string };
        Update: Partial<PsychologyProfile>;
        Relationships: [];
      };
      schedule_templates: {
        Row: ScheduleTemplate & Record<string, unknown>;
        Insert: Partial<ScheduleTemplate> & { user_id: string };
        Update: Partial<ScheduleTemplate>;
        Relationships: [];
      };
      schedule_blocks: {
        Row: ScheduleBlock & Record<string, unknown>;
        Insert: Partial<ScheduleBlock> & {
          user_id: string;
          template_id: string;
          name: string;
          start_minutes: number;
          end_minutes: number;
        };
        Update: Partial<ScheduleBlock>;
        Relationships: [];
      };
      daily_schedule_instances: {
        Row: DailyInstance & Record<string, unknown>;
        Insert: Partial<DailyInstance> & {
          user_id: string;
          block_id: string;
          date: string;
          start_minutes: number;
          end_minutes: number;
        };
        Update: Partial<DailyInstance>;
        Relationships: [];
      };
      adhoc_tasks: {
        Row: AdhocTask & Record<string, unknown>;
        Insert: Partial<AdhocTask> & {
          user_id: string;
          date: string;
          name: string;
        };
        Update: Partial<AdhocTask>;
        Relationships: [];
      };
      push_tokens: {
        Row: { id: string; user_id: string; token: string; platform: string; created_at: string };
        Insert: { user_id: string; token: string; platform: string };
        Update: Partial<{ user_id: string; token: string; platform: string }>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      generate_daily_instances: {
        Args: { target_date: string };
        Returns: undefined;
      };
      generate_my_daily_instances: {
        Args: { target_date: string };
        Returns: undefined;
      };
    };
  };
}
