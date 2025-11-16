export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      game_members: {
        Row: {
          game_id: string;
          joined_at: string;
          pnl: number;
          pnl_daily_change: number;
          user_id: string;
        };
        Insert: {
          game_id: string;
          joined_at?: string;
          pnl?: number;
          pnl_daily_change?: number;
          user_id: string;
        };
        Update: {
          game_id?: string;
          joined_at?: string;
          pnl?: number;
          pnl_daily_change?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_members_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      game_picks: {
        Row: {
          created_at: string;
          current_price: number | null;
          game_id: string;
          id: string;
          pick_round: number;
          start_price: number | null;
          symbol: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_price?: number | null;
          game_id: string;
          id?: string;
          pick_round: number;
          start_price?: number | null;
          symbol: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_price?: number | null;
          game_id?: string;
          id?: string;
          pick_round?: number;
          start_price?: number | null;
          symbol?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_picks_game_id_user_id_fkey";
            columns: ["game_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "game_members";
            referencedColumns: ["game_id", "user_id"];
          },
        ];
      };
      game_round_pools: {
        Row: {
          game_id: string;
          pick_round: number;
          symbol: string;
        };
        Insert: {
          game_id: string;
          pick_round: number;
          symbol: string;
        };
        Update: {
          game_id?: string;
          pick_round?: number;
          symbol?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_round_pools_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          created_at: string;
          created_by: string | null;
          current_pick_round: number;
          current_turn_user_id: string | null;
          end_time: string | null;
          id: string;
          invite_code: string;
          name: string;
          pick_deadline: string | null;
          pick_order: string[] | null;
          round_categories: string[] | null;
          start_time: string | null;
          status: Database["public"]["Enums"]["game_status"];
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          current_pick_round?: number;
          current_turn_user_id?: string | null;
          end_time?: string | null;
          id?: string;
          invite_code: string;
          name: string;
          pick_deadline?: string | null;
          pick_order?: string[] | null;
          round_categories?: string[] | null;
          start_time?: string | null;
          status?: Database["public"]["Enums"]["game_status"];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          current_pick_round?: number;
          current_turn_user_id?: string | null;
          end_time?: string | null;
          id?: string;
          invite_code?: string;
          name?: string;
          pick_deadline?: string | null;
          pick_order?: string[] | null;
          round_categories?: string[] | null;
          start_time?: string | null;
          status?: Database["public"]["Enums"]["game_status"];
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      symbol_refresh_state: {
        Row: {
          id: number;
          last_error: string | null;
          last_run: string | null;
          next_offset: number;
        };
        Insert: {
          id?: number;
          last_error?: string | null;
          last_run?: string | null;
          next_offset?: number;
        };
        Update: {
          id?: number;
          last_error?: string | null;
          last_run?: string | null;
          next_offset?: number;
        };
        Relationships: [];
      };
      symbols: {
        Row: {
          company_name: string;
          currency: string;
          current_price: number | null;
          d: number | null;
          day_change: number | null;
          day_change_pct: number | null;
          day_high: number | null;
          day_low: number | null;
          day_open: number | null;
          description: string;
          dp: number | null;
          exchange: string;
          logo: string | null;
          marketCapitalization: number | null;
          prev_close: number | null;
          price_time: string | null;
          symbol: string;
        };
        Insert: {
          company_name: string;
          currency: string;
          current_price?: number | null;
          d?: number | null;
          day_change?: number | null;
          day_change_pct?: number | null;
          day_high?: number | null;
          day_low?: number | null;
          day_open?: number | null;
          description: string;
          dp?: number | null;
          exchange: string;
          logo?: string | null;
          marketCapitalization?: number | null;
          prev_close?: number | null;
          price_time?: string | null;
          symbol: string;
        };
        Update: {
          company_name?: string;
          currency?: string;
          current_price?: number | null;
          d?: number | null;
          day_change?: number | null;
          day_change_pct?: number | null;
          day_high?: number | null;
          day_low?: number | null;
          day_open?: number | null;
          description?: string;
          dp?: number | null;
          exchange?: string;
          logo?: string | null;
          marketCapitalization?: number | null;
          prev_close?: number | null;
          price_time?: string | null;
          symbol?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_lobby_and_add_creator: {
        Args: { game_name: string; invite_code: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          current_pick_round: number;
          current_turn_user_id: string | null;
          end_time: string | null;
          id: string;
          invite_code: string;
          name: string;
          pick_deadline: string | null;
          pick_order: string[] | null;
          round_categories: string[] | null;
          start_time: string | null;
          status: Database["public"]["Enums"]["game_status"];
        };
        SetofOptions: {
          from: "*";
          to: "games";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      debug_make_pick_for_user: {
        Args: {
          game_id_to_pick_in: string;
          symbol_to_pick: string;
          user_id_to_pick: string;
        };
        Returns: undefined;
      };
      is_member: {
        Args: { _game_id: string; _user_id: string };
        Returns: boolean;
      };
      make_pick: {
        Args: { game_id_to_pick_in: string; symbol_to_pick: string };
        Returns: undefined;
      };
      start_game: { Args: { game_id_to_start: string }; Returns: undefined };
    };
    Enums: {
      game_status: "LOBBY" | "DRAFTING" | "ACTIVE" | "FINISHED";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      game_status: ["LOBBY", "DRAFTING", "ACTIVE", "FINISHED"],
    },
  },
} as const;
