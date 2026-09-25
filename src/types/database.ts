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
      complete_onboarding: { Args: { payload: Json }; Returns: string }
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
    }
    Enums: {
      checkin_status: "sober" | "sober_with_craving" | "consumed"
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
      checkin_status: ["sober", "sober_with_craving", "consumed"],
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
