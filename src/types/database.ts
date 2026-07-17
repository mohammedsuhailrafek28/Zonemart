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
      cart_items: {
        Row: {
          created_at: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          quantity: number
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_offers: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          note: string | null
          price: number
          product_name: string
          quantity: number
          ready_minutes: number
          request_id: string
          status: Database["public"]["Enums"]["flash_offer_status"]
          store_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          note?: string | null
          price: number
          product_name: string
          quantity: number
          ready_minutes: number
          request_id: string
          status?: Database["public"]["Enums"]["flash_offer_status"]
          store_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          note?: string | null
          price?: number
          product_name?: string
          quantity?: number
          ready_minutes?: number
          request_id?: string
          status?: Database["public"]["Enums"]["flash_offer_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "flash_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_offers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_requests: {
        Row: {
          category: string
          created_at: string
          description: string | null
          expires_at: string
          id: string
          item_name: string
          max_price: number | null
          quantity: number
          status: Database["public"]["Enums"]["flash_request_status"]
          urgency_minutes: number
          user_id: string
          zone: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          expires_at: string
          id?: string
          item_name: string
          max_price?: number | null
          quantity?: number
          status?: Database["public"]["Enums"]["flash_request_status"]
          urgency_minutes: number
          user_id: string
          zone: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          item_name?: string
          max_price?: number | null
          quantity?: number
          status?: Database["public"]["Enums"]["flash_request_status"]
          urgency_minutes?: number
          user_id?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_requests_zone_fkey"
            columns: ["zone"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["name"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string
          flash_offer_id: string | null
          flash_request_id: string | null
          id: string
          pickup_code: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          total: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at: string
          flash_offer_id?: string | null
          flash_request_id?: string | null
          id?: string
          pickup_code: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          total: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          flash_offer_id?: string | null
          flash_request_id?: string | null
          id?: string
          pickup_code?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_flash_offer_id_fkey"
            columns: ["flash_offer_id"]
            isOneToOne: false
            referencedRelation: "flash_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_flash_request_id_fkey"
            columns: ["flash_request_id"]
            isOneToOne: false
            referencedRelation: "flash_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          name: string
          price: number
          stock: number
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name: string
          price: number
          stock: number
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          stock?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          zone: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          zone: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_zone_fkey"
            columns: ["zone"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["name"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          category_tags: string[]
          created_at: string
          id: string
          name: string
          owner_id: string
          verified: boolean
          zone: string
        }
        Insert: {
          active?: boolean
          category_tags?: string[]
          created_at?: string
          id?: string
          name: string
          owner_id: string
          verified?: boolean
          zone: string
        }
        Update: {
          active?: boolean
          category_tags?: string[]
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          verified?: boolean
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_zone_fkey"
            columns: ["zone"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["name"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string
          name: string
        }
        Insert: {
          created_at?: string
          name: string
        }
        Update: {
          created_at?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_flash_offer: {
        Args: { p_offer_id: string; p_request_id: string }
        Returns: {
          expires_at: string
          order_id: string
          pickup_code: string
          total: number
        }[]
      }
      assert_customer: { Args: never; Returns: string }
      assert_vendor: { Args: never; Returns: string }
      cancel_flash_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      checkout_cart: {
        Args: never
        Returns: {
          expires_at: string
          order_id: string
          pickup_code: string
          total: number
        }[]
      }
      clear_cart: { Args: never; Returns: undefined }
      create_flash_request: {
        Args: {
          p_category: string
          p_description: string
          p_item_name: string
          p_max_price: number
          p_quantity: number
          p_urgency_minutes: number
        }
        Returns: {
          category: string
          created_at: string
          description: string | null
          expires_at: string
          id: string
          item_name: string
          max_price: number | null
          quantity: number
          status: Database["public"]["Enums"]["flash_request_status"]
          urgency_minutes: number
          user_id: string
          zone: string
        }
        SetofOptions: {
          from: "*"
          to: "flash_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_flash_marketplace: {
        Args: never
        Returns: {
          expired_offers: number
          expired_requests: number
        }[]
      }
      expire_reservations: { Args: never; Returns: number }
      generate_pickup_code: { Args: never; Returns: string }
      remove_cart_item: { Args: { p_product_id: string }; Returns: undefined }
      reserve_product: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: {
          expires_at: string
          order_id: string
          pickup_code: string
          total: number
        }[]
      }
      set_cart_item: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_replace_cart?: boolean
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_flash_offer: {
        Args: {
          p_expiration_minutes: number
          p_note: string
          p_product_name: string
          p_quantity: number
          p_ready_minutes: number
          p_request_id: string
          p_unit_price: number
        }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          note: string | null
          price: number
          product_name: string
          quantity: number
          ready_minutes: number
          request_id: string
          status: Database["public"]["Enums"]["flash_offer_status"]
          store_id: string
        }
        SetofOptions: {
          from: "*"
          to: "flash_offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      withdraw_flash_offer: { Args: { p_offer_id: string }; Returns: undefined }
    }
    Enums: {
      flash_offer_status: "open" | "accepted" | "rejected" | "expired"
      flash_request_status: "open" | "fulfilled" | "expired" | "cancelled"
      order_status: "reserved" | "completed" | "expired" | "cancelled"
      user_role: "customer" | "vendor"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      flash_offer_status: ["open", "accepted", "rejected", "expired"],
      flash_request_status: ["open", "fulfilled", "expired", "cancelled"],
      order_status: ["reserved", "completed", "expired", "cancelled"],
      user_role: ["customer", "vendor"],
    },
  },
} as const
