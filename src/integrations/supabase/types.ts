export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.15" }
  public: {
    Tables: {
      events: {
        Row: { all_day: boolean; author: string; created_at: string; id: string; kind: string; note: string | null; pair_id: string; starts_at: string | null; starts_on: string; title: string; updated_at: string }
        Insert: { all_day?: boolean; author?: string; created_at?: string; id?: string; kind?: string; note?: string | null; pair_id: string; starts_at?: string | null; starts_on: string; title: string; updated_at?: string }
        Update: { all_day?: boolean; author?: string; created_at?: string; id?: string; kind?: string; note?: string | null; pair_id?: string; starts_at?: string | null; starts_on?: string; title?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "events_pair_id_fkey"; columns: ["pair_id"]; isOneToOne: false; referencedRelation: "pairs"; referencedColumns: ["id"] }]
      }
      messages: {
        Row: { author: string; body: string; created_at: string; deliver_at: string | null; id: string; pair_id: string; pinned: boolean; reaction: string | null }
        Insert: { author?: string; body: string; created_at?: string; deliver_at?: string | null; id?: string; pair_id: string; pinned?: boolean; reaction?: string | null }
        Update: { author?: string; body?: string; created_at?: string; deliver_at?: string | null; id?: string; pair_id?: string; pinned?: boolean; reaction?: string | null }
        Relationships: [{ foreignKeyName: "messages_pair_id_fkey"; columns: ["pair_id"]; isOneToOne: false; referencedRelation: "pairs"; referencedColumns: ["id"] }]
      }
      pair_invites: {
        Row: { consumed_at: string | null; consumed_by_session_id: string | null; created_at: string; created_by_session_id: string | null; expires_at: string; id: string; link_secret_digest: string; manual_code_hmac: string | null; pair_id: string; revoked_at: string | null; target_role: string }
        Insert: { consumed_at?: string | null; consumed_by_session_id?: string | null; created_at?: string; created_by_session_id?: string | null; expires_at: string; id?: string; link_secret_digest: string; manual_code_hmac?: string | null; pair_id: string; revoked_at?: string | null; target_role: string }
        Update: { consumed_at?: string | null; consumed_by_session_id?: string | null; created_at?: string; created_by_session_id?: string | null; expires_at?: string; id?: string; link_secret_digest?: string; manual_code_hmac?: string | null; pair_id?: string; revoked_at?: string | null; target_role?: string }
        Relationships: [
          { foreignKeyName: "pair_invites_consumed_by_session_id_fkey"; columns: ["consumed_by_session_id"]; isOneToOne: false; referencedRelation: "pair_sessions"; referencedColumns: ["id"] },
          { foreignKeyName: "pair_invites_created_by_session_id_fkey"; columns: ["created_by_session_id"]; isOneToOne: false; referencedRelation: "pair_sessions"; referencedColumns: ["id"] },
          { foreignKeyName: "pair_invites_pair_id_fkey"; columns: ["pair_id"]; isOneToOne: false; referencedRelation: "pairs"; referencedColumns: ["id"] }
        ]
      }
      pair_recovery_keys: {
        Row: { created_at: string; id: string; last_used_at: string | null; pair_id: string; revoked_at: string | null; rotated_at: string | null; secret_digest: string }
        Insert: { created_at?: string; id?: string; last_used_at?: string | null; pair_id: string; revoked_at?: string | null; rotated_at?: string | null; secret_digest: string }
        Update: { created_at?: string; id?: string; last_used_at?: string | null; pair_id?: string; revoked_at?: string | null; rotated_at?: string | null; secret_digest?: string }
        Relationships: [{ foreignKeyName: "pair_recovery_keys_pair_id_fkey"; columns: ["pair_id"]; isOneToOne: true; referencedRelation: "pairs"; referencedColumns: ["id"] }]
      }
      pair_sessions: {
        Row: { absolute_expires_at: string; created_at: string; created_via: string; created_via_invite_id: string | null; device_label: string | null; id: string; idle_expires_at: string; last_seen_at: string; pair_id: string; platform: string | null; revoked_at: string | null; revoked_by_session_id: string | null; role: string; rotated_from_session_id: string | null; token_digest: string }
        Insert: { absolute_expires_at: string; created_at?: string; created_via: string; created_via_invite_id?: string | null; device_label?: string | null; id?: string; idle_expires_at: string; last_seen_at?: string; pair_id: string; platform?: string | null; revoked_at?: string | null; revoked_by_session_id?: string | null; role: string; rotated_from_session_id?: string | null; token_digest: string }
        Update: { absolute_expires_at?: string; created_at?: string; created_via?: string; created_via_invite_id?: string | null; device_label?: string | null; id?: string; idle_expires_at?: string; last_seen_at?: string; pair_id?: string; platform?: string | null; revoked_at?: string | null; revoked_by_session_id?: string | null; role?: string; rotated_from_session_id?: string | null; token_digest?: string }
        Relationships: [
          { foreignKeyName: "pair_sessions_created_via_invite_fkey"; columns: ["created_via_invite_id"]; isOneToOne: false; referencedRelation: "pair_invites"; referencedColumns: ["id"] },
          { foreignKeyName: "pair_sessions_pair_id_fkey"; columns: ["pair_id"]; isOneToOne: false; referencedRelation: "pairs"; referencedColumns: ["id"] },
          { foreignKeyName: "pair_sessions_revoked_by_session_id_fkey"; columns: ["revoked_by_session_id"]; isOneToOne: false; referencedRelation: "pair_sessions"; referencedColumns: ["id"] },
          { foreignKeyName: "pair_sessions_rotated_from_session_id_fkey"; columns: ["rotated_from_session_id"]; isOneToOne: false; referencedRelation: "pair_sessions"; referencedColumns: ["id"] }
        ]
      }
      pairs: {
        Row: { anniversary: string; calendar_key: string; code: string; created_at: string; id: string; owner_name: string; owner_token: string; partner_name: string; partner_token: string | null }
        Insert: { anniversary?: string; calendar_key?: string; code: string; created_at?: string; id?: string; owner_name?: string; owner_token: string; partner_name?: string; partner_token?: string | null }
        Update: { anniversary?: string; calendar_key?: string; code?: string; created_at?: string; id?: string; owner_name?: string; owner_token?: string; partner_name?: string; partner_token?: string | null }
        Relationships: []
      }
      photos: {
        Row: { caption: string | null; created_at: string; id: string; pair_id: string; storage_path: string }
        Insert: { caption?: string | null; created_at?: string; id?: string; pair_id: string; storage_path: string }
        Update: { caption?: string | null; created_at?: string; id?: string; pair_id?: string; storage_path?: string }
        Relationships: [{ foreignKeyName: "photos_pair_id_fkey"; columns: ["pair_id"]; isOneToOne: false; referencedRelation: "pairs"; referencedColumns: ["id"] }]
      }
      rate_limit_buckets: {
        Row: { count: number; expires_at: string; key_hash: string; scope: string; window_start: string }
        Insert: { count?: number; expires_at: string; key_hash: string; scope: string; window_start: string }
        Update: { count?: number; expires_at?: string; key_hash?: string; scope?: string; window_start?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      rate_limit_cleanup: { Args: never; Returns: number }
      rate_limit_hit: { Args: { _key_hash: string; _limit: number; _scope: string; _window_seconds: number }; Returns: { allowed: boolean; current_count: number; remaining: number; retry_after_seconds: number }[] }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]
export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never
export const Constants = { public: { Enums: {} } } as const