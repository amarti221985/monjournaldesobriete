/**
 * Types de la base Supabase.
 *
 * FICHIER GÉNÉRÉ — ne pas modifier à la main. Régénérer après chaque migration :
 *   npx supabase gen types typescript --linked > src/types/database.ts
 *
 * Sprint 0 : aucune table métier n'existe encore, le schéma public est vide.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
