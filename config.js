// Reserved for future server-side integrations.
// NEVER expose supabaseServiceRoleKey to public/script.js or browser code.

module.exports = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
};