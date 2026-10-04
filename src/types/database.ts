export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievement_definitions: {
        Row: {
          category: Database["public"]["Enums"]["achievement_category"]
          created_at: string
          description_fr: string
          icon_key: string | null
          id: string
          is_active: boolean
          is_quantitative: boolean
          metric: string
          name_fr: string
          slug: string
          sort_order: number
          threshold: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["achievement_category"]
          created_at?: string
          description_fr: string
          icon_key?: string | null
          id?: string
          is_active?: boolean
          is_quantitative?: boolean
          metric: string
          name_fr: string
          slug: string
          sort_order: number
          threshold: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["achievement_category"]
          created_at?: string
          description_fr?: string
          icon_key?: string | null
          id?: string
          is_active?: boolean
          is_quantitative?: boolean
          metric?: string
          name_fr?: string
          slug?: string
          sort_order?: number
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      achievement_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_fr: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_fr: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_fr?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_generation_reservations: {
        Row: {
          previous_generation_at: string | null
          reserved_at: string
          token: string
          user_id: string
        }
        Insert: {
          previous_generation_at?: string | null
          reserved_at?: string
          token: string
          user_id: string
        }
        Update: {
          previous_generation_at?: string | null
          reserved_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_preferences: {
        Row: {
          ai_enabled: boolean
          consent_version: string | null
          consented_at: string | null
          created_at: string
          include_consumption_context: boolean
          include_craving_context: boolean
          include_reflections: boolean
          last_generation_at: string | null
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_enabled?: boolean
          consent_version?: string | null
          consented_at?: string | null
          created_at?: string
          include_consumption_context?: boolean
          include_craving_context?: boolean
          include_reflections?: boolean
          last_generation_at?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_enabled?: boolean
          consent_version?: string | null
          consented_at?: string | null
          created_at?: string
          include_consumption_context?: boolean
          include_craving_context?: boolean
          include_reflections?: boolean
          last_generation_at?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_reflections: {
        Row: {
          content: Json
          created_at: string
          generated_at: string
          id: string
          model: string | null
          period_end: string
          period_start: string
          prompt_version: string
          provider: string | null
          summary: string
          type: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          generated_at?: string
          id?: string
          model?: string | null
          period_end: string
          period_start: string
          prompt_version: string
          provider?: string | null
          summary: string
          type?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          generated_at?: string
          id?: string
          model?: string | null
          period_end?: string
          period_start?: string
          prompt_version?: string
          provider?: string | null
          summary?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_excluded_users: {
        Row: {
          created_at: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      beta_feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          page_context: string | null
          status: string
          status_updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          page_context?: string | null
          status?: string
          status_updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          page_context?: string | null
          status?: string
          status_updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      checkin_achievements: {
        Row: {
          achievement_type_id: string
          checkin_id: string
          created_at: string
          custom_label: string | null
          user_id: string
        }
        Insert: {
          achievement_type_id: string
          checkin_id: string
          created_at?: string
          custom_label?: string | null
          user_id?: string
        }
        Update: {
          achievement_type_id?: string
          checkin_id?: string
          created_at?: string
          custom_label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_achievements_achievement_type_id_fkey"
            columns: ["achievement_type_id"]
            isOneToOne: false
            referencedRelation: "achievement_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_achievements_checkin_id_user_id_fkey"
            columns: ["checkin_id", "user_id"]
            isOneToOne: false
            referencedRelation: "daily_checkins"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      checkin_emotions: {
        Row: {
          checkin_id: string
          created_at: string
          emotion_id: string
          user_id: string
        }
        Insert: {
          checkin_id: string
          created_at?: string
          emotion_id: string
          user_id?: string
        }
        Update: {
          checkin_id?: string
          created_at?: string
          emotion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_emotions_checkin_id_user_id_fkey"
            columns: ["checkin_id", "user_id"]
            isOneToOne: false
            referencedRelation: "daily_checkins"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "checkin_emotions_emotion_id_fkey"
            columns: ["emotion_id"]
            isOneToOne: false
            referencedRelation: "emotions"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_triggers: {
        Row: {
          checkin_id: string
          created_at: string
          custom_label: string | null
          trigger_type_id: string
          user_id: string
        }
        Insert: {
          checkin_id: string
          created_at?: string
          custom_label?: string | null
          trigger_type_id: string
          user_id?: string
        }
        Update: {
          checkin_id?: string
          created_at?: string
          custom_label?: string | null
          trigger_type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_triggers_checkin_id_user_id_fkey"
            columns: ["checkin_id", "user_id"]
            isOneToOne: false
            referencedRelation: "daily_checkins"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "checkin_triggers_trigger_type_id_fkey"
            columns: ["trigger_type_id"]
            isOneToOne: false
            referencedRelation: "trigger_types"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_events: {
        Row: {
          checkin_id: string
          context_text: string | null
          craving_before: number | null
          created_at: string
          id: string
          next_time_strategy_text: string | null
          occurred_at: string | null
          quantity: number | null
          reflection_text: string | null
          unit: string | null
          updated_at: string
          user_id: string
          user_substance_id: string
        }
        Insert: {
          checkin_id: string
          context_text?: string | null
          craving_before?: number | null
          created_at?: string
          id?: string
          next_time_strategy_text?: string | null
          occurred_at?: string | null
          quantity?: number | null
          reflection_text?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
          user_substance_id: string
        }
        Update: {
          checkin_id?: string
          context_text?: string | null
          craving_before?: number | null
          created_at?: string
          id?: string
          next_time_strategy_text?: string | null
          occurred_at?: string | null
          quantity?: number | null
          reflection_text?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
          user_substance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_events_checkin_id_user_id_fkey"
            columns: ["checkin_id", "user_id"]
            isOneToOne: false
            referencedRelation: "daily_checkins"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "consumption_events_user_substance_id_user_id_fkey"
            columns: ["user_substance_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_substances"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      craving_event_emotions: {
        Row: {
          craving_event_id: string
          created_at: string
          emotion_id: string
          user_id: string
        }
        Insert: {
          craving_event_id: string
          created_at?: string
          emotion_id: string
          user_id?: string
        }
        Update: {
          craving_event_id?: string
          created_at?: string
          emotion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "craving_event_emotions_craving_event_id_user_id_fkey"
            columns: ["craving_event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "craving_events"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "craving_event_emotions_emotion_id_fkey"
            columns: ["emotion_id"]
            isOneToOne: false
            referencedRelation: "emotions"
            referencedColumns: ["id"]
          },
        ]
      }
      craving_event_substances: {
        Row: {
          craving_event_id: string
          created_at: string
          user_id: string
          user_substance_id: string
        }
        Insert: {
          craving_event_id: string
          created_at?: string
          user_id?: string
          user_substance_id: string
        }
        Update: {
          craving_event_id?: string
          created_at?: string
          user_id?: string
          user_substance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "craving_event_substances_craving_event_id_user_id_fkey"
            columns: ["craving_event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "craving_events"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "craving_event_substances_user_substance_id_user_id_fkey"
            columns: ["user_substance_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_substances"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      craving_event_triggers: {
        Row: {
          craving_event_id: string
          created_at: string
          custom_label: string | null
          trigger_type_id: string
          user_id: string
        }
        Insert: {
          craving_event_id: string
          created_at?: string
          custom_label?: string | null
          trigger_type_id: string
          user_id?: string
        }
        Update: {
          craving_event_id?: string
          created_at?: string
          custom_label?: string | null
          trigger_type_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "craving_event_triggers_craving_event_id_user_id_fkey"
            columns: ["craving_event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "craving_events"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "craving_event_triggers_trigger_type_id_fkey"
            columns: ["trigger_type_id"]
            isOneToOne: false
            referencedRelation: "trigger_types"
            referencedColumns: ["id"]
          },
        ]
      }
      craving_events: {
        Row: {
          completed_at: string | null
          context_text: string | null
          created_at: string
          final_craving_score: number | null
          id: string
          initial_craving_score: number
          local_date: string
          outcome_text: string | null
          started_at: string
          status: Database["public"]["Enums"]["craving_event_status"]
          trigger_unknown: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          context_text?: string | null
          created_at?: string
          final_craving_score?: number | null
          id?: string
          initial_craving_score: number
          local_date: string
          outcome_text?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["craving_event_status"]
          trigger_unknown?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          context_text?: string | null
          created_at?: string
          final_craving_score?: number | null
          id?: string
          initial_craving_score?: number
          local_date?: string
          outcome_text?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["craving_event_status"]
          trigger_unknown?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      craving_interventions: {
        Row: {
          actual_duration_seconds: number | null
          completed_at: string | null
          craving_event_id: string
          created_at: string
          custom_strategy_text: string | null
          helped_text: string | null
          id: string
          paused_at: string | null
          paused_seconds: number
          planned_duration_minutes: number | null
          started_at: string
          strategy_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_duration_seconds?: number | null
          completed_at?: string | null
          craving_event_id: string
          created_at?: string
          custom_strategy_text?: string | null
          helped_text?: string | null
          id?: string
          paused_at?: string | null
          paused_seconds?: number
          planned_duration_minutes?: number | null
          started_at?: string
          strategy_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          actual_duration_seconds?: number | null
          completed_at?: string | null
          craving_event_id?: string
          created_at?: string
          custom_strategy_text?: string | null
          helped_text?: string | null
          id?: string
          paused_at?: string | null
          paused_seconds?: number
          planned_duration_minutes?: number | null
          started_at?: string
          strategy_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "craving_interventions_craving_event_id_user_id_fkey"
            columns: ["craving_event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "craving_events"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "craving_interventions_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "craving_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      craving_strategies: {
        Row: {
          created_at: string
          default_duration_minutes: number | null
          description_fr: string
          id: string
          is_active: boolean
          name_fr: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          default_duration_minutes?: number | null
          description_fr: string
          id?: string
          is_active?: boolean
          name_fr: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          default_duration_minutes?: number | null
          description_fr?: string
          id?: string
          is_active?: boolean
          name_fr?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          checkin_date: string
          completed_at: string | null
          craving_score: number | null
          created_at: string
          energy_score: number | null
          id: string
          lesson_text: string | null
          mood_score: number | null
          notes: string | null
          proud_of_text: string | null
          status: Database["public"]["Enums"]["checkin_status"]
          stress_score: number | null
          tomorrow_intention_text: string | null
          updated_at: string
          user_id: string
          victory_text: string | null
        }
        Insert: {
          checkin_date: string
          completed_at?: string | null
          craving_score?: number | null
          created_at?: string
          energy_score?: number | null
          id?: string
          lesson_text?: string | null
          mood_score?: number | null
          notes?: string | null
          proud_of_text?: string | null
          status: Database["public"]["Enums"]["checkin_status"]
          stress_score?: number | null
          tomorrow_intention_text?: string | null
          updated_at?: string
          user_id?: string
          victory_text?: string | null
        }
        Update: {
          checkin_date?: string
          completed_at?: string | null
          craving_score?: number | null
          created_at?: string
          energy_score?: number | null
          id?: string
          lesson_text?: string | null
          mood_score?: number | null
          notes?: string | null
          proud_of_text?: string | null
          status?: Database["public"]["Enums"]["checkin_status"]
          stress_score?: number | null
          tomorrow_intention_text?: string | null
          updated_at?: string
          user_id?: string
          victory_text?: string | null
        }
        Relationships: []
      }
      emotions: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name_fr: string
          slug: string
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_fr: string
          slug: string
          sort_order: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_fr?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      onboarding_drafts: {
        Row: {
          current_step: number
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          current_step?: number
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          current_step?: number
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_reasons: {
        Row: {
          created_at: string
          id: string
          reason_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason_text: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_reminders: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_events: {
        Row: {
          event_name: string
          id: string
          occurred_at: string
          occurred_on: string
          user_id: string
        }
        Insert: {
          event_name: string
          id?: string
          occurred_at?: string
          occurred_on?: string
          user_id: string
        }
        Update: {
          event_name?: string
          id?: string
          occurred_at?: string
          occurred_on?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed: boolean
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_completed?: boolean
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      safe_places: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_favorite: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      self_letters: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      substances: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name_fr: string
          slug: string
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_fr: string
          slug: string
          sort_order: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_fr?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      support_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trigger_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_fr: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_fr: string
          slug: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_fr?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_definition_id: string
          created_at: string
          earned_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          achievement_definition_id: string
          created_at?: string
          earned_at: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          achievement_definition_id?: string
          created_at?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_definition_id_fkey"
            columns: ["achievement_definition_id"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_motivations: {
        Row: {
          created_at: string
          custom_label: string | null
          id: string
          motivation: Database["public"]["Enums"]["motivation"]
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_label?: string | null
          id?: string
          motivation: Database["public"]["Enums"]["motivation"]
          user_id?: string
        }
        Update: {
          created_at?: string
          custom_label?: string | null
          id?: string
          motivation?: Database["public"]["Enums"]["motivation"]
          user_id?: string
        }
        Relationships: []
      }
      user_personal_strategies: {
        Row: {
          created_at: string
          custom_name: string | null
          default_duration_minutes: number | null
          id: string
          is_active: boolean
          is_favorite: boolean
          notes: string | null
          strategy_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          default_duration_minutes?: number | null
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          notes?: string | null
          strategy_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          default_duration_minutes?: number | null
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          notes?: string | null
          strategy_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_personal_strategies_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "craving_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_personal_triggers: {
        Row: {
          created_at: string
          custom_label: string | null
          id: string
          is_active: boolean
          notes: string | null
          trigger_type_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_label?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          trigger_type_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          custom_label?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          trigger_type_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_personal_triggers_trigger_type_id_fkey"
            columns: ["trigger_type_id"]
            isOneToOne: false
            referencedRelation: "trigger_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_substances: {
        Row: {
          created_at: string
          custom_name: string | null
          goal: Database["public"]["Enums"]["substance_goal"]
          id: string
          is_active: boolean
          is_primary: boolean
          started_on: string
          substance_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_name?: string | null
          goal: Database["public"]["Enums"]["substance_goal"]
          id?: string
          is_active?: boolean
          is_primary?: boolean
          started_on: string
          substance_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          custom_name?: string | null
          goal?: Database["public"]["Enums"]["substance_goal"]
          id?: string
          is_active?: boolean
          is_primary?: boolean
          started_on?: string
          substance_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_substances_substance_id_fkey"
            columns: ["substance_id"]
            isOneToOne: false
            referencedRelation: "substances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      achievement_metric_events: {
        Args: { p_user_id: string }
        Returns: {
          metric: string
          pos: number
          reached_at: string
        }[]
      }
      add_user_substance: { Args: { payload: Json }; Returns: string }
      admin_feature_adoption: {
        Args: { p_from: string; p_to: string }
        Returns: {
          feature: string
          users: number
        }[]
      }
      admin_feedback_page: {
        Args: {
          p_category: string
          p_limit: number
          p_offset: number
          p_status: string
        }
        Returns: {
          category: string
          code: string
          created_at: string
          excluded: boolean
          id: string
          message: string
          page_context: string
          status: string
          total_count: number
        }[]
      }
      admin_funnel: {
        Args: { p_from: string; p_to: string }
        Returns: {
          active_j7: number
          first_checkin: number
          j7_eligible: number
          onboarded: number
          returned: number
          signups: number
        }[]
      }
      admin_overview: {
        Args: { p_from: string; p_to: string }
        Returns: {
          active_users: number
          active_users_30d: number
          active_users_7d: number
          ai_reflections_period: number
          ai_reflections_total: number
          checkins: number
          checkins_7d: number
          feedback_period: number
          feedback_total: number
          first_checkin_total: number
          new_users: number
          new_users_7d: number
          onboarded_total: number
          pdf_reports_period: number
          pdf_reports_total: number
          total_users: number
          users_3_checkins: number
          users_7_checkins: number
        }[]
      }
      admin_retention: {
        Args: never
        Returns: {
          cohort_week: string
          e1: number
          e14: number
          e3: number
          e30: number
          e7: number
          r1: number
          r14: number
          r3: number
          r30: number
          r7: number
          signups: number
        }[]
      }
      admin_reveal_account_email: { Args: { p_code: string }; Returns: string }
      admin_set_feedback_status: {
        Args: { p_id: string; p_status: string }
        Returns: boolean
      }
      admin_timeseries: {
        Args: { p_bucket: string; p_from: string; p_to: string }
        Returns: {
          active_users: number
          bucket: string
          checkins: number
          signups: number
        }[]
      }
      admin_user_detail: {
        Args: { p_code: string }
        Returns: {
          checkins: number
          code: string
          feedback_count: number
          first_checkin_at: string
          last_activity_at: string
          onboarded: boolean
          signed_up_at: string
          used_achievements: boolean
          used_ai: boolean
          used_checkin: boolean
          used_craving: boolean
          used_pdf: boolean
          used_plan: boolean
        }[]
      }
      admin_users_page: {
        Args: {
          p_active_days: number
          p_filter: string
          p_inactive_days: number
          p_limit: number
          p_new_days: number
          p_offset: number
          p_sort: string
        }
        Returns: {
          checkins: number
          code: string
          first_checkin_at: string
          last_activity_at: string
          onboarded: boolean
          signed_up_at: string
          total_count: number
        }[]
      }
      award_achievements: { Args: never; Returns: Json }
      award_achievements_for: {
        Args: { p_user_id: string }
        Returns: {
          earned_at: string
          slug: string
        }[]
      }
      close_stale_craving_events: { Args: never; Returns: number }
      complete_craving_event: {
        Args: { p_event_id: string; payload: Json }
        Returns: Json
      }
      complete_onboarding: { Args: { payload: Json }; Returns: string }
      current_user_local_date: { Args: never; Returns: string }
      deactivate_user_substance: {
        Args: { p_user_substance_id: string }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      dismiss_craving_event: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      get_achievement_progress: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      latest_allowed_local_date: { Args: never; Returns: string }
      lock_own_craving_event: {
        Args: { p_event_id: string }
        Returns: {
          completed_at: string | null
          context_text: string | null
          created_at: string
          final_craving_score: number | null
          id: string
          initial_craving_score: number
          local_date: string
          outcome_text: string | null
          started_at: string
          status: Database["public"]["Enums"]["craving_event_status"]
          trigger_unknown: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "craving_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_product_event: { Args: { p_event: string }; Returns: undefined }
      release_ai_generation: {
        Args: { p_reservation: string }
        Returns: boolean
      }
      reserve_ai_generation: {
        Args: never
        Returns: {
          remaining: number
          reservation: string
        }[]
      }
      save_ai_reflection: {
        Args: {
          p_content: Json
          p_model: string
          p_period_end: string
          p_period_start: string
          p_prompt_version: string
          p_provider: string
          p_summary: string
        }
        Returns: string
      }
      save_checkin: {
        Args: { finalize?: boolean; payload: Json }
        Returns: Json
      }
      search_journal: {
        Args: {
          p_before?: string
          p_from?: string
          p_limit?: number
          p_query?: string
          p_status?: Database["public"]["Enums"]["checkin_status"]
        }
        Returns: {
          checkin_date: string
          completed_at: string | null
          craving_score: number | null
          created_at: string
          energy_score: number | null
          id: string
          lesson_text: string | null
          mood_score: number | null
          notes: string | null
          proud_of_text: string | null
          status: Database["public"]["Enums"]["checkin_status"]
          stress_score: number | null
          tomorrow_intention_text: string | null
          updated_at: string
          user_id: string
          victory_text: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_checkins"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_primary_substance: {
        Args: { p_user_substance_id: string }
        Returns: undefined
      }
      set_primary_support_contact: {
        Args: { p_contact_id: string }
        Returns: undefined
      }
      set_user_motivations: { Args: { payload: Json }; Returns: undefined }
      start_craving_event: { Args: { payload: Json }; Returns: Json }
      start_craving_intervention: {
        Args: { p_event_id: string; payload: Json }
        Returns: Json
      }
      update_craving_timer: {
        Args: { p_action: string; p_event_id: string }
        Returns: Json
      }
    }
    Enums: {
      achievement_category:
        | "sobriety"
        | "consistency"
        | "reflection"
        | "understanding"
        | "action"
        | "plan"
      checkin_status: "sober" | "sober_with_craving" | "consumed"
      craving_event_status: "in_progress" | "completed" | "abandoned"
      motivation:
        | "health"
        | "energy"
        | "sleep"
        | "relationships"
        | "family"
        | "confidence"
        | "finances"
        | "career"
        | "freedom"
        | "clarity"
        | "personal_project"
        | "other"
      substance_goal: "abstinence" | "reduction" | "observation"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      achievement_category: [
        "sobriety",
        "consistency",
        "reflection",
        "understanding",
        "action",
        "plan",
      ],
      checkin_status: ["sober", "sober_with_craving", "consumed"],
      craving_event_status: ["in_progress", "completed", "abandoned"],
      motivation: [
        "health",
        "energy",
        "sleep",
        "relationships",
        "family",
        "confidence",
        "finances",
        "career",
        "freedom",
        "clarity",
        "personal_project",
        "other",
      ],
      substance_goal: ["abstinence", "reduction", "observation"],
    },
  },
} as const
