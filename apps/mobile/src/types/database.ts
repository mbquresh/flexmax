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
  | "unaccounted"
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
  sleep_target_minutes: number | null;
  wake_target_minutes: number | null;
  day_boundary_overrides: import("../lib/schedule").DayBoundaryOverrides | null;
  calendar_feed_token: string | null;
  created_at: string;
}

export interface DayLog {
  user_id: string;
  date: string;
  slept_at: number | null;
  woke_at: number | null;
}

export interface PsychologyProfile {
  id: string;
  user_id: string;
  onboarding_messages: Array<{ role: "user" | "assistant"; content: string }>;
  planners_abandoned: string | null;
  past_failure_mode: string | null;
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

export interface BehavioralInsight {
  id: string;
  kind: "causal" | "pattern" | "strength";
  belief: string;
  suggestion: string | null;
  related_blocks: string[];
  rank: number;
  generated_at: string;
  nudge_line: string | null;
}

export interface NudgeEvent {
  id: string;
  user_id: string;
  instance_id: string;
  kind: string;
  scheduled_for: string;
  tapped_at: string | null;
  response: string | null;
  created_at: string;
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
  is_active: boolean;
  starts_on: string | null;
  ends_on: string | null;
  interval_weeks: number;
  anchor_date: string | null;
}

export interface AwayPeriod {
  id: string;
  user_id: string;
  starts_on: string; // YYYY-MM-DD
  ends_on: string; // YYYY-MM-DD
  label: string | null;
  created_at: string;
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
  rated_at: string | null;
  reflection_why: string | null;
  reflection_improve: string | null;
  reflected_at: string | null;
  acknowledged_at: string | null;
  miss_reason_tag: string | null;
  quality_reason_tag: string | null;
  quality_reason_note: string | null;
  actual_end_minutes: number | null;
  rescheduled_to_id: string | null;
  reschedule_count: number;
  original_start_minutes: number | null;
  original_end_minutes: number | null;
  displaced_by_id: string | null;
  is_fixed: boolean;
  removed_reason: string | null;
  removed_by: string | null;
  // Set by a trigger (045) when the outcome was written after this date
  // passed. Timing metrics must exclude these rows.
  backfilled_at: string | null;
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
      day_log: {
        Row: DayLog & Record<string, unknown>;
        Insert: Partial<DayLog> & { user_id: string; date: string };
        Update: Partial<DayLog>;
        Relationships: [];
      };
      away_periods: {
        // Row must carry an index signature. AwayPeriod is an interface, and
        // interfaces do not get TypeScript's implicit index signature — without
        // the intersection this one table fails GenericTable, which fails the
        // whole GenericSchema, which collapses every .from() / .rpc() to never.
        Row: AwayPeriod & Record<string, unknown>;
        Insert: Partial<AwayPeriod> & {
          user_id: string;
          starts_on: string;
          ends_on: string;
        };
        Update: Partial<AwayPeriod>;
        Relationships: [];
      };
      behavioral_insights: {
        Row: BehavioralInsight & {
          user_id: string;
          evidence: string;
          superseded: boolean;
        } & Record<string, unknown>;
        Insert: Partial<BehavioralInsight> & {
          user_id: string;
          kind: BehavioralInsight["kind"];
          belief: string;
          evidence: string;
          rank: number;
        };
        Update: Partial<BehavioralInsight> & {
          superseded?: boolean;
          evidence?: string;
        };
        Relationships: [];
      };
      nudge_events: {
        Row: NudgeEvent & Record<string, unknown>;
        Insert: Partial<NudgeEvent> & {
          user_id: string;
          instance_id: string;
          kind: string;
          scheduled_for: string;
        };
        Update: Partial<NudgeEvent>;
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
      swap_instance_times: {
        Args: {
          instance_a_id: string;
          a_start: number;
          a_end: number;
          instance_b_id: string;
          b_start: number;
          b_end: number;
        };
        Returns: undefined;
      };
      get_or_create_calendar_token: {
        Args: { p_rotate: boolean };
        Returns: string;
      };
      revoke_calendar_token: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      delete_my_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      record_app_open: {
        Args: { p_local_date: string };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
