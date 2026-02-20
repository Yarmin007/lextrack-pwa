import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://layxhidbocosorbfcpkd.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxheXhoaWRib2Nvc29yYmZjcGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjk5NjIsImV4cCI6MjA4NjkwNTk2Mn0.LCKV0WSfZ7dY8YzoCrrjcH_GXGdhMy3toMYwVJ05pys"

// This is the global supabase client for LExtrack
export const supabase = createClient(supabaseUrl, supabaseAnonKey)