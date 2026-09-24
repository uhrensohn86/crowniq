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
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watch_images: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          storage_path: string
          user_id: string
          watch_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          storage_path: string
          user_id: string
          watch_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          storage_path?: string
          user_id?: string
          watch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_images_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "watches"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_purchase_discounts: {
        Row: {
          amount: number
          created_at: string
          id: string
          label: string
          user_id: string
          watch_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          label: string
          user_id: string
          watch_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          label?: string
          user_id?: string
          watch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_purchase_discounts_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "watches"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_wears: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          watch_id: string
          worn_on: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          watch_id: string
          worn_on?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          watch_id?: string
          worn_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_wears_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "watches"
            referencedColumns: ["id"]
          },
        ]
      }
      watches: {
        Row: {
          battery_type: string | null
          bracelet_material: string | null
          bracelet_type: string | null
          brand: string
          case_back: string | null
          case_material: string | null
          case_finish: string | null
          case_coating: string | null
          complications: string[] | null
          created_at: string
          crystal: string | null
          currency: string | null
          current_market_value: number | null
          dealer: string | null
          diameter_mm: number | null
          discount_amount: number | null
          discount_percent: number | null
          final_price: number | null
          id: string
          insurance_value: number | null
          lug_to_lug_mm: number | null
          lug_width_mm: number | null
          market_value_date: string | null
          model: string
          movement_caliber: string | null
          movement_manufacturer: string | null
          movement_type: string | null
          msrp: number | null
          notes: string | null
          payment_method: string | null
          primary_image_path: string | null
          purchase_date: string | null
          reference_number: string | null
          serial_number: string | null
          updated_at: string
          user_id: string
          water_resistance_m: number | null
        }
        Insert: {
          battery_type?: string | null
          bracelet_material?: string | null
          bracelet_type?: string | null
          brand: string
          case_back?: string | null
          case_material?: string | null
          case_finish?: string | null
          case_coating?: string | null
          complications?: string[] | null
          created_at?: string
          crystal?: string | null
          currency?: string | null
          current_market_value?: number | null
          dealer?: string | null
          diameter_mm?: number | null
          discount_amount?: number | null
          discount_percent?: number | null
          final_price?: number | null
          id?: string
          insurance_value?: number | null
          lug_to_lug_mm?: number | null
          lug_width_mm?: number | null
          market_value_date?: string | null
          model: string
          movement_caliber?: string | null
          movement_manufacturer?: string | null
          movement_type?: string | null
          msrp?: number | null
          notes?: string | null
          payment_method?: string | null
          primary_image_path?: string | null
          purchase_date?: string | null
          reference_number?: string | null
          serial_number?: string | null
          updated_at?: string
          user_id: string
          water_resistance_m?: number | null
        }
        Update: {
          battery_type?: string | null
          bracelet_material?: string | null
          bracelet_type?: string | null
          brand?: string
          case_back?: string | null
          case_material?: string | null
          case_finish?: string | null
          case_coating?: string | null
          complications?: string[] | null
          created_at?: string
          crystal?: string | null
          currency?: string | null
          current_market_value?: number | null
          dealer?: string | null
          diameter_mm?: number | null
          discount_amount?: number | null
          discount_percent?: number | null
          final_price?: number | null
          id?: string
          insurance_value?: number | null
          lug_to_lug_mm?: number | null
          lug_width_mm?: number | null
          market_value_date?: string | null
          model?: string
          movement_caliber?: string | null
          movement_manufacturer?: string | null
          movement_type?: string | null
          msrp?: number | null
          notes?: string | null
          payment_method?: string | null
          primary_image_path?: string | null
          purchase_date?: string | null
          reference_number?: string | null
          serial_number?: string | null
          updated_at?: string
          user_id?: string
          water_resistance_m?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
