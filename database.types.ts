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
      investment_history: {
        Row: {
          id: number;
          snapshot_date: string;
          total_invested: number;
          total_worth: number;
          unrealized_pnl: number;
          user_id: string;
        };
        Insert: {
          id?: number;
          snapshot_date: string;
          total_invested: number;
          total_worth: number;
          unrealized_pnl: number;
          user_id: string;
        };
        Update: {
          id?: number;
          snapshot_date?: string;
          total_invested?: number;
          total_worth?: number;
          unrealized_pnl?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      positions: {
        Row: {
          average_cost: number;
          id: number;
          quantity: number;
          symbol: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          average_cost: number;
          id?: number;
          quantity: number;
          symbol: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          average_cost?: number;
          id?: number;
          quantity?: number;
          symbol?: string;
          updated_at?: string | null;
          user_id?: string;
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
      transactions: {
        Row: {
          executed_at: string;
          id: string;
          inserted_at: string;
          price: number;
          quantity: number;
          side: Database["public"]["Enums"]["trade_side"];
          symbol: string;
          user_id: string;
        };
        Insert: {
          executed_at?: string;
          id?: string;
          inserted_at?: string;
          price: number;
          quantity: number;
          side: Database["public"]["Enums"]["trade_side"];
          symbol: string;
          user_id: string;
        };
        Update: {
          executed_at?: string;
          id?: string;
          inserted_at?: string;
          price?: number;
          quantity?: number;
          side?: Database["public"]["Enums"]["trade_side"];
          symbol?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      portfolios: {
        Row: {
          last_change_pct: number | null;
          last_trade_at: string | null;
          position_count: number | null;
          tickers: string[] | null;
          total_change_pct: number | null;
          total_invested: number | null;
          total_worth: number | null;
          unrealized_pnl: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      trade_side: "BUY" | "SELL";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema =
  DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  } ? keyof (
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Tables"
      ]
      & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
        "Views"
      ]
    )
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
} ? (
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Views"
    ]
  )[TableName] extends {
    Row: infer R;
  } ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (
    & DefaultSchema["Tables"]
    & DefaultSchema["Views"]
  ) ? (
      & DefaultSchema["Tables"]
      & DefaultSchema["Views"]
    )[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    } ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Insert: infer I;
  } ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    } ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
      "Tables"
    ]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]][
    "Tables"
  ][TableName] extends {
    Update: infer U;
  } ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    } ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]][
      "Enums"
    ]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][
    EnumName
  ]
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
    ? keyof DatabaseWithoutInternals[
      PublicCompositeTypeNameOrOptions["schema"]
    ]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]][
    "CompositeTypes"
  ][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      trade_side: ["BUY", "SELL"],
    },
  },
} as const;
