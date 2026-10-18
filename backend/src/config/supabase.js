require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[Supabase] Client initialized successfully.');
} else {
  console.warn('[Supabase] Warning: SUPABASE_URL or SUPABASE_ANON_KEY is not set in .env file.');
}

module.exports = supabase;
