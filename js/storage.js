// Gerenciador central - Inicialização Supabase
const SUPABASE_URL = 'https://vzbymfelssijrwoqpjnr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6YnltZmVsc3NpanJ3b3Fwam5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjcyOTMsImV4cCI6MjA5MDEwMzI5M30.UXbCf4laK5hcHsuv4YJJ3qxa7xeIGqCFNbPzMKMxJAY';

const Storage = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.AppSupabase = Storage;
