import { createClient } from "@supabase/supabase-js";

// Ensure this file is never imported on client side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-service-role-key";

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
