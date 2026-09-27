// The publishable key is intended for browser use. RLS protects all user data.
const SUPABASE_URL = "https://qoqllxnfzueyyrfbbdtx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_L5B6xrQRit2ADwxO9ZC3eA_bXN-P3-G";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

