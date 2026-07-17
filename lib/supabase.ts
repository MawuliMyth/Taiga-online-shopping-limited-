import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = createClient(url ?? "https://example.supabase.co", anonKey ?? "missing-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  compare_at_price: number | null;
  rating: number;
  badge: string | null;
  image_url: string;
  inventory: number;
};
