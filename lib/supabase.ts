import { createClient } from "@supabase/supabase-js";

// Vinext ships browser-safe configuration through Vite's public environment
// variables. Keep the Next-style fallbacks for server rendering and tests.
const url = import.meta.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
